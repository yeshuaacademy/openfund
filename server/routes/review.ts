import { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { clearReviewQueue as clearReviewQueueForUser } from '../services/reviewQueueService';

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID ?? 'demo-user';

export const getReviewTransactions = async (req: Request, res: Response) => {
  const userId = req.header('x-user-id') ?? DEFAULT_USER_ID;

  try {
    const [transactions, categories] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId,
          categoryId: null,
        },
        include: {
          account: true,
        },
        orderBy: {
          date: 'desc',
        },
      }),
      prisma.category.findMany({
        orderBy: {
          name: 'asc',
        },
      }),
    ]);

    return res.json({
      transactions: transactions.map((tx) => ({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: Number(tx.amountMinor) / 100,
        amountMinor: tx.amountMinor.toString(),
        currency: tx.currency,
        source: tx.source,
        counterparty: tx.counterparty,
        accountIdentifier: tx.account?.identifier ?? null,
        accountName: tx.account?.name ?? null,
        createdAt: tx.createdAt,
      })),
      categories,
    });
  } catch (error) {
    console.error('Review fetch failed', error);
    return res.status(500).json({ error: 'Failed to load review queue.' });
  }
};

export const updateTransactionCategory = async (req: Request, res: Response) => {
  const userId = req.header('x-user-id') ?? DEFAULT_USER_ID;
  const transactionId = req.params.id;
  const { categoryId, categoryName } = req.body as {
    categoryId?: string | null;
    categoryName?: string;
  };

  try {
    const tx = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId,
      },
      select: {
        id: true,
        ledger: {
          select: {
            lockedAt: true,
          },
        },
      },
    });

    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    if (process.env.RECONCILIATION_LOCKS_ENABLED !== 'false' && tx.ledger?.lockedAt) {
      return res.status(423).json({ error: 'Ledger period is locked; cannot modify transaction.' });
    }

    let finalCategoryId = categoryId ?? null;

    if (!finalCategoryId && categoryName) {
      const category = await prisma.category.upsert({
        where: { name: categoryName },
        update: {},
        create: { name: categoryName },
      });

      finalCategoryId = category.id;
    }

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        categoryId: finalCategoryId,
        classificationSource: 'manual',
        classificationRuleId: null,
      },
      include: {
        category: true,
      },
    });

    return res.json({
      id: updated.id,
      categoryId: updated.categoryId,
      categoryName: updated.category?.name ?? null,
    });
  } catch (error) {
    console.error('Category update failed', error);
    return res.status(500).json({ error: 'Failed to update category.' });
  }
};

export const clearReviewQueue = async (req: Request, res: Response) => {
  const userId = req.header('x-user-id') ?? DEFAULT_USER_ID;

  try {
    const cleared = await prisma.$transaction((tx) => clearReviewQueueForUser(tx, userId));
    return res.json({ cleared });
  } catch (error) {
    console.error('Clear review queue failed', error);
    return res.status(500).json({ error: 'Failed to clear review queue.' });
  }
};
