#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import process from "node:process";
import dotenv from "dotenv";
import pgPkg from "pg";

const { Client } = pgPkg;
const rootDir = process.cwd();
const defaultEnvPath = process.env.ENV_FILE || path.join(rootDir, ".env");
if (fs.existsSync(defaultEnvPath)) {
  dotenv.config({ path: defaultEnvPath });
} else {
  dotenv.config();
}

const args = parseArgs(process.argv.slice(2));
const pkgJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, "package.json"), "utf8")
);

const projectName =
  args.project ||
  args.name ||
  args.positional ||
  pkgJson.name ||
  "app";
const projectSlug = slugify(projectName);
const schemaName = projectSlug;
const roleName = `${projectSlug}_user`;

ensureIdentifier(schemaName, "schema");
ensureIdentifier(roleName, "role");

throw new Error(
  "scripts/provision-tenant.mjs is disabled for Yeshua Academy Finance. This app now uses a standalone database model (finance / finance_user / finance schema), so the old schema-only provisioning flow must not be used."
);

const devAdminUrl = requireEnv("SYSTEM_DATABASE_URL");
const prodManagerUrl =
  process.env.MCP_MANAGER_DATABASE_URL ||
  process.env.MCP_DATABASE_URL ||
  process.env.PRODUCTION_DATABASE_URL ||
  process.env.PROD_DATABASE_URL ||
  process.env.DATABASE_URL;
if (!prodManagerUrl) {
  throw new Error(
    "Missing MCP manager database URL. Set MCP_MANAGER_DATABASE_URL (or MCP_DATABASE_URL / DATABASE_URL) before running this script."
  );
}

const mcpSecret = requireEnv("MCP_SECRET");
const mcpApiUrl =
  process.env.MCP_API_URL || "https://mcp.prochat.tools/query";

const existingPassword = findExistingTenantPassword(roleName);
const tenantPassword = existingPassword || generatePassword();

const devDbName = parseDatabaseName(devAdminUrl);
const prodDbName = parseDatabaseName(prodManagerUrl);
const devProvisionSql = buildProvisioningSql({
  roleName,
  schemaName,
  password: tenantPassword,
  dbName: devDbName,
  transferOwnership: true,
});
const prodProvisionSql = buildProvisioningSql({
  roleName,
  schemaName,
  password: tenantPassword,
  dbName: prodDbName,
  transferOwnership: false,
});

const devTenantUrl = buildTenantUrl(
  devAdminUrl,
  roleName,
  tenantPassword,
  schemaName
);
const prodTenantUrl = buildTenantUrl(
  prodManagerUrl,
  roleName,
  tenantPassword,
  schemaName
);

const main = async () => {
  console.log(
    `🔧 Provisioning schema "${schemaName}" using role "${roleName}"`
  );

  await executeSqlLocally(devAdminUrl, devProvisionSql, "dev schema");
  await executeSqlViaMcp(prodProvisionSql, {
    apiUrl: mcpApiUrl,
    secret: mcpSecret,
    label: "production schema",
  });

  if (args.skipMigrations) {
    console.log("⏩ Skipping Prisma migrations (per --skip-migrations flag)");
  } else {
    await runPrismaMigrate(devTenantUrl, "dev");
    await applyMigrationsViaMcp({
      schemaName,
      apiUrl: mcpApiUrl,
      secret: mcpSecret,
    });
  }

  updateEnvFile(path.join(rootDir, ".env"), {
    TENANT_DB_USER: roleName,
    TENANT_DB_PASSWORD: tenantPassword,
    DATABASE_URL: devTenantUrl,
    MCP_MANAGER_DATABASE_URL: stripQuotes(prodManagerUrl),
    MCP_API_URL: mcpApiUrl,
    MCP_SECRET: mcpSecret,
  });

  const envLocalPath = path.join(rootDir, ".env.local");
  if (fs.existsSync(envLocalPath)) {
    updateEnvFile(envLocalPath, {
      TENANT_DB_USER: roleName,
      TENANT_DB_PASSWORD: tenantPassword,
      DATABASE_URL: devTenantUrl,
      MCP_MANAGER_DATABASE_URL: stripQuotes(prodManagerUrl),
      MCP_API_URL: mcpApiUrl,
      MCP_SECRET: mcpSecret,
    });
  }

  updateEnvFile(path.join(rootDir, ".env.production"), {
    TENANT_DB_USER: roleName,
    TENANT_DB_PASSWORD: tenantPassword,
    DATABASE_URL: prodTenantUrl,
    MCP_MANAGER_DATABASE_URL: stripQuotes(prodManagerUrl),
    MCP_API_URL: mcpApiUrl,
    MCP_SECRET: mcpSecret,
  });

  console.log("✅ Tenant provisioning complete for dev and production.");
  console.log(`   • Dev URL:  ${maskPassword(devTenantUrl)}`);
  console.log(`   • Prod URL: ${maskPassword(prodTenantUrl)}`);
};

main().catch((err) => {
  console.error("❌ Provisioning failed:", err.message);
  process.exit(1);
});

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const [key, rawValue] = arg.slice(2).split("=");
      flags[key] = rawValue === undefined ? true : rawValue;
    } else {
      positional.push(arg);
    }
  }
  return {
    project: flags.project || flags.name,
    name: flags.project || flags.name,
    positional: positional[0],
    skipMigrations: Boolean(flags["skip-migrations"] || flags.skipMigrations),
  };
}

function slugify(value) {
  if (typeof value !== "string" || !value.length) return "app";
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "app"
  );
}

function ensureIdentifier(value, label) {
  if (!/^[a-z][a-z0-9_]*$/i.test(value)) {
    throw new Error(`Invalid ${label} identifier: ${value}`);
  }
}

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function normalizeUrl(url) {
  if (!url) return url;
  const trimmed = stripQuotes(url.trim());
  if (trimmed.startsWith("postgres://")) {
    return "postgresql://" + trimmed.slice("postgres://".length);
  }
  return trimmed;
}

function buildTenantUrl(baseUrl, username, password, schema) {
  const normalized = normalizeUrl(baseUrl);
  const url = new URL(normalized);
  url.username = username;
  url.password = password;
  const params = new URLSearchParams(url.search);
  if (schema) params.set("schema", schema);
  url.search = params.toString();
  return url.toString();
}

function parseDatabaseName(urlString) {
  const normalized = normalizeUrl(urlString);
  const url = new URL(normalized);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, "")) || "postgres";
  return dbName.replace(/"/g, "");
}

function buildProvisioningSql({
  roleName,
  schemaName,
  password,
  dbName,
  transferOwnership = false,
}) {
  const roleLiteral = quoteLiteral(roleName);
  const passwordLiteral = quoteLiteral(password);
  const roleIdent = quoteIdent(roleName);
  const schemaIdent = quoteIdent(schemaName);
  const dbIdent = quoteIdent(dbName);

  let sql = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${roleLiteral}) THEN
    EXECUTE format('CREATE ROLE %I WITH LOGIN PASSWORD %L', ${roleLiteral}, ${passwordLiteral});
  ELSE
    EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', ${roleLiteral}, ${passwordLiteral});
  END IF;
END$$;

CREATE SCHEMA IF NOT EXISTS ${schemaIdent};
GRANT CONNECT ON DATABASE ${dbIdent} TO ${roleIdent};
GRANT USAGE ON SCHEMA ${schemaIdent} TO ${roleIdent};
GRANT CREATE ON SCHEMA ${schemaIdent} TO ${roleIdent};
ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaIdent} GRANT ALL PRIVILEGES ON TABLES TO ${roleIdent};
ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaIdent} GRANT ALL PRIVILEGES ON SEQUENCES TO ${roleIdent};
ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaIdent} GRANT ALL PRIVILEGES ON FUNCTIONS TO ${roleIdent};
`;
  if (transferOwnership) {
    sql += `ALTER SCHEMA ${schemaIdent} OWNER TO ${roleIdent};\n`;
  }
  return sql;
}

async function executeSqlLocally(connectionString, sql, label) {
  console.log(`🗄️  Executing ${label} locally...`);
  const client = new Client({ connectionString: normalizeUrl(connectionString) });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
  console.log(`   • ${label} updated`);
}

async function executeSqlViaMcp(sql, { apiUrl, secret, label }) {
  console.log(`🛰️  MCP executing ${label}...`);
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ sql }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `MCP request failed (${response.status} ${response.statusText}): ${text}`
    );
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (data.error) {
    throw new Error(`MCP error: ${JSON.stringify(data.error)}`);
  }
  return data;
}

async function applyMigrationsViaMcp({ schemaName, apiUrl, secret }) {
  console.log(
    `📦 Syncing Prisma migrations to production via MCP for schema ${schemaName}...`
  );
  const schemaIdent = quoteIdent(schemaName);
  const tableSql = `
CREATE TABLE IF NOT EXISTS ${schemaIdent}._prisma_migrations (
  id VARCHAR(36) PRIMARY KEY,
  checksum VARCHAR(64) NOT NULL,
  finished_at TIMESTAMPTZ,
  migration_name VARCHAR(255) NOT NULL,
  logs TEXT,
  rolled_back_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_steps_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ${quoteIdent(
    `${schemaName}_migrations_name_idx`
  )} ON ${schemaIdent}._prisma_migrations (migration_name);
`;
  await executeSqlViaMcp(tableSql, {
    apiUrl,
    secret,
    label: "production migration metadata",
  });

  let applied = new Set();
  try {
    const result = await executeSqlViaMcp(
      `SELECT migration_name FROM ${schemaIdent}._prisma_migrations`,
      { apiUrl, secret, label: "list applied migrations" }
    );
    const rows = Array.isArray(result.rows) ? result.rows : [];
    applied = new Set(
      rows
        .map((row) => {
          const raw =
            row.migration_name ??
            row.migration_Name ??
            row["migration_name"] ??
            row["migration_Name"];
          return typeof raw === "string" ? raw.trim() : null;
        })
        .filter(Boolean)
    );
  } catch (error) {
    console.warn(
      "⚠️  Could not read existing migrations via MCP, continuing:",
      error.message
    );
  }

  const migrationDirs = listLocalMigrationDirs();
  for (const migrationName of migrationDirs) {
    if (applied.has(migrationName)) {
      console.log(`   • ${migrationName} already applied on production`);
      continue;
    }
    const migrationPath = path.join(
      rootDir,
      "prisma",
      "migrations",
      migrationName,
      "migration.sql"
    );
    if (!fs.existsSync(migrationPath)) {
      console.warn(
        `⚠️  Missing migration file for ${migrationName}, skipping sync`
      );
      continue;
    }
    const migrationSql = fs.readFileSync(migrationPath, "utf8").trim();
    if (!migrationSql.length) {
      console.warn(`⚠️  Migration ${migrationName} is empty, skipping`);
      continue;
    }
    const checksum = crypto
      .createHash("sha256")
      .update(migrationSql)
      .digest("hex");
    const migrationId = randomUuid();
    const transactionSql = buildMigrationTransactionSql({
      schemaIdent,
      migrationSql,
      migrationId,
      migrationName,
      checksum,
    });
    await executeSqlViaMcp(transactionSql, {
      apiUrl,
      secret,
      label: `migration ${migrationName}`,
    });
    console.log(`   • Applied ${migrationName} via MCP`);
  }
}

function buildMigrationTransactionSql({
  schemaIdent,
  migrationSql,
  migrationId,
  migrationName,
  checksum,
}) {
  return `
BEGIN;
SET LOCAL search_path TO ${schemaIdent};
${migrationSql}

INSERT INTO _prisma_migrations (
  id,
  checksum,
  finished_at,
  migration_name,
  logs,
  rolled_back_at,
  started_at,
  applied_steps_count
) VALUES (
  ${quoteLiteral(migrationId)},
  ${quoteLiteral(checksum)},
  NOW(),
  ${quoteLiteral(migrationName)},
  '',
  NULL,
  NOW(),
  1
) ON CONFLICT (id) DO NOTHING;
COMMIT;
`;
}

function listLocalMigrationDirs() {
  const migrationsDir = path.join(rootDir, "prisma", "migrations");
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function quoteIdent(value) {
  return `"${value.replace(/"/g, '""')}"`;
}

function quoteLiteral(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

function generatePassword() {
  return crypto.randomBytes(24).toString("hex");
}

function randomUuid() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11)
    .replace(/[018]/g, (c) =>
      (
        c ^
        (crypto.randomBytes(1)[0] & (15 >> (c / 4)))
      ).toString(16)
    )
    .toLowerCase();
}

function findExistingTenantPassword(roleName) {
  const envFiles = [".env", ".env.production"];
  for (const rel of envFiles) {
    const abs = path.join(rootDir, rel);
    if (!fs.existsSync(abs)) continue;
    const parsed = dotenv.parse(fs.readFileSync(abs));
    if (parsed.TENANT_DB_PASSWORD) {
      return parsed.TENANT_DB_PASSWORD;
    }
    if (parsed.DATABASE_URL) {
      const value = stripQuotes(parsed.DATABASE_URL);
      const pwd = extractPasswordFromUrl(value, roleName);
      if (pwd) return pwd;
    }
  }
  return null;
}

function stripQuotes(value) {
  if (!value) return value;
  return value.replace(/^['"]|['"]$/g, "");
}

function extractPasswordFromUrl(urlString, roleName) {
  try {
    const normalized = normalizeUrl(urlString);
    const parsed = new URL(normalized);
    if (parsed.username !== roleName) return null;
    return decodeURIComponent(parsed.password);
  } catch {
    return null;
  }
}

function runPrismaMigrate(databaseUrl, label) {
  console.log(`📦 Running Prisma migrations for ${label}...`);
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["prisma", "migrate", "deploy"], {
      cwd: rootDir,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Prisma migrate failed for ${label} (exit ${code})`));
      }
    });
  });
}

function updateEnvFile(filePath, updates) {
  const hasFile = fs.existsSync(filePath);
  const original = hasFile ? fs.readFileSync(filePath, "utf8") : "";
  const updated = rewriteEnvContent(original, updates);
  fs.writeFileSync(filePath, updated);
}

function rewriteEnvContent(content, updates) {
  const lines = content ? content.split(/\r?\n/) : [];
  const result = [];
  const seen = new Set();

  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9_]+)=/);
    if (!match) {
      result.push(line);
      continue;
    }
    const key = match[1];
    if (updates[key] !== undefined) {
      if (seen.has(key)) {
        continue;
      }
      result.push(`${key}=${updates[key]}`);
      seen.add(key);
    } else {
      result.push(line);
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    if (seen.has(key)) continue;
    if (result.length && result[result.length - 1] !== "") {
      result.push("");
    }
    result.push(`${key}=${value}`);
    seen.add(key);
  }

  const joined = result.join("\n").replace(/\n{3,}/g, "\n\n");
  return joined.endsWith("\n") ? joined : `${joined}\n`;
}

function maskPassword(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "****";
    }
    return parsed.toString();
  } catch {
    return url;
  }
}
