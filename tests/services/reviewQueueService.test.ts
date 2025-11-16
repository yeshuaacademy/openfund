import { describe, expect, it } from 'vitest';
import { clearReviewQueue } from '../../server/services/reviewQueueService';

describe('review queue service', () => {
  it('clears only non-manual transactions for the requested user', async () => {
    const store: Array<{ id: string; userId: string; classificationSource: string }> = [
      { id: 'tx-1', userId: 'user-1', classificationSource: 'import' },
      { id: 'tx-2', userId: 'user-1', classificationSource: 'manual' },
      { id: 'tx-3', userId: 'user-2', classificationSource: 'import' },
    ];

    const fakeTx = {
      transaction: {
        deleteMany: async ({ where }: any) => {
          const before = store.length;
          for (let index = store.length - 1; index >= 0; index -= 1) {
            const entry = store[index];
            if (entry.userId !== where.userId) continue;
            if (where.classificationSource?.not === 'manual' && entry.classificationSource === 'manual') {
              continue;
            }
            store.splice(index, 1);
          }
          return { count: before - store.length };
        },
      },
    } as any;

    const cleared = await clearReviewQueue(fakeTx, 'user-1');
    expect(cleared).toBe(1);
    expect(store).toHaveLength(2);
    expect(store.find((item) => item.id === 'tx-2')).toBeDefined();
    expect(store.find((item) => item.id === 'tx-3')).toBeDefined();
  });
});
