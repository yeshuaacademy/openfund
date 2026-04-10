import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import prisma from '@/libs/prisma';

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID ?? 'demo-user';
const SHEET_NAME = 'transacties 2025';
const HEADERS = [
  'Date',
  'Name / Description',
  'Account',
  'Counterparty',
  'Code',
  'Debit/credit',
  'Amount (EUR)',
  'Transaction type',
  'Categorie',
  'bestemming',
  'Notifications',
];

type RawRecord = Record<string, unknown>;

const ensureRawRecord = (value: unknown): RawRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as RawRecord;
};

const readRawValue = (raw: RawRecord | null, key: string): string | null => {
  if (!raw) return null;
  const fromRecord = raw[key];
  const columns = ensureRawRecord(raw.columns);
  const fromColumns = columns ? columns[key] : undefined;
  const candidate = fromRecord ?? fromColumns;
  if (candidate == null) {
    return null;
  }
  if (typeof candidate === 'string') {
    return candidate;
  }
  if (typeof candidate === 'number') {
    if (Number.isNaN(candidate)) return null;
    return candidate.toString();
  }
  if (typeof candidate === 'boolean') {
    return candidate ? 'true' : 'false';
  }
  return null;
};

const formatDateAsNumeric = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
};

const parseAmount = (value: string | null): number | null => {
  if (!value) return null;
  const normalized = value.replace(/[^\d.,-]/g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
};

const splitCategoryLabel = (
  value?: string | null,
): { main: string | null; sub: string | null } => {
  if (!value) {
    return { main: null, sub: null };
  }
  const parts = value.split(' — ');
  if (parts.length === 1) {
    const trimmed = parts[0]!.trim();
    const safe = trimmed.length ? trimmed : null;
    return { main: safe, sub: safe };
  }
  const main = parts[0]!.trim();
  const sub = parts.slice(1).join(' — ').trim();
  return {
    main: main.length ? main : null,
    sub: sub.length ? sub : main.length ? main : null,
  };
};

const deriveDebitCredit = (direction: string | null | undefined): 'Debit' | 'Credit' => {
  if (!direction) return 'Credit';
  return direction.toLowerCase().startsWith('debit') ? 'Debit' : 'Credit';
};

export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id') ?? DEFAULT_USER_ID;

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      categoryId: {
        not: null,
      },
    },
    include: {
      account: true,
      category: true,
    },
    orderBy: {
      date: 'asc',
    },
  });

  const rows = transactions.map((tx) => {
    const rawRecord = ensureRawRecord(tx.rawRow);
    const safeDate =
      readRawValue(rawRecord, 'Date') ??
      formatDateAsNumeric(tx.date instanceof Date ? tx.date : new Date(tx.date));
    const description =
      readRawValue(rawRecord, 'Name / Description') ?? tx.description ?? '';
    const accountValue =
      readRawValue(rawRecord, 'Account') ??
      tx.account?.identifier ??
      tx.account?.name ??
      '';
    const counterparty =
      readRawValue(rawRecord, 'Counterparty') ??
      tx.counterparty ??
      tx.reference ??
      '';
    const code = readRawValue(rawRecord, 'Code') ?? '';
    const debitCredit = readRawValue(rawRecord, 'Debit/credit') ?? deriveDebitCredit(tx.direction);
    const rawAmount = parseAmount(readRawValue(rawRecord, 'Amount (EUR)'));
    const amount =
      rawAmount ?? Math.abs(Number(tx.amountMinor) / 100);
    const transactionType =
      readRawValue(rawRecord, 'Transaction type') ?? tx.source ?? 'Unknown';
    const rawCategory = readRawValue(rawRecord, 'Categorie');
    const rawSubCategory = readRawValue(rawRecord, 'bestemming');
    const derivedCategories = splitCategoryLabel(tx.category?.name ?? null);
    const mainCategory = rawCategory ?? derivedCategories.main ?? '';
    const subCategory = rawSubCategory ?? derivedCategories.sub ?? '';
    const notifications =
      readRawValue(rawRecord, 'Notifications') ??
      tx.reference ??
      tx.description ??
      '';

    return [
      safeDate,
      description,
      accountValue,
      counterparty,
      code,
      debitCredit,
      Number(amount.toFixed(2)),
      transactionType,
      mainCategory,
      subCategory,
      notifications,
    ];
  });

  const worksheetData = [HEADERS, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const today = new Date().toISOString().split('T')[0];

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="finance-admin-ledger-backup-${today}.xlsx"`,
    },
  });
}
