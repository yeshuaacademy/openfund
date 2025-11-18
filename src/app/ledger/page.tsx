'use client';

import Link from 'next/link';
import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { UploadCsvButton } from '@/components/ledger/UploadCsvButton';
import { ReconciliationCard } from '@/components/ledger/ReconciliationCard';
import {
  LedgerTable,
  DEFAULT_LEDGER_COLUMN_VISIBILITY,
  LedgerColumnVisibility,
} from '@/components/ledger/LedgerTable';
import { useLedger } from '@/context/ledger-context';
import type { Category, CategoryTree, LedgerTransaction } from '@/context/ledger-context';
import { CalendarDays, Download, Settings, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/ui/PageHeader';
import { Section } from '@/ui/Section';
import { Card } from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/helpers/utils';
import { DEFAULT_LOCALE } from '@/constants/intl';

const COLORS = ['#2970FF', '#5B9CFF', 'rgba(91,156,255,0.45)', 'rgba(255,255,255,0.35)', 'rgba(41,112,255,0.25)'];
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const euro = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

const monthFormatter = new Intl.DateTimeFormat('en-GB', { month: 'short' });
const monthNameFormatter = new Intl.DateTimeFormat('en-GB', { month: 'long' });
const displayDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  id: String(index + 1),
  name: monthNameFormatter.format(new Date(Date.UTC(2020, index, 1))),
}));
const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;
type AccountFilterKey = 'all' | 'yeshua' | 'vila' | 'savings';

const ACCOUNT_FILTER_CONFIG: Record<
  AccountFilterKey,
  { label: string; matchLabels?: string[]; matchIdentifiers?: string[] }
> = {
  all: { label: 'All accounts' },
  yeshua: {
    label: 'Yeshua Academy',
    matchLabels: ['Yeshua Academy'],
    matchIdentifiers: ['NL89INGB0006369960'],
  },
  vila: {
    label: 'Vila Solidária',
    matchLabels: ['Vila Solidária'],
    matchIdentifiers: ['R 951-98945', 'R95198945'],
  },
  savings: {
    label: 'Yeshua Academy Savings',
    matchLabels: ['Yeshua Academy Savings'],
    matchIdentifiers: ['F 951-98948', 'F95198948'],
  },
};

const ACCOUNT_FILTER_OPTIONS: Array<{ key: AccountFilterKey; label: string }> = [
  { key: 'yeshua', label: ACCOUNT_FILTER_CONFIG.yeshua.label },
  { key: 'vila', label: ACCOUNT_FILTER_CONFIG.vila.label },
  { key: 'savings', label: ACCOUNT_FILTER_CONFIG.savings.label },
  { key: 'all', label: ACCOUNT_FILTER_CONFIG.all.label },
];

const normalizeAccountValue = (value?: string | null) => value?.trim().toLowerCase() ?? '';

const matchesAccountFilter = (
  tx: Pick<LedgerTransaction, 'accountLabel' | 'accountIdentifier'>,
  filter: AccountFilterKey,
) => {
  if (filter === 'all') {
    return true;
  }
  const config = ACCOUNT_FILTER_CONFIG[filter];
  if (!config) {
    return false;
  }

  const label = normalizeAccountValue(tx.accountLabel);
  const identifier = normalizeAccountValue(tx.accountIdentifier);
  const labelMatches = (config.matchLabels ?? []).some(
    (candidate) => normalizeAccountValue(candidate) === label && Boolean(candidate),
  );
  const identifierMatches = (config.matchIdentifiers ?? []).some(
    (candidate) => normalizeAccountValue(candidate) === identifier && Boolean(candidate),
  );

  return labelMatches || identifierMatches;
};

const filterTransactionsByAccount = (
  transactions: LedgerTransaction[],
  selected: AccountFilterKey,
  allowFallbackForYeshua = false,
) => {
  if (selected === 'all') {
    return transactions;
  }

  if (selected === 'yeshua' && allowFallbackForYeshua) {
    return transactions.filter((tx) => {
      if (matchesAccountFilter(tx, 'yeshua')) {
        return true;
      }
      if (!tx.accountLabel && !tx.accountIdentifier) {
        return true;
      }
      return !matchesAccountFilter(tx, 'vila') && !matchesAccountFilter(tx, 'savings');
    });
  }

  return transactions.filter((tx) => matchesAccountFilter(tx, selected));
};

const ACCOUNT_COLOR_MAP: Record<AccountFilterKey, string> = {
  all: '#2970FF',
  yeshua: '#5B9CFF',
  vila: 'rgba(91,156,255,0.55)',
  savings: 'rgba(255,255,255,0.45)',
};

type AccountBreakdownEntry = {
  key: AccountFilterKey;
  label: string;
  income: number;
  expenses: number;
  net: number;
  count: number;
};

const getTransactionDirection = (
  tx: Pick<LedgerTransaction, 'direction' | 'amount'>,
): 'debit' | 'credit' => {
  const raw = (tx.direction ?? '').toString().trim().toLowerCase();
  const debitTokens = ['debit', 'db', 'd', 'af', 'withdrawal', 'out', 'expense'];
  const creditTokens = ['credit', 'cr', 'c', 'bij', 'deposit', 'in', 'income'];

  if (debitTokens.some((token) => raw.startsWith(token))) {
    return 'debit';
  }
  if (creditTokens.some((token) => raw.startsWith(token))) {
    return 'credit';
  }
  return tx.amount < 0 ? 'debit' : 'credit';
};

const isDebitTransaction = (tx: Pick<LedgerTransaction, 'direction' | 'amount'>) =>
  getTransactionDirection(tx) === 'debit';

const getAbsoluteAmount = (tx: Pick<LedgerTransaction, 'amount'>) => Math.abs(tx.amount);

const COLUMN_STORAGE_KEY = 'ledger-column-visibility-v1';
const COLUMN_DEFINITIONS: Array<{ key: keyof LedgerColumnVisibility; label: string }> = [
  { key: 'date', label: 'Date' },
  { key: 'account', label: 'Account' },
  { key: 'description', label: 'Payee' },
  { key: 'amount', label: 'Amount' },
  { key: 'category', label: 'Category' },
  { key: 'balance', label: 'Running balance' },
];

type BreakdownEntry = {
  label: string;
  value: number;
  percent: number;
  color: string;
};

type LineDatum = {
  label: string;
  current: number;
  previous: number;
};

type CashFlowDatum = {
  label: string;
  income: number;
  expenses: number;
  net: number;
};

type PlannedSummary = {
  label: string;
  planned: number;
  actual: number;
  delta: number;
  positive: boolean;
};

type SummaryValues = {
  total: number;
  reviewCount: number;
  autoCategorized: number;
  totalAmount: number;
};

type CategoryAggregate = {
  mainId: string;
  mainName: string;
  totalIncome: number;
  totalExpenses: number;
  children: Array<{
    categoryId: string;
    categoryName: string;
    totalIncome: number;
    totalExpenses: number;
  }>;
};

const REVIEW_MAIN_ID = 'cat-review';
const REVIEW_SUB_ID = 'sub-review-needs-category';

export default function LedgerPage() {
  return (
    <Suspense fallback={<LedgerPageSkeleton />}>
      <LedgerPageContent />
    </Suspense>
  );
}

function LedgerPageSkeleton() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#050B18] text-white/60">
      Loading ledger…
    </div>
  );
}

function LedgerPageContent() {
  const { transactions, summary, categoryTree } = useLedger();
  const approvedTransactions = useMemo(
    () => transactions.filter((tx) => tx.classificationSource === 'manual'),
    [transactions],
  );
  const searchParams = useSearchParams();
  const view = (searchParams?.get('view') ?? 'dashboard') as 'dashboard' | 'transactions' | 'cashflow' | 'overview';
  const [overviewExportHandler, setOverviewExportHandler] = useState<(() => void) | null>(null);
  const [cashflowExportHandler, setCashflowExportHandler] = useState<(() => void) | null>(null);
  const [dashboardExportHandler, setDashboardExportHandler] = useState<(() => void) | null>(null);
  const registerOverviewExportHandler = useCallback((handler: (() => void) | null) => {
    setOverviewExportHandler(() => handler);
  }, []);
  const registerCashflowExportHandler = useCallback((handler: (() => void) | null) => {
    setCashflowExportHandler(() => handler);
  }, []);
  const registerDashboardExportHandler = useCallback((handler: (() => void) | null) => {
    setDashboardExportHandler(() => handler);
  }, []);

  useEffect(() => {
    if (view !== 'overview') {
      setOverviewExportHandler(null);
    }
  }, [view]);

  useEffect(() => {
    if (view !== 'cashflow') {
      setCashflowExportHandler(null);
    }
  }, [view]);

  useEffect(() => {
    if (view !== 'dashboard') {
      setDashboardExportHandler(null);
    }
  }, [view]);

  const dashboardBreakdown = useMemo(() => buildSpendingBreakdown(approvedTransactions), [approvedTransactions]);
  const dashboardLines = useMemo(() => buildLineData(approvedTransactions), [approvedTransactions]);
  const dashboardCashFlow = useMemo(() => buildCashFlowData(approvedTransactions), [approvedTransactions]);
  const dashboardPlanned = useMemo(() => buildPlannedSummary(approvedTransactions), [approvedTransactions]);

  const { title, subtitle, actions } = useMemo(() => {
    switch (view) {
      case 'overview':
        return {
          title: 'Monthly Overview',
          subtitle: 'Review income and spending by category for any month or custom range.',
          actions: (
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transform transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/10 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => overviewExportHandler?.()}
                disabled={!overviewExportHandler}
              >
                <Download className="h-4 w-4" /> Export
              </button>
            </div>
          ),
        };
      case 'transactions':
        return {
          title: 'Transactions',
          subtitle: 'Browse, filter, and export every line in your ledger.',
          actions: (
            <div className="flex items-center gap-3">
              <a
                href="/api/ledger/export-xlsx"
                className="inline-flex items-center gap-2 rounded-xl border border-[#2970FF] bg-[#2970FF] px-4 py-2 text-sm font-medium text-white transform transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#1f5de0] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                role="button"
              >
                <Download className="h-4 w-4" /> Export
              </a>
            </div>
          ),
        };
      case 'cashflow':
        return {
          title: 'Cash Flow',
          subtitle: 'Visualise net income trends across months to stay ahead.',
          actions: (
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-[#2970FF] bg-[#2970FF] px-4 py-2 text-sm font-medium text-white transform transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#1f5de0] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => cashflowExportHandler?.()}
                disabled={!cashflowExportHandler}
              >
                <Download className="h-4 w-4" /> Export
              </button>
            </div>
          ),
        };
      default:
        return {
          title: 'Performance Summary',
          subtitle: 'Visualize how your ledger is performing at a glance.',
          actions: (
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transform transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/10 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => dashboardExportHandler?.()}
                disabled={!dashboardExportHandler}
              >
                <Download className="h-4 w-4" /> Export
              </button>
            </div>
          ),
        };
    }
  }, [view, overviewExportHandler, cashflowExportHandler, dashboardExportHandler]);

  const content = useMemo(() => {
    if (view === 'transactions') {
      return <TransactionsView transactions={transactions} categoryTree={categoryTree} />;
    }
    if (view === 'cashflow') {
      return (
        <CashFlowView cashflow={dashboardCashFlow} onRegisterExportHandler={registerCashflowExportHandler} />
      );
    }
    if (view === 'overview') {
      return (
        <MonthlyOverviewView
          transactions={approvedTransactions}
          categoryTree={categoryTree}
          onRegisterExportHandler={registerOverviewExportHandler}
        />
      );
    }
    return (
      <DashboardView
        summary={summary}
        spendingBreakdown={dashboardBreakdown}
        comparison={dashboardLines}
        cashflow={dashboardCashFlow}
        planned={dashboardPlanned}
        onRegisterExportHandler={registerDashboardExportHandler}
      />
    );
  }, [
    view,
    transactions,
    categoryTree,
    summary,
    dashboardBreakdown,
    dashboardLines,
    dashboardCashFlow,
    dashboardPlanned,
  ]);

  return (
    <DashboardShell title={title} subtitle={subtitle} actions={actions}>
      {content}
    </DashboardShell>
  );
}

function DashboardView({
  summary,
  spendingBreakdown,
  comparison,
  cashflow,
  planned,
  onRegisterExportHandler,
}: {
  summary: SummaryValues;
  spendingBreakdown: BreakdownEntry[];
  comparison: LineDatum[];
  cashflow: CashFlowDatum[];
  planned: PlannedSummary[];
  onRegisterExportHandler?: (handler: (() => void) | null) => void;
}) {
  const exportHandler = useCallback(() => {
    if (typeof window === 'undefined') return;
    const html = buildDashboardExportHtml({
      breakdown: spendingBreakdown,
      comparison,
      cashflow,
      planned,
      summary,
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `performance-summary-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [spendingBreakdown, comparison, cashflow, planned, summary]);

  useEffect(() => {
    if (!onRegisterExportHandler) return;
    onRegisterExportHandler(exportHandler);
    return () => onRegisterExportHandler(null);
  }, [exportHandler, onRegisterExportHandler]);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.5fr,2fr]">
        <Section title="Spending Breakdown" description="Where your money goes" contentClassName="space-y-4">
          <SpendingBreakdownCard data={spendingBreakdown} />
        </Section>
        <Section contentClassName="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-sm font-medium text-white">Spending Comparison</h2>
              <p className="text-xs text-white/60">Track this period against the previous</p>
            </div>
            <button className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
              This Month vs Last Month <CalendarDays className="h-3.5 w-3.5" />
            </button>
          </div>
          <SpendingComparisonChart data={comparison} />
        </Section>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Section title="Planned Income & Expenses" description="Compare planned vs actual" contentClassName="space-y-4">
          <PlannedIncomeExpensesCard data={planned} />
        </Section>
        <Section title="Cash Flow" description="Net income across the last six months" contentClassName="space-y-4">
          <CashFlowChart data={cashflow} />
        </Section>
      </section>
    </div>
  );
}

function MonthlyOverviewView({
  transactions,
  categoryTree,
  onRegisterExportHandler,
}: {
  transactions: LedgerTransaction[];
  categoryTree: CategoryTree;
  onRegisterExportHandler?: (handler: (() => void) | null) => void;
}) {
  const latestDate = useMemo(() => {
    let latest: number | null = null;
    transactions.forEach((tx) => {
      const time = new Date(tx.date).getTime();
      if (Number.isNaN(time)) return;
      if (latest === null || time > latest) {
        latest = time;
      }
    });
    return latest ? new Date(latest) : null;
  }, [transactions]);

  const defaultMonth = latestDate ? latestDate.getUTCMonth() + 1 : new Date().getUTCMonth() + 1;
  const defaultYear = latestDate ? latestDate.getUTCFullYear() : new Date().getUTCFullYear();

  const defaultRange = useMemo(() => {
    const end = latestDate ? new Date(latestDate) : new Date();
    const start = new Date(end.getTime() - 29 * MILLISECONDS_IN_DAY);
    return {
      start: formatDateInput(start),
      end: formatDateInput(end),
    };
  }, [latestDate]);

  const [mode, setMode] = useState<'month' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState<number>(defaultMonth);
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [customFrom, setCustomFrom] = useState<string>(defaultRange.start);
  const [customTo, setCustomTo] = useState<string>(defaultRange.end);
  const [accountFilter, setAccountFilter] = useState<AccountFilterKey>('yeshua');

  useEffect(() => {
    setSelectedMonth(defaultMonth);
    setSelectedYear(defaultYear);
  }, [defaultMonth, defaultYear]);

  useEffect(() => {
    setCustomFrom(defaultRange.start);
    setCustomTo(defaultRange.end);
  }, [defaultRange.start, defaultRange.end]);

  const availableYears = useMemo(() => {
    const unique = new Set<number>();
    transactions.forEach((tx) => {
      if (Number.isFinite(tx.ledgerYear)) {
        unique.add(tx.ledgerYear);
      }
    });
    if (unique.size === 0) {
      unique.add(defaultYear);
    }
    return Array.from(unique).sort((a, b) => b - a);
  }, [transactions, defaultYear]);

  const periodTransactions = useMemo(() => {
    if (!transactions.length) return [];

    let startTime = Number.NEGATIVE_INFINITY;
    let endTime = Number.POSITIVE_INFINITY;

    if (mode === 'month') {
      startTime = Date.UTC(selectedYear, selectedMonth - 1, 1);
      endTime = Date.UTC(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
    } else {
      if (customFrom) {
        const parsed = Date.parse(`${customFrom}T00:00:00Z`);
        if (!Number.isNaN(parsed)) {
          startTime = parsed;
        }
      }
      if (customTo) {
        const parsed = Date.parse(`${customTo}T23:59:59Z`);
        if (!Number.isNaN(parsed)) {
          endTime = parsed;
        }
      }
    }

    return transactions.filter((tx) => {
      const time = new Date(tx.date).getTime();
      if (Number.isNaN(time)) return false;
      return time >= startTime && time <= endTime;
    });
  }, [transactions, mode, selectedMonth, selectedYear, customFrom, customTo]);

  const filteredTransactions = useMemo(
    () => filterTransactionsByAccount(periodTransactions, accountFilter, true),
    [periodTransactions, accountFilter],
  );

  const totals = useMemo(() => {
    let income = 0;
    let expenses = 0;
    filteredTransactions.forEach((tx) => {
      if (isDebitTransaction(tx)) {
        expenses += getAbsoluteAmount(tx);
      } else {
        income += getAbsoluteAmount(tx);
      }
    });
    return {
      income,
      expenses,
      net: income - expenses,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  const aggregates = useMemo(
    () => buildCategoryAggregates(filteredTransactions, categoryTree),
    [filteredTransactions, categoryTree],
  );

  const periodLabel = useMemo(() => {
    if (mode === 'month') {
      const date = new Date(Date.UTC(selectedYear, selectedMonth - 1, 1));
      return `${monthNameFormatter.format(date)} ${selectedYear}`;
    }
    const hasStart = Boolean(customFrom);
    const hasEnd = Boolean(customTo);
    if (hasStart && hasEnd) {
      return `${formatDisplayDate(customFrom)} – ${formatDisplayDate(customTo)}`;
    }
    if (hasStart) {
      return `From ${formatDisplayDate(customFrom)}`;
    }
    if (hasEnd) {
      return `Until ${formatDisplayDate(customTo)}`;
    }
    return 'All transactions';
  }, [mode, selectedMonth, selectedYear, customFrom, customTo]);

  const showAccountBreakdown = accountFilter === 'all';
  const accountLabel = ACCOUNT_FILTER_CONFIG[accountFilter]?.label ?? ACCOUNT_FILTER_CONFIG.all.label;

  const accountBreakdown = useMemo(() => {
    const baseOrder: AccountFilterKey[] = ['yeshua', 'vila', 'savings'];
    const baseMap = new Map<AccountFilterKey, AccountBreakdownEntry>();

    baseOrder.forEach((key) => {
      baseMap.set(key, {
        key,
        label: ACCOUNT_FILTER_CONFIG[key].label,
        income: 0,
        expenses: 0,
        net: 0,
        count: 0,
      });
    });

    const identifyAccount = (transaction: LedgerTransaction): AccountFilterKey => {
      for (const key of baseOrder) {
        if (matchesAccountFilter(transaction, key)) {
          return key;
        }
      }
      return 'yeshua';
    };

    periodTransactions.forEach((tx) => {
      const bucketKey = identifyAccount(tx);
      const bucket = baseMap.get(bucketKey);
      if (!bucket) return;
      if (isDebitTransaction(tx)) {
        const expense = getAbsoluteAmount(tx);
        bucket.expenses += expense;
        bucket.net -= expense;
      } else {
        const incomeValue = getAbsoluteAmount(tx);
        bucket.income += incomeValue;
        bucket.net += incomeValue;
      }
      bucket.count += 1;
    });

    return baseOrder
      .map((key) => baseMap.get(key)!)
      .filter((entry) => entry.count > 0 || entry.income > 0 || entry.expenses > 0);
  }, [periodTransactions]);

  const heroTotals = useMemo(() => {
    if (accountFilter === 'all') {
      return accountBreakdown.reduce(
        (acc, entry) => {
          acc.income += entry.income;
          acc.expenses += entry.expenses;
          acc.net += entry.net;
          acc.count += entry.count;
          return acc;
        },
        { income: 0, expenses: 0, net: 0, count: 0 },
      );
    }
    return totals;
  }, [accountFilter, totals, accountBreakdown]);

  const totalTransactions = heroTotals.count;
  const totalIncome = heroTotals.income;
  const totalExpenses = heroTotals.expenses;
  const totalNet = heroTotals.net;

  const showCategoryBreakdown = accountFilter !== 'all';

  const handleExport = useCallback(() => {
    if (typeof window === 'undefined') return;
    const identifier =
      mode === 'month'
        ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
        : `${customFrom || 'start'}-${customTo || 'end'}`;
    const html = buildMonthlyOverviewExportHtml({
      accountLabel,
      periodLabel,
      mode,
      selectedMonth,
      selectedYear,
      customFrom,
      customTo,
      transactionsCount: totalTransactions,
      totals: { income: totalIncome, expenses: totalExpenses, net: totalNet },
      aggregates,
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileAccount = sanitizeForFilename(accountLabel) || 'ledger';
    const fileIdentifier = sanitizeForFilename(identifier) || 'period';
    link.download = `monthly-overview-${fileAccount}-${fileIdentifier}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [
    accountLabel,
    periodLabel,
    mode,
    selectedMonth,
    selectedYear,
    customFrom,
    customTo,
    totalTransactions,
    totalIncome,
    totalExpenses,
    totalNet,
    aggregates,
  ]);

  useEffect(() => {
    if (!onRegisterExportHandler) return;
    onRegisterExportHandler(handleExport);
    return () => onRegisterExportHandler(null);
  }, [handleExport, onRegisterExportHandler]);

  return (
    <div className="space-y-6">
      <Section contentClassName="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Accounts</span>
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_FILTER_OPTIONS.map(({ key, label }) => {
                const selected = accountFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAccountFilter(key)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2970FF]/80',
                      selected
                        ? 'border-[#2970FF]/80 bg-[#2970FF]/90 text-white shadow-[0_12px_35px_-18px_rgba(41,112,255,0.85)]'
                        : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10',
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          {accountFilter !== 'all' ? (
            <button
              type="button"
              onClick={() => setAccountFilter('all')}
              className="inline-flex w-full max-w-[160px] items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2970FF]/80 lg:w-auto"
            >
              Clear selection
            </button>
          ) : null}
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              label="View mode"
              value={mode}
              onChange={(value) => setMode(value as 'month' | 'custom')}
              options={[
                { id: 'month', name: 'Month' },
                { id: 'custom', name: 'Custom range' },
              ]}
            />
            {mode === 'month' ? (
              <>
                <FilterSelect
                  label="Month"
                  value={String(selectedMonth)}
                  onChange={(value) => setSelectedMonth(Number(value))}
                  options={MONTH_OPTIONS}
                />
                <FilterSelect
                  label="Year"
                  value={String(selectedYear)}
                  onChange={(value) => setSelectedYear(Number(value))}
                  options={availableYears.map((year) => ({ id: String(year), name: String(year) }))}
                />
              </>
            ) : (
              <>
                <DateInput label="From" value={customFrom} onChange={setCustomFrom} max={customTo || undefined} />
                <DateInput label="Until" value={customTo} onChange={setCustomTo} min={customFrom || undefined} />
              </>
            )}
          </div>
          <div className="min-w-[160px] rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Transactions</p>
            <p className="text-2xl font-semibold">
              {heroTotals.count.toLocaleString(DEFAULT_LOCALE)}
            </p>
          </div>
        </div>
      </Section>

      <Section title="Period Summary" description={periodLabel} contentClassName="space-y-6">
        <OverviewHeroTotals totals={heroTotals} />
        {!filteredTransactions.length ? (
          <p className="text-sm text-white/60">No transactions found for this period.</p>
        ) : null}
      </Section>

      {showAccountBreakdown ? (
        <Section
          title="Account Contribution"
          description="Share of total income and expenses in this period."
          contentClassName="space-y-0"
        >
          <AccountBreakdownChart breakdown={accountBreakdown} />
        </Section>
      ) : null}

      {showCategoryBreakdown ? (
        <Section
          title="Category Breakdown"
          description="Income and expenses grouped by main and sub category."
          contentClassName="space-y-4"
        >
          <MonthlyTotalsTable aggregates={aggregates} totals={totals} />
        </Section>
      ) : null}
    </div>
  );
}

function OverviewHeroTotals({
  totals,
}: {
  totals: { income: number; expenses: number; net: number; count: number };
}) {
  const netTone: 'positive' | 'negative' | 'neutral' = totals.net > 0 ? 'positive' : totals.net < 0 ? 'negative' : 'neutral';
  const cards: Array<{
    key: string;
    label: string;
    value: string;
    tone: 'positive' | 'negative' | 'neutral';
    sublabel?: string;
  }> = [
    {
      key: 'income',
      label: 'Total Income',
      value: euro.format(totals.income),
      tone: 'positive',
    },
    {
      key: 'expenses',
      label: 'Total Expenses',
      value: euro.format(totals.expenses),
      tone: 'negative',
    },
    {
      key: 'net',
      label: 'Net Change',
      value: euro.format(totals.net),
      tone: netTone,
      sublabel: `${totals.count.toLocaleString(DEFAULT_LOCALE)} transactions`,
    },
  ];

  const toneText: Record<'positive' | 'negative' | 'neutral', string> = {
    positive: 'text-emerald-400',
    negative: 'text-rose-400',
    neutral: 'text-white',
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map(({ key, label, value, tone, sublabel }) => (
        <Card key={key} className="relative overflow-hidden border-white/5 bg-[#09142A] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">{label}</p>
          <p className={cn('mt-3 text-3xl font-semibold tracking-tight md:text-4xl', toneText[tone])}>{value}</p>
          {sublabel ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-white/60">{sublabel}</p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

function AccountBreakdownChart({ breakdown }: { breakdown: AccountBreakdownEntry[] }) {
  const entries = breakdown;
  const hasActivity = entries.some((entry) => entry.income > 0 || entry.expenses > 0);

  const labelLookup = useMemo(() => {
    return entries.reduce<Record<string, string>>((acc, entry) => {
      acc[entry.key] = entry.label;
      return acc;
    }, {});
  }, [entries]);

  const chartData = useMemo(() => {
    const incomeRow: Record<string, number | string> = { name: 'Income' };
    const expenseRow: Record<string, number | string> = { name: 'Expenses' };

    entries.forEach((entry) => {
      incomeRow[entry.key] = entry.income;
      expenseRow[entry.key] = entry.expenses;
    });
    return [incomeRow, expenseRow];
  }, [entries]);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.6fr,1fr]">
      <div className="flex flex-col">
        <div className="flex-1 rounded-2xl border border-white/10 bg-[#050B18] p-4">
          {hasActivity ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} barSize={28} margin={{ top: 16, right: 16, left: 32, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.6)" tickLine={false} axisLine={false} />
                <YAxis
                  stroke="rgba(255,255,255,0.5)"
                  tickFormatter={(value) => euro.format(value as number)}
                  tickLine={false}
                  axisLine={false}
                />
                <RechartsTooltip
                  formatter={(value, name) => [euro.format(value as number), labelLookup[name as string] ?? name]}
                  labelFormatter={(label) => `${label}`}
                  contentStyle={{
                    background: '#050B18',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  cursor={false}
                />
                {entries.map((entry) => (
                  <Bar
                    key={entry.key}
                    dataKey={entry.key}
                    name={entry.label}
                    stackId="total"
                    fill={ACCOUNT_COLOR_MAP[entry.key]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-white/50">
              No account activity for this period.
            </div>
          )}
        </div>
      </div>
      <div className="space-y-4 rounded-2xl border border-white/10 bg-[#050B18] p-4">
        {entries.map((entry) => (
          <div key={entry.key} className="flex flex-col gap-3 rounded-xl border border-white/5 bg-[#060F1F]/80 p-4">
            <div className="flex items-center justify-between text-sm font-semibold text-white">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ACCOUNT_COLOR_MAP[entry.key] }} />
                {entry.label}
              </span>
              <span className="text-xs font-medium text-white/60">
                {entry.count.toLocaleString(DEFAULT_LOCALE)} {entry.count === 1 ? 'transaction' : 'transactions'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs uppercase tracking-wide text-white/60">
              <div>
                <p>Income</p>
                <p className="mt-1 text-sm font-semibold text-emerald-400">{euro.format(entry.income)}</p>
              </div>
              <div>
                <p>Expenses</p>
                <p className="mt-1 text-sm font-semibold text-rose-400">{euro.format(entry.expenses)}</p>
              </div>
              <div>
                <p>Net</p>
                <p className={cn('mt-1 text-sm font-semibold', entry.net >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                  {euro.format(entry.net)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OverviewSummaryCard({
  label,
  value,
  tone,
  isCurrency = true,
}: {
  label: string;
  value: number;
  tone: 'positive' | 'negative' | 'neutral';
  isCurrency?: boolean;
}) {
  const toneClass =
    tone === 'positive' ? 'text-emerald-400' : tone === 'negative' ? 'text-rose-400' : 'text-white';
  const formattedValue = isCurrency ? euro.format(value) : value.toLocaleString(DEFAULT_LOCALE);

  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/50">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{formattedValue}</p>
    </Card>
  );
}

function MonthlyTotalsTable({
  aggregates,
  totals,
}: {
  aggregates: CategoryAggregate[];
  totals: { income: number; expenses: number; net: number };
}) {
  if (!aggregates.length) {
    return <p className="text-sm text-white/60">No categorized transactions to display for this period.</p>;
  }

  return (
    <Card className="overflow-hidden p-0">
      <table className="min-w-full divide-y divide-white/10 text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/60">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-white/70">Category</th>
            <th className="px-4 py-3 text-right font-semibold text-white/70">Income</th>
            <th className="px-4 py-3 text-right font-semibold text-white/70">Expenses</th>
            <th className="px-4 py-3 text-right font-semibold text-white/70">Net</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-white/80">
          {aggregates.map((main) => {
            const net = main.totalIncome - main.totalExpenses;
            return (
              <Fragment key={main.mainId}>
                <tr className="bg-white/5 text-white">
                  <td className="px-4 py-3 text-sm font-semibold">{main.mainName}</td>
                  <td className="px-4 py-3 text-right text-emerald-400">{euro.format(main.totalIncome)}</td>
                  <td className="px-4 py-3 text-right text-rose-400">{euro.format(main.totalExpenses)}</td>
                  <td className={`px-4 py-3 text-right ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {euro.format(net)}
                  </td>
                </tr>
                {main.children.map((child) => {
                  const childNet = child.totalIncome - child.totalExpenses;
                  return (
                    <tr key={`${main.mainId}-${child.categoryId}`} className="text-white/80">
                      <td className="px-4 py-2 pl-8">{child.categoryName}</td>
                      <td className="px-4 py-2 text-right text-emerald-400">{euro.format(child.totalIncome)}</td>
                      <td className="px-4 py-2 text-right text-rose-400">{euro.format(child.totalExpenses)}</td>
                      <td className={`px-4 py-2 text-right ${childNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {euro.format(childNet)}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot className="bg-white/5 text-sm font-semibold text-white">
          <tr>
            <td className="px-4 py-3">Grand Total</td>
            <td className="px-4 py-3 text-right text-emerald-400">{euro.format(totals.income)}</td>
            <td className="px-4 py-3 text-right text-rose-400">{euro.format(totals.expenses)}</td>
            <td className={`px-4 py-3 text-right ${totals.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {euro.format(totals.net)}
            </td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}

function TransactionsView({ transactions, categoryTree }: { transactions: LedgerTransaction[]; categoryTree: CategoryTree }) {
  const { assignCategory } = useLedger();
  const mainOptions = useMemo(() => [
    { id: 'all', name: 'All categories' },
    ...categoryTree.main.filter((cat) => cat.id !== REVIEW_MAIN_ID),
  ], [categoryTree.main]);

  const allSubOptions = useMemo(() => {
    return Object.entries(categoryTree.byParent)
      .filter(([parent]) => parent !== REVIEW_MAIN_ID)
      .flatMap(([, items]) => items.filter((item) => item.id !== REVIEW_SUB_ID));
  }, [categoryTree.byParent]);

  const latestDate = useMemo(() => {
    let latest: number | null = null;
    transactions.forEach((tx) => {
      const time = new Date(tx.date).getTime();
      if (Number.isNaN(time)) return;
      if (latest === null || time > latest) {
        latest = time;
      }
    });
    return latest ? new Date(latest) : null;
  }, [transactions]);

  const defaultMonth = latestDate ? latestDate.getUTCMonth() + 1 : new Date().getUTCMonth() + 1;
  const defaultYear = latestDate ? latestDate.getUTCFullYear() : new Date().getUTCFullYear();

  const defaultRange = useMemo(() => {
    const end = latestDate ? new Date(latestDate) : new Date();
    const start = new Date(end.getTime() - 29 * MILLISECONDS_IN_DAY);
    return {
      start: formatDateInput(start),
      end: formatDateInput(end),
    };
  }, [latestDate]);

  const [mainFilter, setMainFilter] = useState<string>('all');
  const [subFilter, setSubFilter] = useState<string>('all');
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState<number>(1);
  const [accountFilter, setAccountFilter] = useState<AccountFilterKey>('all');
  const [mode, setMode] = useState<'month' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState<number>(defaultMonth);
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [customFrom, setCustomFrom] = useState<string>(defaultRange.start);
  const [customTo, setCustomTo] = useState<string>(defaultRange.end);
  const [columnVisibility, setColumnVisibility] = useState<LedgerColumnVisibility>(
    DEFAULT_LEDGER_COLUMN_VISIBILITY,
  );
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement | null>(null);
  const [reconciliationStatus, setReconciliationStatus] = useState<'balanced' | 'unreconciled' | 'unknown'>('unknown');
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingMainCategoryId, setEditingMainCategoryId] = useState<string>('');
  const [editingSubCategoryId, setEditingSubCategoryId] = useState<string>('');
  const [editingCustomCategory, setEditingCustomCategory] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [activeCategoryActionId, setActiveCategoryActionId] = useState<string | null>(null);

  const statusBadge = useMemo(() => {
    if (reconciliationStatus === 'balanced') {
      return {
        label: '✅ Reconciled',
        tone: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100',
      };
    }
    if (reconciliationStatus === 'unreconciled') {
      return {
        label: '⚠️ Mismatch',
        tone: 'border-amber-400/30 bg-amber-500/15 text-amber-100',
      };
    }
    return {
      label: '🕒 Pending',
      tone: 'border-white/20 bg-white/10 text-white/70',
    };
  }, [reconciliationStatus]);

  const editableMainCategories = useMemo(
    () => categoryTree.main.filter((category) => category.id !== REVIEW_MAIN_ID),
    [categoryTree.main],
  );

  const editableSubcategories = useMemo(() => {
    const map: Record<string, Category[]> = {};
    Object.entries(categoryTree.byParent).forEach(([parentId, list]) => {
      if (parentId === REVIEW_MAIN_ID) return;
      const filtered = list.filter((category) => category.id !== REVIEW_SUB_ID);
      if (filtered.length) {
        map[parentId] = filtered;
      }
    });
    return map;
  }, [categoryTree.byParent]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(COLUMN_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Partial<LedgerColumnVisibility>;
      setColumnVisibility((prev) => ({
        ...prev,
        ...parsed,
      }));
    } catch (error) {
      console.warn('Failed to parse column preferences', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  useEffect(() => {
    setSelectedMonth(defaultMonth);
    setSelectedYear(defaultYear);
  }, [defaultMonth, defaultYear]);

  useEffect(() => {
    setCustomFrom(defaultRange.start);
    setCustomTo(defaultRange.end);
  }, [defaultRange.start, defaultRange.end]);

  useEffect(() => {
    if (!columnMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!columnMenuRef.current) return;
      if (!columnMenuRef.current.contains(event.target as Node)) {
        setColumnMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [columnMenuOpen]);

  const availableYears = useMemo(() => {
    const unique = new Set<number>();
    transactions.forEach((tx) => {
      if (Number.isFinite(tx.ledgerYear)) {
        unique.add(tx.ledgerYear);
      }
    });
    if (unique.size === 0) {
      unique.add(defaultYear);
    }
    return Array.from(unique).sort((a, b) => b - a);
  }, [transactions, defaultYear]);

  const periodTransactions = useMemo(() => {
    if (!transactions.length) return [];

    let startTime = Number.NEGATIVE_INFINITY;
    let endTime = Number.POSITIVE_INFINITY;

    if (mode === 'month') {
      startTime = Date.UTC(selectedYear, selectedMonth - 1, 1);
      endTime = Date.UTC(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
    } else {
      if (customFrom) {
        const parsed = Date.parse(`${customFrom}T00:00:00Z`);
        if (!Number.isNaN(parsed)) {
          startTime = parsed;
        }
      }
      if (customTo) {
        const parsed = Date.parse(`${customTo}T23:59:59Z`);
        if (!Number.isNaN(parsed)) {
          endTime = parsed;
        }
      }
    }

    return transactions.filter((tx) => {
      const time = new Date(tx.date).getTime();
      if (Number.isNaN(time)) return false;
      return time >= startTime && time <= endTime;
    });
  }, [transactions, mode, selectedMonth, selectedYear, customFrom, customTo]);

  const availableSubOptions = useMemo(() => {
    if (mainFilter === 'all') {
      return allSubOptions;
    }
    return (categoryTree.byParent[mainFilter] ?? []).filter((item) => item.id !== REVIEW_SUB_ID);
  }, [mainFilter, categoryTree.byParent, allSubOptions]);

  const baseFilteredTransactions = useMemo(() => {
    return periodTransactions.filter((tx) => {
      const matchesMain = mainFilter === 'all' || tx.mainCategoryId === mainFilter;
      const matchesSub = subFilter === 'all' || tx.categoryId === subFilter;
      return matchesMain && matchesSub;
    });
  }, [periodTransactions, mainFilter, subFilter]);

  const accountFilteredTransactions = useMemo(
    () => filterTransactionsByAccount(baseFilteredTransactions, accountFilter),
    [baseFilteredTransactions, accountFilter],
  );

  const visibleTransactions = accountFilteredTransactions;

  const totalPages = Math.max(1, Math.ceil(visibleTransactions.length / pageSize));
  useEffect(() => {
    setPage(1);
  }, [mainFilter, subFilter, pageSize, accountFilter, mode, selectedMonth, selectedYear, customFrom, customTo]);
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedTransactions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleTransactions.slice(start, start + pageSize);
  }, [visibleTransactions, page, pageSize]);

  useEffect(() => {
    if (editingTransactionId && !visibleTransactions.some((tx) => tx.id === editingTransactionId)) {
      setEditingTransactionId(null);
      setEditingCustomCategory('');
    }
  }, [editingTransactionId, visibleTransactions]);

  useEffect(() => {
    if (editingTransactionId) {
      setActiveCategoryActionId(null);
    }
  }, [editingTransactionId]);

  const summary = useMemo(() => calculateSummary(visibleTransactions), [visibleTransactions]);

  const startIndex = visibleTransactions.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, visibleTransactions.length);
  const visibleColumnCount = useMemo(
    () => Object.values(columnVisibility).filter(Boolean).length,
    [columnVisibility],
  );

  const handleToggleColumn = (column: keyof LedgerColumnVisibility, value: boolean) => {
    setColumnVisibility((prev) => {
      if (!value && prev[column]) {
        const currentlyVisible = Object.values(prev).filter(Boolean).length;
        if (currentlyVisible <= 1) {
          toast.error('At least one column must remain visible');
          return prev;
        }
      }
      return {
        ...prev,
        [column]: value,
      };
    });
  };

  const transactionsSubtitle = `Showing ${visibleTransactions.length === 0 ? 0 : `${startIndex}–${endIndex}`} of ${visibleTransactions.length.toLocaleString(DEFAULT_LOCALE)} records`;

  const startEditing = useCallback((tx: LedgerTransaction) => {
    setEditingTransactionId(tx.id);
    setEditingMainCategoryId(tx.mainCategoryId ?? '');
    setEditingSubCategoryId(tx.categoryId ?? '');
    setEditingCustomCategory('');
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingTransactionId(null);
    setEditingCustomCategory('');
  }, []);

  const handleSaveCategory = useCallback(async () => {
    if (!editingTransactionId) return;
    const trimmed = editingCustomCategory.trim();
    if (!editingMainCategoryId && !editingSubCategoryId && !trimmed) {
      toast.error('Choose a category or type a new category name.');
      return;
    }
    setIsSavingCategory(true);
    try {
      await assignCategory(editingTransactionId, {
        mainCategoryId: editingMainCategoryId || undefined,
        categoryId: editingSubCategoryId || undefined,
        categoryName: trimmed || undefined,
      });
      toast.success('Category saved');
      setEditingTransactionId(null);
      setEditingCustomCategory('');
    } catch (error) {
      console.error(error);
      toast.error('Unable to save category');
    } finally {
      setIsSavingCategory(false);
    }
  }, [assignCategory, editingTransactionId, editingMainCategoryId, editingSubCategoryId, editingCustomCategory]);

  const renderCategoryCell = useCallback(
    (tx: LedgerTransaction, defaultContent: ReactNode) => {
      const isPending = !tx.categoryId || tx.needsManualCategory;
      const isEditing = editingTransactionId === tx.id;
      const showAction = !isPending && !isEditing && activeCategoryActionId === tx.id;

      if (!isEditing) {
        return (
          <div
            className={cn(
              'relative rounded-lg px-2 py-1 transition',
              !isPending ? 'cursor-pointer hover:bg-white/5' : '',
            )}
            onMouseEnter={() => {
              if (!isPending) {
                setActiveCategoryActionId(tx.id);
              }
            }}
            onMouseLeave={() => {
              if (activeCategoryActionId === tx.id) {
                setActiveCategoryActionId(null);
              }
            }}
            onClick={() => {
              if (isPending) return;
              setActiveCategoryActionId((current) => (current === tx.id ? null : tx.id));
            }}
            tabIndex={isPending ? -1 : 0}
            onFocus={() => {
              if (!isPending) {
                setActiveCategoryActionId(tx.id);
              }
            }}
            onBlur={() => {
              if (activeCategoryActionId === tx.id) {
                setActiveCategoryActionId(null);
              }
            }}
          >
            {defaultContent}
            {showAction ? (
              <div className="pointer-events-auto absolute right-2 top-2 z-10 rounded-xl border border-white/15 bg-[#050B18]/95 px-2 py-1 shadow-2xl">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-white/80 hover:text-white"
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveCategoryActionId(null);
                    startEditing(tx);
                  }}
                >
                  Edit category
                </Button>
              </div>
            ) : null}
          </div>
        );
      }

      const subOptions = editingMainCategoryId ? editableSubcategories[editingMainCategoryId] ?? [] : [];

      return (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-white/70">Main category</label>
            <select
              className="w-full rounded-xl border border-white/20 bg-[#050B18]/80 px-3 py-2 text-sm text-white shadow-inner shadow-black/30 focus-visible:border-[#5B9CFF] focus-visible:outline-none"
              value={editingMainCategoryId}
              onChange={(event) => {
                setEditingMainCategoryId(event.target.value);
                setEditingSubCategoryId('');
              }}
            >
              <option value="">Select main category</option>
              {editableMainCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-white/70">Sub category</label>
            <select
              className="w-full rounded-xl border border-white/20 bg-[#050B18]/80 px-3 py-2 text-sm text-white shadow-inner shadow-black/30 focus-visible:border-[#5B9CFF] focus-visible:outline-none disabled:opacity-60"
              value={editingSubCategoryId}
              onChange={(event) => setEditingSubCategoryId(event.target.value)}
              disabled={!editingMainCategoryId}
            >
              <option value="">Select sub category</option>
              {subOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-white/70">
              New category name (optional)
            </label>
            <Input
              value={editingCustomCategory}
              onChange={(event) => setEditingCustomCategory(event.target.value)}
              placeholder="Type to create a new category"
              className="text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleSaveCategory} disabled={isSavingCategory}>
              {isSavingCategory ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSavingCategory}>
              Cancel
            </Button>
          </div>
        </div>
      );
    },
    [
      activeCategoryActionId,
      cancelEditing,
      editableMainCategories,
      editableSubcategories,
      editingCustomCategory,
      editingMainCategoryId,
      editingSubCategoryId,
      editingTransactionId,
      handleSaveCategory,
      isSavingCategory,
      startEditing,
    ],
  );

  return (
    <div className="space-y-6">
      <Card className="sticky top-0 z-20 space-y-6 border-white/10 bg-[#050B18]/95 backdrop-blur">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Accounts</span>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_FILTER_OPTIONS.map(({ key, label }) => {
              const selected = accountFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAccountFilter(key)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2970FF]/80',
                    selected
                      ? 'border-[#2970FF]/80 bg-[#2970FF]/90 text-white shadow-[0_12px_35px_-18px_rgba(41,112,255,0.85)]'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <span className="ml-auto text-xs font-semibold uppercase tracking-wide text-white/60">Status</span>
          <span className={cn('rounded-full border px-3 py-1 text-[11px] font-semibold', statusBadge.tone)}>
            {statusBadge.label}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            label="View mode"
            value={mode}
            onChange={(value) => setMode(value as 'month' | 'custom')}
            options={[
              { id: 'month', name: 'Month' },
              { id: 'custom', name: 'Custom range' },
            ]}
          />
          {mode === 'month' ? (
            <>
              <FilterSelect
                label="Month"
                value={String(selectedMonth)}
                onChange={(value) => setSelectedMonth(Number(value))}
                options={MONTH_OPTIONS}
              />
              <FilterSelect
                label="Year"
                value={String(selectedYear)}
                onChange={(value) => setSelectedYear(Number(value))}
                options={availableYears.map((year) => ({ id: String(year), name: String(year) }))}
              />
            </>
          ) : (
            <>
              <DateInput label="From" value={customFrom} onChange={setCustomFrom} max={customTo || undefined} />
              <DateInput label="Until" value={customTo} onChange={setCustomTo} min={customFrom || undefined} />
            </>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            label="Main category"
            value={mainFilter}
            onChange={(value) => {
              setMainFilter(value);
              setSubFilter('all');
            }}
            options={mainOptions}
          />
          <FilterSelect
            label="Sub category"
            value={subFilter}
            onChange={setSubFilter}
            options={[{ id: 'all', name: 'All sub categories' }, ...availableSubOptions]}
            disabled={availableSubOptions.length === 0}
          />
          <FilterSelect
            label="Rows per page"
            value={String(pageSize)}
            onChange={(value) => setPageSize(Number(value))}
            options={PAGE_SIZE_OPTIONS.map((size) => ({ id: String(size), name: `${size} rows` }))}
          />
          <div className="flex items-end">
            <button
              onClick={() => {
                setMainFilter('all');
                setSubFilter('all');
                setMode('month');
                setSelectedMonth(defaultMonth);
                setSelectedYear(defaultYear);
                setCustomFrom(defaultRange.start);
                setCustomTo(defaultRange.end);
                setAccountFilter('all');
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10"
            >
              Clear filters
            </button>
          </div>
        </div>
      </Card>
      <ReconciliationCard onStatusChange={setReconciliationStatus} />

      <PageHeader
        title="Transactions"
        subtitle={transactionsSubtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative" ref={columnMenuRef}>
              <button
                type="button"
                onClick={() => setColumnMenuOpen((state) => !state)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10"
              >
                <SlidersHorizontal className="h-4 w-4 text-white/70" />
                Columns
              </button>
              {columnMenuOpen ? (
                <div className="absolute right-0 z-30 mt-2 w-60 rounded-2xl border border-white/10 bg-[#0A162D] p-4 shadow-lg">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
                      Visible columns
                    </span>
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-white/50 underline-offset-4 hover:text-white/80 hover:underline"
                      onClick={() => setColumnVisibility({ ...DEFAULT_LEDGER_COLUMN_VISIBILITY })}
                    >
                      Reset
                    </button>
                  </div>
                  <ul className="space-y-2 text-sm text-white/80">
                    {COLUMN_DEFINITIONS.map(({ key, label }) => (
                      <li key={key} className="flex items-center justify-between gap-2">
                        <label htmlFor={`column-${key}`} className="text-xs font-medium text-white/70">
                          {label}
                        </label>
                        <Switch
                          id={`column-${key}`}
                          checked={columnVisibility[key]}
                          onCheckedChange={(checked) => handleToggleColumn(key, checked)}
                          disabled={columnVisibility[key] && visibleColumnCount <= 1}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            {accountFilter !== 'all' ? <UploadCsvButton /> : null}
            <Link
              href="/review"
              className="inline-flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20"
            >
              Needs Review
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] text-amber-100">
                {summary.reviewCount}
              </span>
            </Link>
          </div>
        }
      />

      <Section contentClassName="space-y-4">
        <LedgerTable
          transactions={pagedTransactions}
          summary={summary}
          columnVisibility={columnVisibility}
          renderCategoryCell={renderCategoryCell}
        />
        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={visibleTransactions.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </Section>
    </div>
  );
}

function CashFlowView({
  cashflow,
  onRegisterExportHandler,
}: {
  cashflow: CashFlowDatum[];
  onRegisterExportHandler?: (handler: (() => void) | null) => void;
}) {
  const totals = useMemo(() => {
    return cashflow.reduce(
      (acc, entry) => {
        acc.income += entry.income;
        acc.expenses += entry.expenses;
        acc.net += entry.net;
        return acc;
      },
      { income: 0, expenses: 0, net: 0 },
    );
  }, [cashflow]);
  const periodLabel = useMemo(() => {
    if (!cashflow.length) {
      return 'No data';
    }
    if (cashflow.length === 1) {
      return cashflow[0].label;
    }
    return `${cashflow[0].label} – ${cashflow[cashflow.length - 1].label}`;
  }, [cashflow]);

  const handleExport = useCallback(() => {
    if (typeof window === 'undefined') return;
    const html = buildCashFlowExportHtml({
      data: cashflow,
      totals,
      periodLabel,
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileIdentifier = sanitizeForFilename(periodLabel) || 'cashflow';
    link.download = `cashflow-${fileIdentifier}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [cashflow, totals, periodLabel]);

  useEffect(() => {
    if (!onRegisterExportHandler) return;
    onRegisterExportHandler(handleExport);
    return () => onRegisterExportHandler(null);
  }, [handleExport, onRegisterExportHandler]);

  return (
    <div className="space-y-6">
      <Section title="Cash Flow" description="Net income across the last six months" contentClassName="space-y-4">
        <CashFlowChart data={cashflow} />
      </Section>
    </div>
  );
}

function DateInput({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-white/60">
      {label}
      <input
        type="date"
        className="rounded-xl border border-white/10 bg-[#09142A] px-3 py-2 text-sm text-white focus:border-[#2970FF] focus:outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        min={min}
        max={max}
      />
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Category[] | { id: string; name: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-white/60">
      {label}
      <select
        className="rounded-xl border border-white/10 bg-[#09142A] px-3 py-2 text-sm text-white focus:border-[#2970FF] focus:outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id} className="text-black">
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function PaginationControls({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-white/70">
      <div>
        Page {page} of {totalPages} • {totalItems.toLocaleString(DEFAULT_LOCALE)} transactions
      </div>
      <div className="flex items-center gap-2">
        <button
          className="rounded-lg border border-white/10 px-3 py-1 text-xs font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
        >
          Previous
        </button>
        <button
          className="rounded-lg border border-white/10 px-3 py-1 text-xs font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function SpendingBreakdownCard({ data }: { data: BreakdownEntry[] }) {
  if (!data.length) {
    return <p className="text-sm text-white/50">No expense data available.</p>;
  }

  const total = data.reduce((acc, entry) => acc + entry.value, 0);

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] lg:gap-8">
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-4">
        <ResponsiveContainer width="100%" height={220}>
          <RechartsPieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <RechartsTooltip
              contentStyle={{
                backgroundColor: '#060F1F',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '0.75rem',
                color: '#fff',
              }}
              labelStyle={{ color: '#ffffffcc' }}
              itemStyle={{ color: '#fff' }}
              formatter={(value: unknown, _name, payload) => [
                euro.format(Number(value ?? 0)),
                (payload?.payload as BreakdownEntry | undefined)?.label ?? '',
              ]}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="60%"
              outerRadius="82%"
              paddingAngle={3}
              cornerRadius={10}
            >
              {data.map((entry) => (
                <Cell key={entry.label} fill={entry.color} />
              ))}
            </Pie>
          </RechartsPieChart>
        </ResponsiveContainer>
        <div className="pt-2 text-center text-sm text-white/60">
          Total spending <span className="font-semibold text-white">{euro.format(total)}</span>
        </div>
      </div>
      <ul className="flex flex-col gap-3 text-sm">
        {data.map((entry) => (
          <li key={entry.label} className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span
                className="max-w-[12rem] truncate whitespace-nowrap text-sm font-medium text-white/70"
                title={entry.label}
              >
                {entry.label}
              </span>
            </div>
            <div className="text-right text-white">
              <div className="text-sm font-semibold">{euro.format(entry.value)}</div>
              <div className="text-[11px] uppercase tracking-wide text-white/50">{entry.percent}%</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SpendingComparisonChart({ data }: { data: LineDatum[] }) {
  if (!data.length) {
    return <p className="text-sm text-white/50">No activity recorded for this period.</p>;
  }

  return (
    <div className="mt-6 flex w-full flex-col">
      <div className="flex flex-1 items-center justify-center">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 16, right: 28, bottom: 28, left: 40 }}>
            <CartesianGrid stroke="rgba(91,156,255,0.2)" strokeDasharray="4 4" />
            <XAxis
              dataKey="label"
              stroke="rgba(255,255,255,0.45)"
              tickLine={false}
              axisLine={false}
            tickMargin={10}
            interval="preserveStartEnd"
            minTickGap={20}
          />
            <YAxis
              stroke="rgba(255,255,255,0.45)"
              tickLine={false}
              axisLine={false}
              width={80}
              tickMargin={10}
              tickFormatter={(value) => euro.format(Number(value ?? 0))}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: '#060F1F',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '0.75rem',
              }}
              cursor={false}
              formatter={(value: unknown, name) => [euro.format(Number(value ?? 0)), name as string]}
            />
            <Legend
              wrapperStyle={{ color: 'rgba(255,255,255,0.6)' }}
              iconType="circle"
              verticalAlign="top"
              height={24}
            />
            <Line
              type="monotone"
              dataKey="previous"
              name="Previous period"
              stroke="rgba(91,156,255,0.45)"
              strokeWidth={2}
              dot={false}
              strokeDasharray="4 4"
            />
            <Line
              type="monotone"
              dataKey="current"
              name="Current period"
              stroke="#5B9CFF"
              strokeWidth={3}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CashFlowChart({ data }: { data: CashFlowDatum[] }) {
  if (!data.length) {
    return <p className="text-sm text-white/50">No cash flow data available.</p>;
  }

  return (
    <div className="mt-6 flex w-full items-center justify-center">
      <div className="w-full">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 16, right: 28, bottom: 28, left: 40 }} barCategoryGap={18}>
            <CartesianGrid stroke="rgba(91,156,255,0.2)" strokeDasharray="4 4" />
            <XAxis
              dataKey="label"
              stroke="rgba(255,255,255,0.45)"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
            />
            <YAxis
              stroke="rgba(255,255,255,0.45)"
              tickLine={false}
              axisLine={false}
              width={88}
              tickMargin={8}
              tickFormatter={(value) => euro.format(Number(value ?? 0))}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: '#060F1F',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '0.75rem',
              }}
              cursor={false}
              formatter={(value: unknown, name) => [euro.format(Number(value ?? 0)), name as string]}
            />
            <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.6)' }} iconType="circle" />
            <Bar dataKey="income" name="Income" fill="#2970FF" radius={[8, 8, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="rgba(255,255,255,0.35)" radius={[8, 8, 0, 0]} />
            <Line type="monotone" dataKey="net" name="Net" stroke="#5B9CFF" strokeWidth={3} dot={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PlannedIncomeExpensesCard({ data }: { data: PlannedSummary[] }) {
  return (
    <div className="space-y-6">
      {data.map((entry) => {
        const ratio = entry.planned === 0 ? 0 : Math.min((entry.actual / entry.planned) * 100, 100);
        const exceeded = entry.planned > 0 && entry.actual > entry.planned;
        return (
          <div key={entry.label} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide text-white/50">
              <span className="text-white/70">{entry.label}</span>
              <span className="font-semibold text-white/60">{euro.format(entry.planned)} planned</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#2970FF] to-[#5B9CFF]"
                style={{ width: `${ratio}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm sm:text-base">
              <div className="text-xl font-semibold text-white sm:text-2xl">{euro.format(entry.actual)}</div>
              <div className="flex items-center gap-2 text-xs font-medium text-white/70 sm:text-sm">
                {exceeded ? (
                  <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-black">
                    Exceeded
                  </span>
                ) : null}
                <span className={entry.positive ? 'text-emerald-400' : 'text-rose-400'}>
                  {entry.positive ? '▲' : '▼'} {Math.abs(entry.delta).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatDateInput(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string): string {
  if (!value) return '';
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return displayDateFormatter.format(new Date(parsed));
}

function buildCategoryAggregates(transactions: LedgerTransaction[], categoryTree: CategoryTree): CategoryAggregate[] {
  const mainOrder = categoryTree.main
    .filter((category) => category.id !== REVIEW_MAIN_ID)
    .map((category) => category.id);

  const grouped = new Map<
    string,
    {
      mainId: string;
      mainName: string;
      totalIncome: number;
      totalExpenses: number;
      children: Map<
        string,
        {
          categoryId: string;
          categoryName: string;
          totalIncome: number;
          totalExpenses: number;
        }
      >;
    }
  >();

  transactions.forEach((tx) => {
    if (tx.mainCategoryId === REVIEW_MAIN_ID || tx.categoryId === REVIEW_SUB_ID) {
      return;
    }

    const mainId = tx.mainCategoryId ?? tx.categoryId ?? 'uncategorized';
    const mainName = tx.mainCategoryName ?? tx.categoryName ?? 'Uncategorized';
    const childId = tx.categoryId ?? `${mainId}__uncategorized`;
    const childName =
      tx.categoryName ?? (tx.mainCategoryName ? `${tx.mainCategoryName} (uncategorized)` : 'Uncategorized');

    const mainBucket =
      grouped.get(mainId) ??
      {
        mainId,
        mainName,
        totalIncome: 0,
        totalExpenses: 0,
        children: new Map<
          string,
          {
            categoryId: string;
            categoryName: string;
            totalIncome: number;
            totalExpenses: number;
          }
        >(),
      };

    const childBucket =
      mainBucket.children.get(childId) ??
      {
        categoryId: childId,
        categoryName: childName,
        totalIncome: 0,
        totalExpenses: 0,
      };

    if (isDebitTransaction(tx)) {
      const absolute = getAbsoluteAmount(tx);
      mainBucket.totalExpenses += absolute;
      childBucket.totalExpenses += absolute;
    } else {
      const incomeValue = getAbsoluteAmount(tx);
      mainBucket.totalIncome += incomeValue;
      childBucket.totalIncome += incomeValue;
    }

    mainBucket.children.set(childId, childBucket);
    grouped.set(mainId, mainBucket);
  });

  const list = Array.from(grouped.values());

  list.sort((a, b) => {
    const indexA = mainOrder.indexOf(a.mainId);
    const indexB = mainOrder.indexOf(b.mainId);
    if (indexA === -1 && indexB === -1) {
      return a.mainName.localeCompare(b.mainName);
    }
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return list.map((main) => {
    const categoryOrder = categoryTree.byParent[main.mainId] ?? [];
    const children = Array.from(main.children.values());

    children.sort((a, b) => {
      const indexA = categoryOrder.findIndex((category) => category.id === a.categoryId);
      const indexB = categoryOrder.findIndex((category) => category.id === b.categoryId);
      if (indexA === -1 && indexB === -1) {
        return a.categoryName.localeCompare(b.categoryName);
      }
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    return {
      mainId: main.mainId,
      mainName: main.mainName,
      totalIncome: main.totalIncome,
      totalExpenses: main.totalExpenses,
      children,
    };
  });
}

function buildSpendingBreakdown(transactions: LedgerTransaction[]): BreakdownEntry[] {
  const totals = new Map<string, { label: string; value: number }>();

  transactions.forEach((tx) => {
    if (!isDebitTransaction(tx)) return;
    const key = tx.mainCategoryId ?? tx.categoryId ?? 'uncategorized';
    const label = tx.mainCategoryName ?? tx.categoryName ?? 'Uncategorized';
    const item = totals.get(key) ?? { label, value: 0 };
    item.value += getAbsoluteAmount(tx);
    totals.set(key, item);
  });

  const entries = Array.from(totals.values())
    .map((item, index) => ({
      label: item.label,
      value: item.value,
      percent: 0,
      color: COLORS[index % COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  const total = entries.reduce((acc, entry) => acc + entry.value, 0);
  return entries.map((entry) => ({
    ...entry,
    percent: total === 0 ? 0 : Math.round((entry.value / total) * 1000) / 10,
  }));
}

type DashboardExportPayload = {
  breakdown: BreakdownEntry[];
  comparison: LineDatum[];
  cashflow: CashFlowDatum[];
  planned: PlannedSummary[];
  summary: SummaryValues;
};

function buildDashboardExportHtml(payload: DashboardExportPayload): string {
  const { breakdown, comparison, cashflow, planned, summary } = payload;
  const breakdownRows =
    breakdown
      .map(
        (entry) => `<tr>
        <td style="padding:10px;border:1px solid #e2e8f0;">${escapeHtml(entry.label)}</td>
        <td align="right" style="padding:10px;border:1px solid #e2e8f0;">${entry.percent.toFixed(1)}%</td>
        <td align="right" style="padding:10px;border:1px solid #e2e8f0;">${euro.format(entry.value)}</td>
      </tr>`,
      )
      .join('') ||
    `<tr><td colspan="3" style="padding:12px;text-align:center;border:1px solid #e2e8f0;color:#475569;">No spending data available.</td></tr>`;

  const plannedRows = planned
    .map(
      (entry) => `<tr>
      <td style="padding:10px;border:1px solid #e2e8f0;">${escapeHtml(entry.label)}</td>
      <td align="right" style="padding:10px;border:1px solid #e2e8f0;">${euro.format(entry.actual)}</td>
      <td align="right" style="padding:10px;border:1px solid #e2e8f0;">${euro.format(entry.planned)}</td>
      <td align="right" style="padding:10px;border:1px solid #e2e8f0;color:${entry.positive ? '#059669' : '#dc2626'};">${entry.positive ? '▲' : '▼'} ${entry.delta.toFixed(1)}%</td>
    </tr>`,
    )
    .join('');

  const comparisonPoints =
    comparison
      .map(
        (point) => `<tr>
        <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(point.label)}</td>
        <td align="right" style="padding:8px;border:1px solid #e2e8f0;">${euro.format(point.current)}</td>
        <td align="right" style="padding:8px;border:1px solid #e2e8f0;">${euro.format(point.previous)}</td>
      </tr>`,
      )
      .join('') || `<tr><td colspan="3" style="padding:12px;text-align:center;border:1px solid #e2e8f0;color:#475569;">No comparison data available.</td></tr>`;

  const cashflowRows =
    cashflow
      .map(
        (entry) => `<tr>
        <td style="padding:10px;border:1px solid #e2e8f0;">${escapeHtml(entry.label)}</td>
        <td align="right" style="padding:10px;border:1px solid #e2e8f0;">${euro.format(entry.income)}</td>
        <td align="right" style="padding:10px;border:1px solid #e2e8f0;">${euro.format(entry.expenses)}</td>
        <td align="right" style="padding:10px;border:1px solid #e2e8f0;color:${entry.net >= 0 ? '#059669' : '#dc2626'};">${euro.format(entry.net)}</td>
      </tr>`,
      )
      .join('') || `<tr><td colspan="4" style="padding:12px;text-align:center;border:1px solid #e2e8f0;color:#475569;">No cash flow data available.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Performance Summary Export</title>
  </head>
  <body style="margin:0;padding:24px;background:#0b1120;font-family:'Inter','Segoe UI',Arial,sans-serif;color:#0f172a;">
    <div style="max-width:960px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 20px 60px rgba(15,23,42,0.25);">
      <h1 style="margin-top:0;font-size:26px;">Performance Summary</h1>
      <section style="margin-bottom:24px;">
        <h2 style="font-size:18px;margin-bottom:12px;color:#0f172a;">Overview</h2>
        <p style="margin:4px 0;"><strong>Total Transactions:</strong> ${summary.total.toLocaleString(DEFAULT_LOCALE)}</p>
        <p style="margin:4px 0;"><strong>Needs Review:</strong> ${summary.reviewCount.toLocaleString(DEFAULT_LOCALE)}</p>
        <p style="margin:4px 0;"><strong>Auto Categorized:</strong> ${summary.autoCategorized.toLocaleString(
          DEFAULT_LOCALE,
        )}</p>
        <p style="margin:4px 0;"><strong>Total Amount:</strong> ${summary.totalAmount.toLocaleString(DEFAULT_LOCALE, {
          style: 'currency',
          currency: 'EUR',
          maximumFractionDigits: 2,
        })}</p>
      </section>

      <section style="margin-bottom:24px;">
        <h2 style="font-size:18px;margin-bottom:12px;color:#0f172a;">Spending Breakdown</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#0f172a;color:#f8fafc;">
              <th align="left" style="padding:10px;border:1px solid #1e293b;">Category</th>
              <th align="right" style="padding:10px;border:1px solid #1e293b;">Share</th>
              <th align="right" style="padding:10px;border:1px solid #1e293b;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${breakdownRows}
          </tbody>
        </table>
      </section>

      <section style="margin-bottom:24px;">
        <h2 style="font-size:18px;margin-bottom:12px;color:#0f172a;">Spending Comparison</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#0f172a;color:#f8fafc;">
              <th align="left" style="padding:8px;border:1px solid #1e293b;">Date</th>
              <th align="right" style="padding:8px;border:1px solid #1e293b;">Current Period</th>
              <th align="right" style="padding:8px;border:1px solid #1e293b;">Previous Period</th>
            </tr>
          </thead>
          <tbody>
            ${comparisonPoints}
          </tbody>
        </table>
      </section>

      <section style="margin-bottom:24px;">
        <h2 style="font-size:18px;margin-bottom:12px;color:#0f172a;">Planned Income & Expenses</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#0f172a;color:#f8fafc;">
              <th align="left" style="padding:10px;border:1px solid #1e293b;">Label</th>
              <th align="right" style="padding:10px;border:1px solid #1e293b;">Actual</th>
              <th align="right" style="padding:10px;border:1px solid #1e293b;">Planned</th>
              <th align="right" style="padding:10px;border:1px solid #1e293b;">Delta</th>
            </tr>
          </thead>
          <tbody>
            ${plannedRows}
          </tbody>
        </table>
      </section>

      <section style="margin-bottom:24px;">
        <h2 style="font-size:18px;margin-bottom:12px;color:#0f172a;">Cash Flow (Last 6 Months)</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#0f172a;color:#f8fafc;">
              <th align="left" style="padding:10px;border:1px solid #1e293b;">Month</th>
              <th align="right" style="padding:10px;border:1px solid #1e293b;">Income</th>
              <th align="right" style="padding:10px;border:1px solid #1e293b;">Expenses</th>
              <th align="right" style="padding:10px;border:1px solid #1e293b;">Net</th>
            </tr>
          </thead>
          <tbody>
            ${cashflowRows}
          </tbody>
        </table>
      </section>
    </div>
  </body>
</html>`;
}

function buildLineData(transactions: LedgerTransaction[]): LineDatum[] {
  const daily = new Map<string, { income: number; expense: number }>();

  transactions.forEach((tx) => {
    const key = tx.date.slice(0, 10);
    const bucket = daily.get(key) ?? { income: 0, expense: 0 };
    if (isDebitTransaction(tx)) {
      bucket.expense += getAbsoluteAmount(tx);
    } else {
      bucket.income += getAbsoluteAmount(tx);
    }
    daily.set(key, bucket);
  });

  const sorted = Array.from(daily.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-30);

  let cumulativeCurrent = 0;
  let cumulativePrevious = 0;

  return sorted.map(([date, value], index) => {
    cumulativeCurrent += value.income - value.expense;
    const previous = index > 2 ? sorted[index - 3][1] : value;
    cumulativePrevious += previous.income - previous.expense;
    return {
      label: date.slice(5),
      current: cumulativeCurrent,
      previous: cumulativePrevious,
    };
  });
}

function buildCashFlowData(transactions: LedgerTransaction[]): CashFlowDatum[] {
  const grouped = new Map<string, { income: number; expenses: number }>();

  transactions.forEach((tx) => {
    const date = new Date(tx.date);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const bucket = grouped.get(key) ?? { income: 0, expenses: 0 };
    if (isDebitTransaction(tx)) {
      bucket.expenses += getAbsoluteAmount(tx);
    } else {
      bucket.income += getAbsoluteAmount(tx);
    }
    grouped.set(key, bucket);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-6)
    .map(([key, value]) => {
      const [year, month] = key.split('-');
      const label = `${monthFormatter.format(new Date(Number(year), Number(month) - 1))}`;
      return {
        label,
        income: value.income,
        expenses: value.expenses,
        net: value.income - value.expenses,
      };
    });
}

function buildPlannedSummary(transactions: LedgerTransaction[]): PlannedSummary[] {
  const income = transactions
    .filter((tx) => !isDebitTransaction(tx))
    .reduce((acc, tx) => acc + getAbsoluteAmount(tx), 0);
  const expenses = transactions
    .filter((tx) => isDebitTransaction(tx))
    .reduce((acc, tx) => acc + getAbsoluteAmount(tx), 0);

  return [
    {
      label: 'Income',
      planned: income * 1.1,
      actual: income,
      delta: income === 0 ? 0 : ((income - income * 1.1) / (income * 1.1)) * 100,
      positive: income >= income * 1.1,
    },
    {
      label: 'Expenses',
      planned: expenses * 0.9,
      actual: expenses,
      delta: expenses === 0 ? 0 : ((expenses - expenses * 0.9) / (expenses * 0.9)) * 100,
      positive: expenses <= expenses * 0.9,
    },
  ];
}

function calculateSummary(list: LedgerTransaction[]): SummaryValues {
  const reviewCount = list.filter((tx) => tx.needsManualCategory).length;
  const autoCategorized = list.filter((tx) => tx.autoCategorized).length;
  const totalAmount = list.reduce(
    (acc, tx) => acc + (isDebitTransaction(tx) ? -getAbsoluteAmount(tx) : getAbsoluteAmount(tx)),
    0,
  );
  return {
    total: list.length,
    reviewCount,
    autoCategorized,
    totalAmount,
  };
}

type MonthlyOverviewExportOptions = {
  accountLabel: string;
  periodLabel: string;
  mode: 'month' | 'custom';
  selectedMonth: number;
  selectedYear: number;
  customFrom: string;
  customTo: string;
  transactionsCount: number;
  totals: { income: number; expenses: number; net: number };
  aggregates: CategoryAggregate[];
};

function buildMonthlyOverviewExportHtml(options: MonthlyOverviewExportOptions): string {
  const {
    accountLabel,
    periodLabel,
    mode,
    selectedMonth,
    selectedYear,
    customFrom,
    customTo,
    transactionsCount,
    totals,
    aggregates,
  } = options;
  const formatCurrency = (value: number) => euro.format(value);
  const transactionsLabel = transactionsCount.toLocaleString(DEFAULT_LOCALE);
  const periodDetails =
    mode === 'month'
      ? `<div><strong>Month:</strong> ${escapeHtml(
          monthNameFormatter.format(new Date(Date.UTC(selectedYear, selectedMonth - 1, 1))),
        )}</div>
         <div><strong>Year:</strong> ${selectedYear}</div>`
      : `<div><strong>From:</strong> ${escapeHtml(formatDisplayDate(customFrom) || 'Not specified')}</div>
         <div><strong>Until:</strong> ${escapeHtml(formatDisplayDate(customTo) || 'Not specified')}</div>`;
  const summaryTable = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;font-family:'Inter','Segoe UI',Arial,sans-serif;">
      <tr>
        <td style="padding:16px;border:1px solid #e2e8f0;background:#f8fafc;vertical-align:top;width:50%;">
          <div><strong>Account:</strong> ${escapeHtml(accountLabel)}</div>
          <div><strong>Period:</strong> ${escapeHtml(periodLabel)}</div>
          ${periodDetails}
          <div><strong>Transactions:</strong> ${transactionsLabel}</div>
        </td>
        <td style="padding:16px;border:1px solid #e2e8f0;background:#f8fafc;vertical-align:top;width:50%;">
          <div><strong>Total Income:</strong> ${formatCurrency(totals.income)}</div>
          <div><strong>Total Expenses:</strong> ${formatCurrency(totals.expenses)}</div>
          <div style="color:${totals.net >= 0 ? '#059669' : '#dc2626'};"><strong>Net:</strong> ${formatCurrency(
            totals.net,
          )}</div>
        </td>
      </tr>
    </table>
  `;

  const categoryRows = aggregates
    .map((main) => {
      const net = main.totalIncome - main.totalExpenses;
      const mainRow = `
        <tr style="background:#e2e8f0;font-weight:600;color:#0f172a;">
          <td style="padding:10px;border:1px solid #cbd5f5;">${escapeHtml(main.mainName)}</td>
          <td align="right" style="padding:10px;border:1px solid #cbd5f5;color:#059669;">${formatCurrency(
            main.totalIncome,
          )}</td>
          <td align="right" style="padding:10px;border:1px solid #cbd5f5;color:#dc2626;">${formatCurrency(
            main.totalExpenses,
          )}</td>
          <td align="right" style="padding:10px;border:1px solid #cbd5f5;color:${net >= 0 ? '#059669' : '#dc2626'};">${formatCurrency(
        net,
      )}</td>
        </tr>
      `;
      const childRows = main.children
        .map((child) => {
          const childNet = child.totalIncome - child.totalExpenses;
          return `
            <tr>
              <td style="padding:10px;border:1px solid #e2e8f0;">&nbsp;&nbsp;${escapeHtml(child.categoryName)}</td>
              <td align="right" style="padding:10px;border:1px solid #e2e8f0;color:#059669;">${formatCurrency(
                child.totalIncome,
              )}</td>
              <td align="right" style="padding:10px;border:1px solid #e2e8f0;color:#dc2626;">${formatCurrency(
                child.totalExpenses,
              )}</td>
              <td align="right" style="padding:10px;border:1px solid #e2e8f0;color:${
                childNet >= 0 ? '#059669' : '#dc2626'
              };">${formatCurrency(childNet)}</td>
            </tr>
          `;
        })
        .join('');
      return mainRow + childRows;
    })
    .join('');

  const bodyContent =
    categoryRows ||
    `<tr><td colspan="4" style="padding:12px;border:1px solid #e2e8f0;text-align:center;color:#475569;">No categorized transactions for this period.</td></tr>`;

  const totalsRow = `
    <tfoot>
      <tr style="background:#0f172a;color:#f8fafc;font-weight:600;">
        <td style="padding:12px;border:1px solid #0f172a;">Total</td>
        <td align="right" style="padding:12px;border:1px solid #0f172a;">${formatCurrency(totals.income)}</td>
        <td align="right" style="padding:12px;border:1px solid #0f172a;">${formatCurrency(totals.expenses)}</td>
        <td align="right" style="padding:12px;border:1px solid #0f172a;color:${totals.net >= 0 ? '#bbf7d0' : '#fecaca'};">${formatCurrency(
          totals.net,
        )}</td>
      </tr>
    </tfoot>
  `;

  const categoryTable = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:'Inter','Segoe UI',Arial,sans-serif;">
      <thead>
        <tr style="background:#0f172a;color:#f8fafc;">
          <th align="left" style="padding:10px;border:1px solid #1e293b;">Category</th>
          <th align="right" style="padding:10px;border:1px solid #1e293b;">Income</th>
          <th align="right" style="padding:10px;border:1px solid #1e293b;">Expenses</th>
          <th align="right" style="padding:10px;border:1px solid #1e293b;">Net</th>
        </tr>
      </thead>
      <tbody>
        ${bodyContent}
      </tbody>
      ${totalsRow}
    </table>
  `;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Monthly Overview Export</title>
  </head>
  <body style="margin:0;padding:24px;background:#0b1120;font-family:'Inter','Segoe UI',Arial,sans-serif;color:#0f172a;">
    <div style="max-width:900px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 20px 60px rgba(15,23,42,0.25);">
      <h1 style="margin-top:0;margin-bottom:16px;font-size:24px;color:#0f172a;">Monthly Overview</h1>
      ${summaryTable}
      ${categoryTable}
    </div>
  </body>
</html>`;
}

type CashFlowExportOptions = {
  data: CashFlowDatum[];
  totals: { income: number; expenses: number; net: number };
  periodLabel: string;
};

function buildCashFlowExportHtml({ data, totals, periodLabel }: CashFlowExportOptions): string {
  const summaryTable = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;font-family:'Inter','Segoe UI',Arial,sans-serif;">
      <tr>
        <td style="padding:16px;border:1px solid #e2e8f0;background:#f8fafc;vertical-align:top;width:50%;">
          <div><strong>Coverage:</strong> ${escapeHtml(periodLabel)}</div>
          <div><strong>Entries:</strong> ${data.length}</div>
        </td>
        <td style="padding:16px;border:1px solid #e2e8f0;background:#f8fafc;vertical-align:top;width:50%;">
          <div><strong>Total Income:</strong> ${euro.format(totals.income)}</div>
          <div><strong>Total Expenses:</strong> ${euro.format(totals.expenses)}</div>
          <div style="color:${totals.net >= 0 ? '#059669' : '#dc2626'};"><strong>Net:</strong> ${euro.format(
            totals.net,
          )}</div>
        </td>
      </tr>
    </table>
  `;

  const chartSection = `
    <div style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:16px;padding:16px;background:#f8fafc;">
      <h2 style="margin:0 0 12px 0;font-size:16px;color:#0f172a;">Cash Flow Diagram</h2>
      ${buildCashFlowChartSvg(data)}
    </div>
  `;

  const rows = data
    .map((entry) => {
      const net = entry.net;
      return `
        <tr>
          <td style="padding:12px;border:1px solid #e2e8f0;">${escapeHtml(entry.label)}</td>
          <td align="right" style="padding:12px;border:1px solid #e2e8f0;color:#059669;">${euro.format(
            entry.income,
          )}</td>
          <td align="right" style="padding:12px;border:1px solid #e2e8f0;color:#dc2626;">${euro.format(
            entry.expenses,
          )}</td>
          <td align="right" style="padding:12px;border:1px solid #e2e8f0;color:${
            net >= 0 ? '#059669' : '#dc2626'
          };">${euro.format(net)}</td>
        </tr>
      `;
    })
    .join('');

  const tableBody =
    rows ||
    `<tr><td colspan="4" style="padding:16px;border:1px solid #e2e8f0;text-align:center;color:#475569;">No cash flow data for this period.</td></tr>`;

  const detailsTable = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:'Inter','Segoe UI',Arial,sans-serif;">
      <thead>
        <tr style="background:#0f172a;color:#f8fafc;">
          <th align="left" style="padding:12px;border:1px solid #1e293b;">Month</th>
          <th align="right" style="padding:12px;border:1px solid #1e293b;">Income</th>
          <th align="right" style="padding:12px;border:1px solid #1e293b;">Expenses</th>
          <th align="right" style="padding:12px;border:1px solid #1e293b;">Net</th>
        </tr>
      </thead>
      <tbody>
        ${tableBody}
      </tbody>
      <tfoot>
        <tr style="background:#0f172a;color:#f8fafc;font-weight:600;">
          <td style="padding:12px;border:1px solid #0f172a;">Total</td>
          <td align="right" style="padding:12px;border:1px solid #0f172a;">${euro.format(totals.income)}</td>
          <td align="right" style="padding:12px;border:1px solid #0f172a;">${euro.format(totals.expenses)}</td>
          <td align="right" style="padding:12px;border:1px solid #0f172a;color:${totals.net >= 0 ? '#bbf7d0' : '#fecaca'};">${euro.format(
            totals.net,
          )}</td>
        </tr>
      </tfoot>
    </table>
  `;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Cash Flow Export</title>
  </head>
  <body style="margin:0;padding:24px;background:#0b1120;font-family:'Inter','Segoe UI',Arial,sans-serif;color:#0f172a;">
    <div style="max-width:900px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 20px 60px rgba(15,23,42,0.25);">
      <h1 style="margin-top:0;margin-bottom:16px;font-size:24px;color:#0f172a;">Cash Flow Overview</h1>
      ${summaryTable}
      ${chartSection}
      ${detailsTable}
    </div>
  </body>
</html>`;
}

function buildCashFlowChartSvg(data: CashFlowDatum[]): string {
  if (!data.length) {
    return `<div style="padding:24px;text-align:center;color:#475569;background:#ffffff;border-radius:12px;border:1px dashed #cbd5f5;">No cash flow data</div>`;
  }
  const width = 900;
  const height = 360;
  const marginLeft = 110;
  const marginRight = 70;
  const marginTop = 70;
  const marginBottom = 80;
  const chartWidth = width - marginLeft - marginRight;
  const chartHeight = height - marginTop - marginBottom;
  const segments = Math.max(data.length - 1, 1);
  const startX = marginLeft + 10;
  const endX = width - marginRight - 10;
  const spacing = segments === 0 ? 0 : (endX - startX) / segments;
  const getBaseX = (index: number) =>
    data.length === 1 ? (startX + endX) / 2 : startX + spacing * index;

  const incomes = data.map((entry) => entry.income);
  const expenses = data.map((entry) => entry.expenses);
  const nets = data.map((entry) => entry.net);
  const maxPositive = Math.max(
    Math.max(...incomes, 0),
    Math.max(...expenses, 0),
    Math.max(...nets, 0),
  );
  const maxNegative = Math.abs(Math.min(...nets, 0));
  const totalRange = Math.max(maxPositive + maxNegative, 1);
  const zeroY = marginTop + (maxPositive / totalRange) * chartHeight;
  const barWidth = Math.min(20, Math.max(10, spacing * 0.14));

  const gridLines = Array.from({ length: 5 }).map((_, index) => {
    const ratio = index / 4;
    const y = marginTop + chartHeight * ratio;
    const value = maxPositive - totalRange * ratio;
    const label = euro.format(Math.round(value));
    return `
      <g>
        <line x1="${startX - 10}" y1="${y}" x2="${endX + 10}" y2="${y}" stroke="rgba(15,23,42,0.08)" stroke-width="1" />
        <text x="${marginLeft - 18}" y="${y + 4}" text-anchor="end" font-size="11" fill="#475569">${label}</text>
      </g>
    `;
  });

  const incomeBars = data
    .map((entry, index) => {
      const baseX = getBaseX(index);
      const barHeight = (entry.income / totalRange) * chartHeight;
      return `<rect x="${baseX - barWidth - 8}" y="${zeroY - barHeight}" width="${barWidth}" height="${barHeight}" fill="#2970FF" rx="6" />`;
    })
    .join('');

  const expenseBars = data
    .map((entry, index) => {
      const baseX = getBaseX(index);
      const barHeight = (entry.expenses / totalRange) * chartHeight;
      return `<rect x="${baseX + 8}" y="${zeroY - barHeight}" width="${barWidth}" height="${barHeight}" fill="rgba(148,163,184,0.65)" rx="6" />`;
    })
    .join('');

  const netPoints = data
    .map((entry, index) => {
      const baseX = getBaseX(index);
      const y = zeroY - (entry.net / totalRange) * chartHeight;
      return `${baseX},${y}`;
    })
    .join(' ');

  const netDots = data
    .map((entry, index) => {
      const baseX = getBaseX(index);
      const y = zeroY - (entry.net / totalRange) * chartHeight;
      return `<circle cx="${baseX}" cy="${y}" r="4" fill="#5B9CFF" stroke="#ffffff" stroke-width="1" />`;
    })
    .join('');

  const labels = data
    .map((entry, index) => {
      const baseX = getBaseX(index);
      return `<text x="${baseX}" y="${height - marginBottom / 2 + 6}" text-anchor="middle" font-size="12" fill="#0f172a">${escapeHtml(
        entry.label,
      )}</text>`;
    })
    .join('');

  return `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Cash flow chart">
    <rect x="0" y="0" width="${width}" height="${height}" rx="14" fill="#ffffff" />
    ${gridLines.join('')}
    <line x1="${startX - 10}" y1="${zeroY}" x2="${endX + 10}" y2="${zeroY}" stroke="#cbd5f5" stroke-width="1.5" />
    ${incomeBars}
    ${expenseBars}
    <polyline fill="none" stroke="#5B9CFF" stroke-width="3" points="${netPoints}" stroke-linecap="round" stroke-linejoin="round" />
    ${netDots}
    ${labels}
  </svg>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

function sanitizeForFilename(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
