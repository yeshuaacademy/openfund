import crypto from 'crypto';
import { normalizeAccountIdentifier, normalizeWhitespace } from '../../lib/import/normalizers';

const sanitizeText = (value: string | null | undefined): string => {
  if (!value) return '';
  return normalizeWhitespace(value).toLowerCase();
};

const sanitizeAccount = (value: string | null | undefined): string => {
  if (!value) return '';
  return normalizeAccountIdentifier(value);
};

const readNotificationField = (raw: Record<string, unknown> | null | undefined, key: string): string | null => {
  if (!raw) return null;
  const value = raw[key];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const nested = value as Record<string, unknown>;
    if ('columns' in nested && typeof nested.columns === 'object' && nested.columns) {
      const columns = nested.columns as Record<string, unknown>;
      if (typeof columns[key] === 'string') {
        return columns[key] as string;
      }
    }
  }
  return null;
};

const extractNotifications = (raw: Record<string, unknown> | null | undefined): string | null => {
  if (!raw) return null;
  const direct =
    readNotificationField(raw, 'Notifications') ??
    readNotificationField(raw, 'Notification') ??
    readNotificationField(raw, 'notifications');

  if (direct) {
    return direct;
  }

  if ('columns' in raw && typeof raw.columns === 'object' && raw.columns && !Array.isArray(raw.columns)) {
    const columns = raw.columns as Record<string, unknown>;
    const value = columns['Notifications'] ?? columns['Notification'];
    if (typeof value === 'string') {
      return value;
    }
  }

  return null;
};

export type ImportFingerprintInput = {
  accountIdentifier: string;
  date: Date;
  amountMinor: bigint;
  description: string;
  counterparty?: string | null;
  reference?: string | null;
  raw?: Record<string, unknown> | null;
};

export const buildImportFingerprint = ({
  accountIdentifier,
  date,
  amountMinor,
  description,
  counterparty,
  reference,
  raw,
}: ImportFingerprintInput): string => {
  const base = [
    sanitizeAccount(accountIdentifier),
    date.toISOString(),
    amountMinor.toString(),
    sanitizeText(description),
    sanitizeText(counterparty),
    sanitizeText(reference),
    sanitizeText(extractNotifications(raw) ?? null),
  ].join('|');

  return crypto.createHash('sha256').update(base).digest('hex');
};
