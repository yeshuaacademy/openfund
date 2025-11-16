import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportSummary } from '../../lib/import/types';
import { processImportBufferWithClient } from '../../server/services/importService';
import * as categorizationService from '../../server/services/categorizationService';

type StoredTransaction = {
  id: string;
  userId: string;
  hash: string;
  importFingerprint: string | null;
  amountMinor: bigint;
  source: string;
  normalizedKey: string;
  date: Date;
  categoryId: string | null;
  accountId?: string | null;
  rawRow?: Record<string, unknown> | null;
  classificationSource?: string;
  classificationRuleId?: string | null;
};

class FakePrismaClient {
  accounts: Array<{ id: string; userId: string; identifier: string; name: string; currency: string }> = [];
  ledgers: Array<{ id: string; userId: string; month: number; year: number; lockedAt: Date | null; lockedBy: string | null }> = [];
  transactions: StoredTransaction[] = [];
  importBatches: Array<{ id: string; userId: string }> = [];
  rules: Array<{ id: string; userId: string; isActive: boolean; priority: number; updatedAt: Date }> = [];
  openingBalances: Array<{ accountId: string; amountMinor: bigint; effectiveDate: Date }> = [];

  async $transaction<T>(callback: (tx: ReturnType<FakePrismaClient['createTx']>) => Promise<T>): Promise<T> {
    const tx = this.createTx();
    return callback(tx);
  }

  private createTx() {
    return {
      account: {
        upsert: async ({ where, update, create }: any) => {
          const existing = this.accounts.find(
            (account) => account.userId === where.userId_identifier.userId && account.identifier === where.userId_identifier.identifier,
          );

          if (existing) {
            existing.name = update.name;
            return existing;
          }

          const record = {
            id: crypto.randomUUID(),
            userId: create.userId,
            identifier: create.identifier,
            name: create.name,
            currency: create.currency,
          };
          this.accounts.push(record);
          this.openingBalances.push({
            accountId: record.id,
            amountMinor: 0n,
            effectiveDate: new Date('2024-01-01T00:00:00Z'),
          });
          return record;
        },
        findFirst: async ({ where }: any) => {
          if (!where?.id || !where?.userId) {
            return null;
          }
          return this.accounts.find(
            (account) => account.id === where.id && account.userId === where.userId,
          ) ?? null;
        },
      },
      ledger: {
        findUnique: async ({ where }: any) => {
          return this.ledgers.find(
            (ledger) =>
              ledger.userId === where.userId_month_year.userId &&
              ledger.month === where.userId_month_year.month &&
              ledger.year === where.userId_month_year.year,
          ) ?? null;
        },
        upsert: async ({ where, create }: any) => {
          const existing = this.ledgers.find(
            (ledger) =>
              ledger.userId === where.userId_month_year.userId &&
              ledger.month === where.userId_month_year.month &&
              ledger.year === where.userId_month_year.year,
          );

          if (existing) {
            return existing;
          }

          const record = {
            id: crypto.randomUUID(),
            userId: create.userId,
            month: create.month,
            year: create.year,
            lockedAt: null as Date | null,
            lockedBy: null as string | null,
          };
          this.ledgers.push(record);
          return record;
        },
        create: async ({ data }: any) => {
          const record = {
            id: crypto.randomUUID(),
            userId: data.userId,
            month: data.month,
            year: data.year,
            lockedAt: null as Date | null,
            lockedBy: null as string | null,
          };
          this.ledgers.push(record);
          return record;
        },
      },
      transaction: {
        findMany: async ({ where, select }: any) => {
          if (where?.hash?.in) {
            return this.transactions
              .filter((tx) => where.hash.in.includes(tx.hash))
              .map((tx) => ({
                id: tx.id,
                hash: tx.hash,
                importFingerprint: tx.importFingerprint,
                classificationSource: tx.classificationSource,
                classificationRuleId: tx.classificationRuleId ?? null,
                categoryId: tx.categoryId,
              }));
          }

          if (where?.userId && where?.source) {
            const matches = this.transactions.filter((tx) => {
              if (tx.userId !== where.userId) return false;
              if (tx.source !== where.source) return false;
              if (where.categoryId?.not === null && tx.categoryId === null) return false;
              return true;
            });

            if (select?.categoryId) {
              return matches.map((tx) => ({ categoryId: tx.categoryId }));
            }

            return matches;
          }

          return [];
        },
        findFirst: async ({ where, orderBy, select }: any) => {
          const matches = this.transactions
            .filter((tx) => {
              if (tx.userId !== where.userId) return false;
              if (where.source && tx.source !== where.source) return false;
              if (where.normalizedKey && tx.normalizedKey !== where.normalizedKey) return false;
              if (where.categoryId?.not === null && tx.categoryId === null) return false;

              if (where.amountMinor) {
                const gte = where.amountMinor.gte as bigint;
                const lte = where.amountMinor.lte as bigint;
                if (tx.amountMinor < gte || tx.amountMinor > lte) {
                  return false;
                }
              }

              return true;
            })
            .sort((a, b) => {
              if (orderBy?.date === 'desc') {
                return b.date.getTime() - a.date.getTime();
              }
              return a.date.getTime() - b.date.getTime();
            });

          const first = matches[0];
          if (!first) return null;

          if (select?.categoryId) {
            return { categoryId: first.categoryId };
          }

          return first;
        },
        createMany: async ({ data, skipDuplicates }: any) => {
          let count = 0;
          data.forEach((entry: any) => {
            const exists = this.transactions.find((tx) => tx.hash === entry.hash);
            if (exists && skipDuplicates) {
              return;
            }
            this.transactions.push({
              id: entry.id ?? crypto.randomUUID(),
              userId: entry.userId,
              hash: entry.hash,
              importFingerprint: entry.importFingerprint ?? null,
              amountMinor: BigInt(entry.amountMinor),
              source: entry.source,
              normalizedKey: entry.normalizedKey,
              date: entry.date instanceof Date ? entry.date : new Date(entry.date),
              categoryId: entry.categoryId ?? null,
              accountId: entry.accountId ?? null,
              rawRow: entry.rawRow ?? null,
              classificationSource: entry.classificationSource ?? 'none',
              classificationRuleId: entry.classificationRuleId ?? null,
            });
            count += 1;
          });

          return { count };
        },
        update: async ({ where, data }: any) => {
          const record = this.transactions.find((tx) => tx.id === where.id);
          if (!record) {
            return null;
          }
          if (data.categoryId !== undefined) {
            record.categoryId = data.categoryId;
          }
          if (data.classificationSource) {
            record.classificationSource = data.classificationSource;
          }
          if (data.classificationRuleId !== undefined) {
            record.classificationRuleId = data.classificationRuleId;
          }
          if (data.rawRow !== undefined) {
            record.rawRow = data.rawRow;
          }
          if (data.importFingerprint) {
            record.importFingerprint = data.importFingerprint;
          }
          return record;
        },
      },
      category: {
        findMany: async () => [],
        upsert: async ({ where }: any) => ({
          id: `category-${where.name}`,
          name: where.name,
        }),
      },
      importBatch: {
        create: async ({ data }: any) => {
          const record = { id: crypto.randomUUID(), userId: data.userId };
          this.importBatches.push(record);
          return record;
        },
        update: async () => undefined,
      },
      openingBalance: {
        findMany: async ({ where }: any) => {
          const accountId = where?.accountId;
          const effectiveDate = where?.effectiveDate?.lte
            ? new Date(where.effectiveDate.lte)
            : new Date();
          return this.openingBalances
            .filter((entry) => (!accountId || entry.accountId === accountId) && entry.effectiveDate <= effectiveDate)
            .sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime())
            .map((entry) => ({
              id: crypto.randomUUID(),
              accountId: entry.accountId,
              amountMinor: entry.amountMinor,
              effectiveDate: entry.effectiveDate,
              currency: 'EUR',
              note: null,
              createdBy: 'test',
              createdAt: new Date(),
              lockedAt: null,
              lockedBy: null,
            }));
        },
      },
      categorizationRule: {
        findMany: async () => [],
        update: async () => null,
        create: async () => null,
      },
    };
  }
}

const csvBuffer = fs.readFileSync(
  path.resolve(__dirname, '../../sheets/NL89INGB0006369960_2025-06-01_2025-06-30.csv'),
);

describe('import pipeline integration', () => {
  let prisma: FakePrismaClient;

  beforeEach(() => {
    prisma = new FakePrismaClient();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const runImport = (filename: string): Promise<ImportSummary> =>
    processImportBufferWithClient(prisma as any, {
      buffer: csvBuffer,
      filename,
      userId: 'demo-user',
    });

  it('reprocesses pending transactions on re-import without creating duplicates', async () => {
    const categorizeSpy = vi.spyOn(categorizationService, 'categorizeTransaction').mockResolvedValue({
      categoryId: 'cat-initial',
      classificationSource: 'rule',
      ruleId: 'rule-1',
    } as any);

    const first = await runImport('statement.csv');
    expect(first.importedCount).toBeGreaterThan(0);
    expect(prisma.transactions).toHaveLength(first.importedCount);

    categorizeSpy.mockResolvedValue({
      categoryId: 'cat-updated',
      classificationSource: 'rule',
      ruleId: 'rule-2',
    });

    const second = await runImport('statement.csv');
    expect(second.importedCount).toBe(0);
    expect(second.duplicateCount).toBe(0);
    expect(prisma.transactions).toHaveLength(first.importedCount);
    expect(prisma.transactions.every((tx) => typeof tx.importFingerprint === 'string' && tx.importFingerprint.length > 0)).toBe(true);
  });

  it('preserves manual overrides when re-importing the same CSV', async () => {
    vi.spyOn(categorizationService, 'categorizeTransaction').mockResolvedValue({
      categoryId: 'cat-auto',
      classificationSource: 'rule',
      ruleId: 'rule-1',
    } as any);

    await runImport('statement.csv');
    const manualTx = prisma.transactions[0];
    manualTx.classificationSource = 'manual';
    manualTx.categoryId = 'cat-manual';

    (categorizationService.categorizeTransaction as any).mockResolvedValue({
      categoryId: 'cat-next',
      classificationSource: 'rule',
      ruleId: 'rule-2',
    });

    const second = await runImport('statement.csv');
    expect(second.importedCount).toBe(0);
    expect(manualTx.categoryId).toBe('cat-manual');
    expect(manualTx.classificationSource).toBe('manual');
  });

  it('allows clearing queue and re-importing with updated rules', async () => {
    const categorizeSpy = vi.spyOn(categorizationService, 'categorizeTransaction').mockResolvedValue({
      categoryId: 'cat-first',
      classificationSource: 'rule',
      ruleId: 'rule-1',
    } as any);

    const first = await runImport('statement.csv');
    expect(prisma.transactions).toHaveLength(first.importedCount);

    // Simulate clearing review queue
    prisma.transactions = [];

    categorizeSpy.mockResolvedValue({
      categoryId: 'cat-second',
      classificationSource: 'rule',
      ruleId: 'rule-2',
    });

    const second = await runImport('statement.csv');
    expect(second.importedCount).toBe(first.importedCount);
    expect(prisma.transactions).toHaveLength(first.importedCount);
  });
});
