import type { Prisma, TransactionDirection } from '@prisma/client';
import { normalizeAccountIdentifier, normalizeWhitespace } from '../../lib/import/normalizers';

type Direction = TransactionDirection | 'credit' | 'debit';

const KEY_SEPARATOR = '\u0001';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readRawField = (rawRecord: Record<string, unknown>, key: string): unknown => {
  if (key in rawRecord && rawRecord[key] != null) {
    return rawRecord[key];
  }
  const columns = rawRecord.columns;
  if (isPlainObject(columns) && key in columns && columns[key] != null) {
    return columns[key];
  }
  return null;
};

export const normalizeComparableText = (value: string | null | undefined): string => {
  if (!value) return '';
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return '';
  return trimmed
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

const extractCounterpartyFromRaw = (raw: unknown): string | null => {
  if (!isPlainObject(raw)) return null;
  const direct =
    readRawField(raw, 'Counterparty') ??
    readRawField(raw, 'counterparty') ??
    readRawField(raw, 'IBAN') ??
    readRawField(raw, 'iban');
  if (typeof direct === 'string') {
    return direct;
  }
  return null;
};

const toSignedAmount = (amountMinor: bigint | null, direction?: Direction | null): {
  signed: string;
  absolute: string;
  direction: Direction | '';
} | null => {
  if (amountMinor == null) {
    return null;
  }
  const absoluteMinor = amountMinor < 0n ? amountMinor * -1n : amountMinor;
  const effectiveDirection: Direction =
    direction ?? (amountMinor < 0n ? 'debit' : ('credit' as Direction));
  const signedMinor = effectiveDirection === 'debit' ? absoluteMinor * -1n : absoluteMinor;
  return {
    signed: signedMinor.toString(),
    absolute: absoluteMinor.toString(),
    direction: effectiveDirection,
  };
};

export const extractNotificationFromRaw = (raw: unknown): string | null => {
  if (!isPlainObject(raw)) {
    return null;
  }
  const direct =
    readRawField(raw, 'Notifications') ??
    readRawField(raw, 'Notification') ??
    readRawField(raw, 'notifications');
  if (typeof direct === 'string') {
    return direct;
  }
  if (typeof direct === 'number') {
    return direct.toString();
  }
  return null;
};

export interface MatchableTransactionInput {
  description: string | null | undefined;
  amountMinor: bigint | null;
  direction?: Direction | null;
  accountIdentifier?: string | null;
  counterparty?: string | null;
  notifications?: string | null;
  raw?: Prisma.JsonValue | Record<string, unknown> | null;
}

export interface NormalizedMatchFields {
  description: string;
  signedAmountMinor: string;
  absoluteAmountMinor: string;
  direction: Direction | '';
  accountIdentifier: string;
  counterparty: string;
  notifications: string;
}

export const normalizeMatchableTransaction = (
  input: MatchableTransactionInput,
): NormalizedMatchFields | null => {
  const description = normalizeComparableText(input.description ?? '');
  if (!description) {
    return null;
  }

  const amountResult = toSignedAmount(input.amountMinor ?? null, input.direction);
  if (!amountResult) {
    return null;
  }

  const accountIdentifier = input.accountIdentifier
    ? normalizeAccountIdentifier(input.accountIdentifier)
    : '';

  let counterparty = normalizeComparableText(input.counterparty ?? '');
  if (!counterparty) {
    counterparty = normalizeComparableText(extractCounterpartyFromRaw(input.raw ?? null));
  }
  const notificationSource =
    input.notifications ?? extractNotificationFromRaw(input.raw ?? null) ?? '';
  const notifications = normalizeComparableText(notificationSource);

  return {
    description,
    signedAmountMinor: amountResult.signed,
    absoluteAmountMinor: amountResult.absolute,
    direction: amountResult.direction,
    accountIdentifier,
    counterparty,
    notifications,
  };
};

export interface LedgerMatchSource extends MatchableTransactionInput {
  transactionId: string;
  categoryId: string;
  createdAt: Date;
}

export interface LedgerMatchCandidate {
  transactionId: string;
  categoryId: string;
  normalized: NormalizedMatchFields;
  createdAt: Date;
}

export const buildLedgerMatchCandidates = (sources: LedgerMatchSource[]): LedgerMatchCandidate[] =>
  sources
    .map((source) => {
      const normalized = normalizeMatchableTransaction(source);
      if (!normalized) {
        return null;
      }
      return {
        transactionId: source.transactionId,
        categoryId: source.categoryId,
        normalized,
        createdAt: source.createdAt,
      };
    })
    .filter((candidate): candidate is LedgerMatchCandidate => Boolean(candidate));

type ExactMatchIndex = Map<string, LedgerMatchCandidate>;
type FuzzyMatchIndex = Map<string, LedgerMatchCandidate[]>;

const buildExactKey = (
  normalized: NormalizedMatchFields,
  options: { includeCounterparty: boolean; includeNotifications: boolean },
): string =>
  [
    normalized.description,
    normalized.signedAmountMinor,
    normalized.direction,
    normalized.accountIdentifier,
    options.includeCounterparty ? normalized.counterparty : '',
    options.includeNotifications ? normalized.notifications : '',
    options.includeCounterparty ? 'cp:1' : 'cp:0',
    options.includeNotifications ? 'nt:1' : 'nt:0',
  ].join(KEY_SEPARATOR);

const EXACT_KEY_VARIANTS: Array<{ includeCounterparty: boolean; includeNotifications: boolean }> = [
  { includeCounterparty: true, includeNotifications: true },
  { includeCounterparty: true, includeNotifications: false },
  { includeCounterparty: false, includeNotifications: true },
  { includeCounterparty: false, includeNotifications: false },
];

const buildExactKeyVariants = (normalized: NormalizedMatchFields): string[] => {
  const keys: string[] = [];
  EXACT_KEY_VARIANTS.forEach((variant) => {
    if (variant.includeCounterparty && !normalized.counterparty) {
      return;
    }
    if (variant.includeNotifications && !normalized.notifications) {
      return;
    }
    keys.push(buildExactKey(normalized, variant));
  });
  if (!keys.length) {
    keys.push(buildExactKey(normalized, { includeCounterparty: false, includeNotifications: false }));
  }
  return keys;
};

export const buildExactMatchIndex = (
  candidates: LedgerMatchCandidate[],
): ExactMatchIndex => {
  const index: ExactMatchIndex = new Map();
  candidates.forEach((candidate) => {
    const keys = buildExactKeyVariants(candidate.normalized);
    keys.forEach((key) => {
      const existing = index.get(key);
      if (!existing || candidate.createdAt > existing.createdAt) {
        index.set(key, candidate);
      }
    });
  });
  return index;
};

export const findExactLedgerMatch = (
  normalized: NormalizedMatchFields,
  index: ExactMatchIndex,
): LedgerMatchCandidate | null => {
  const keys = buildExactKeyVariants(normalized);
  for (const key of keys) {
    const match = index.get(key);
    if (match) {
      return match;
    }
  }
  return null;
};

const buildFuzzyKey = (
  normalized: NormalizedMatchFields,
  counterpartyOverride?: string,
): string =>
  [normalized.accountIdentifier, counterpartyOverride ?? normalized.counterparty, normalized.absoluteAmountMinor].join(
    KEY_SEPARATOR,
  );

export const buildFuzzyMatchIndex = (
  candidates: LedgerMatchCandidate[],
): FuzzyMatchIndex => {
  const index: FuzzyMatchIndex = new Map();
  candidates.forEach((candidate) => {
    const specificKey = buildFuzzyKey(candidate.normalized);
    const specificBucket = index.get(specificKey) ?? [];
    specificBucket.push(candidate);
    index.set(specificKey, specificBucket);

    if (candidate.normalized.counterparty) {
      const fallbackKey = buildFuzzyKey(candidate.normalized, '');
      const fallbackBucket = index.get(fallbackKey) ?? [];
      fallbackBucket.push(candidate);
      index.set(fallbackKey, fallbackBucket);
    }
  });
  return index;
};

const tokenize = (value: string): string[] =>
  value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

export const jaccardSimilarity = (a: string, b: string): number => {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (!tokensA.size && !tokensB.size) {
    return 1;
  }
  let intersection = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) {
      intersection += 1;
    }
  });
  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
};

export const findFuzzyLedgerMatch = (
  normalizedImport: NormalizedMatchFields,
  index: FuzzyMatchIndex,
  threshold = 0.8,
): LedgerMatchCandidate | null => {
  const keys: string[] = [];
  if (normalizedImport.counterparty) {
    keys.push(buildFuzzyKey(normalizedImport));
  }
  keys.push(buildFuzzyKey(normalizedImport, ''));

  let bucket: LedgerMatchCandidate[] | undefined;
  for (const key of keys) {
    if (key && index.has(key)) {
      bucket = index.get(key);
      if (bucket?.length) {
        break;
      }
    }
  }

  if (!bucket || !bucket.length) {
    return null;
  }

  let best: { candidate: LedgerMatchCandidate; score: number } | null = null;

  bucket.forEach((candidate) => {
    const descriptionScore = jaccardSimilarity(
      normalizedImport.description,
      candidate.normalized.description,
    );
    const notificationScore = jaccardSimilarity(
      normalizedImport.notifications,
      candidate.normalized.notifications,
    );

    const combined =
      candidate.normalized.notifications || normalizedImport.notifications
        ? (descriptionScore + notificationScore) / 2
        : descriptionScore;

    if (combined >= threshold) {
      if (!best || combined > best.score) {
        best = { candidate, score: combined };
      } else if (best && combined === best.score) {
        if (candidate.createdAt > best.candidate.createdAt) {
          best = { candidate, score: combined };
        }
      }
    }
  });

  return best?.candidate ?? null;
};
