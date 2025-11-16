import type { Prisma } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

export const clearReviewQueue = async (tx: TxClient, userId: string): Promise<number> => {
  const result = await tx.transaction.deleteMany({
    where: {
      userId,
      classificationSource: {
        not: 'manual',
      },
    },
  });

  return result.count;
};
