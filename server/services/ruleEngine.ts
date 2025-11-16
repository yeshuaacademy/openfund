import type {
  CategorizationRule,
  Prisma,
  RuleMatchField,
  RuleMatchType,
} from '@prisma/client';

export type RuleEvaluationContext = {
  description: string;
  normalizedDescription: string;
  counterparty?: string | null;
  reference?: string | null;
  source?: string | null;
};

const ORDER_BY_PRIORITY = [
  { priority: 'desc' as const },
  { updatedAt: 'desc' as const },
  { createdAt: 'desc' as const },
];

export const fetchActiveRules = async (
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<CategorizationRule[]> =>
  tx.categorizationRule.findMany({
    where: {
      userId,
      isActive: true,
    },
    orderBy: ORDER_BY_PRIORITY,
  });

const valueForField = (rule: CategorizationRule, context: RuleEvaluationContext): string => {
  switch (rule.matchField) {
    case 'counterparty':
      return context.counterparty ?? '';
    case 'reference':
      return context.reference ?? '';
    case 'source':
      return context.source ?? '';
    case 'description':
    default:
      return context.description;
  }
};

const toLower = (value: string): string => value.toLowerCase();

const safeRegex = (pattern: string): RegExp | null => {
  try {
    return new RegExp(pattern, 'i');
  } catch (error) {
    console.warn('Invalid rule regex pattern', { pattern, error });
    return null;
  }
};

const matchesRule = (rule: CategorizationRule, context: RuleEvaluationContext): boolean => {
  const haystackRaw = valueForField(rule, context);
  if (!haystackRaw) {
    return false;
  }

  const haystack = toLower(haystackRaw);
  const needle = toLower(rule.pattern);

  switch (rule.matchType) {
    case 'regex': {
      const reg = safeRegex(rule.pattern);
      return reg ? reg.test(haystackRaw) : false;
    }
    case 'startsWith':
      return haystack.startsWith(needle);
    case 'endsWith':
      return haystack.endsWith(needle);
    case 'contains':
    default:
      return haystack.includes(needle);
  }
};

export const findMatchingRule = (
  rules: CategorizationRule[] | undefined,
  context: RuleEvaluationContext,
): CategorizationRule | null => {
  if (!rules?.length) {
    return null;
  }

  for (const rule of rules) {
    if (!rule.isActive) continue;
    if (!rule.pattern?.trim()) continue;
    if (matchesRule(rule, context)) {
      return rule;
    }
  }

  return null;
};

export const touchRuleMatch = async (
  tx: Prisma.TransactionClient,
  ruleId: string,
): Promise<void> => {
  await tx.categorizationRule.update({
    where: { id: ruleId },
    data: {
      lastMatchedAt: new Date(),
    },
  });
};

export const listRules = async (
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<CategorizationRule[]> =>
  tx.categorizationRule.findMany({
    where: { userId },
    orderBy: ORDER_BY_PRIORITY,
  });

export const createRule = async (
  tx: Prisma.TransactionClient,
  userId: string,
  payload: {
    label: string;
    pattern: string;
    matchType?: RuleMatchType;
    matchField?: RuleMatchField;
    categoryId: string;
    priority?: number;
    isActive?: boolean;
    createdBy?: string;
  },
): Promise<CategorizationRule> => {
  const data: Prisma.CategorizationRuleUncheckedCreateInput = {
    userId,
    importBatchId: null,
    ledgerId: null,
    categoryId: payload.categoryId,
    label: payload.label.trim(),
    pattern: payload.pattern.trim(),
    matchType: payload.matchType ?? 'regex',
    matchField: payload.matchField ?? 'description',
    priority: payload.priority ?? 100,
    isActive: payload.isActive ?? true,
    createdBy: payload.createdBy,
    createdAt: undefined as unknown as Date, // let database defaults handle timestamps
    updatedAt: undefined as unknown as Date,
    lastMatchedAt: null,
  };

  return tx.categorizationRule.create({
    data: data,
  });
};

export const updateRule = async (
  tx: Prisma.TransactionClient,
  userId: string,
  ruleId: string,
  payload: Partial<{
    label: string;
    pattern: string;
    matchType: RuleMatchType;
    matchField: RuleMatchField;
    categoryId: string;
    priority: number;
    isActive: boolean;
  }>,
): Promise<CategorizationRule> => {
  return tx.categorizationRule.update({
    where: {
      id: ruleId,
      userId,
    },
    data: {
      ...(payload.label !== undefined ? { label: payload.label.trim() } : {}),
      ...(payload.pattern !== undefined ? { pattern: payload.pattern.trim() } : {}),
      ...(payload.matchType ? { matchType: payload.matchType } : {}),
      ...(payload.matchField ? { matchField: payload.matchField } : {}),
      ...(payload.categoryId ? { categoryId: payload.categoryId } : {}),
      ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    },
  });
};

export const deleteRule = async (
  tx: Prisma.TransactionClient,
  userId: string,
  ruleId: string,
): Promise<void> => {
  await tx.categorizationRule.delete({
    where: {
      id: ruleId,
      userId,
    },
  });
};
