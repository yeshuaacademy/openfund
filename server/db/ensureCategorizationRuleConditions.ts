import { prisma } from '../prismaClient';

/**
 * Ensures the CategorizationRule.conditions column exists for the configured app schema.
 * Safe/idempotent for both dev and prod. Throws on failure.
 */
export async function ensureCategorizationRuleConditionsColumn() {
  const schemaName = resolveSchemaName();

  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = ${schemaName}
          AND table_name = 'CategorizationRule'
          AND column_name = 'conditions'
      ) AS "exists";
    `;

    const exists = rows[0]?.exists === true;

    if (exists) {
      console.log('[DB bootstrap] CategorizationRule.conditions already exists');
      return;
    }

    console.log('[DB bootstrap] Adding CategorizationRule.conditions column…');

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "${escapeIdentifier(schemaName)}"."CategorizationRule"
      ADD COLUMN "conditions" JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);

    console.log('[DB bootstrap] CategorizationRule.conditions column added successfully');
  } catch (err) {
    console.error('[DB bootstrap] Failed to ensure CategorizationRule.conditions column', err);
    throw err;
  }
}

function resolveSchemaName(): string {
  const rawUrl = process.env.DATABASE_URL;
  if (rawUrl) {
    try {
      const normalized = rawUrl.startsWith('postgres://')
        ? `postgresql://${rawUrl.slice('postgres://'.length)}`
        : rawUrl;
      const parsed = new URL(normalized);
      const schema = parsed.searchParams.get('schema');
      if (schema) {
        return schema;
      }
    } catch {
      // Fall through to default below.
    }
  }

  return 'public';
}

function escapeIdentifier(value: string): string {
  return value.replace(/"/g, '""');
}
