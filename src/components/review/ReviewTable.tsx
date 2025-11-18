'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { Category, LedgerTransaction } from '@/context/ledger-context';
import { AccountBadge } from '@/components/ledger/AccountBadge';
import { buildTransactionTooltip } from '@/helpers/transaction-tooltip';
import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from '@/constants/intl';
import { cn } from '@/helpers/utils';
import type { PlacesType } from 'react-tooltip';

type SuggestionConfidence = 'exact' | 'fuzzy' | 'none';

type SuggestionEntry = {
  mainCategoryId?: string | null;
  mainCategoryName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  confidence: SuggestionConfidence;
};

type SuggestionMap = Record<string, SuggestionEntry>;

interface CategoryTreeProps {
  mainCategories: Category[];
  subcategories: Record<string, Category[]>;
}

interface ReviewTableProps {
  transactions: LedgerTransaction[];
  categoryTree: CategoryTreeProps;
  suggestions?: SuggestionMap;
  onAssign: (
    transactionId: string,
    payload: { categoryId?: string | null; mainCategoryId?: string | null; categoryName?: string },
  ) => Promise<void>;
  onCreateRule?: (transaction: LedgerTransaction) => void;
}

const CARD_TONE: Record<SuggestionConfidence, string> = {
  exact: 'border-emerald-400/30 bg-emerald-500/5 shadow-[0_12px_40px_rgba(16,185,129,0.18)]',
  fuzzy: 'border-amber-400/30 bg-amber-500/5 shadow-[0_12px_38px_rgba(251,191,36,0.16)]',
  none: 'border-white/8 bg-[#050B18]/82 shadow-[0_10px_32px_rgba(5,11,24,0.65)]',
};

const BADGE_STYLE: Record<SuggestionConfidence, { className: string; label: (source?: string | null) => string }> = {
  exact: {
    className: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100',
    label: (source) => (source === 'rule' ? 'Rule match' : 'History matched'),
  },
  fuzzy: {
    className: 'border-amber-400/40 bg-amber-500/15 text-amber-100',
    label: () => 'Suggested match',
  },
  none: {
    className: 'border-rose-400/40 bg-rose-500/15 text-rose-100',
    label: () => 'Needs review',
  },
};

const formatAmount = (value: number): string =>
  value.toLocaleString(DEFAULT_LOCALE, {
    style: 'currency',
    currency: DEFAULT_CURRENCY,
  });

const formatDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(DEFAULT_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export function ReviewTable({
  transactions,
  categoryTree,
  suggestions = {},
  onAssign,
  onCreateRule,
}: ReviewTableProps) {
  const [selectedMain, setSelectedMain] = useState<Record<string, string>>({});
  const [selectedSub, setSelectedSub] = useState<Record<string, string>>({});
  const [customCategory, setCustomCategory] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);

  const defaults = useMemo(() => {
    const result: Record<string, { main: string; sub: string }> = {};
    transactions.forEach((tx) => {
      const suggestion = suggestions[tx.id];
      const mainId = suggestion?.mainCategoryId ?? tx.mainCategoryId ?? '';
      const subId = suggestion?.categoryId ?? tx.categoryId ?? '';
      result[tx.id] = {
        main: mainId ?? '',
        sub: subId ?? '',
      };
    });
    return result;
  }, [transactions, suggestions]);

  const mainOptions = useMemo(() => {
    const seen = new Set(categoryTree.mainCategories.map((category) => category.id));
    const extras: Category[] = [];

    transactions.forEach((tx) => {
      const suggestion = suggestions[tx.id];
      const id = suggestion?.mainCategoryId ?? tx.mainCategoryId;
      const name = suggestion?.mainCategoryName ?? tx.mainCategoryName;
      if (id && name && !seen.has(id)) {
        seen.add(id);
        extras.push({ id, name, parentId: null });
      }
    });

    return [...categoryTree.mainCategories, ...extras].sort((a, b) => a.name.localeCompare(b.name));
  }, [categoryTree.mainCategories, transactions, suggestions]);

  const subcategoryOptions = useMemo(() => {
    const next: Record<string, Category[]> = {};
    Object.entries(categoryTree.subcategories).forEach(([parentId, list]) => {
      next[parentId] = [...list];
    });

    transactions.forEach((tx) => {
      const suggestion = suggestions[tx.id];
      const mainId = suggestion?.mainCategoryId ?? tx.mainCategoryId ?? null;
      const categoryId = suggestion?.categoryId ?? tx.categoryId ?? null;
      const categoryName = suggestion?.categoryName ?? tx.categoryName ?? null;
      if (!mainId || !categoryId || !categoryName) return;
      const bucket = next[mainId] ?? (next[mainId] = []);
      if (!bucket.some((item) => item.id === categoryId)) {
        bucket.push({ id: categoryId, name: categoryName, parentId: mainId });
      }
    });

    Object.values(next).forEach((list) => {
      list.sort((a, b) => a.name.localeCompare(b.name));
    });

    return next;
  }, [categoryTree.subcategories, suggestions, transactions]);

  useEffect(() => {
    setSelectedMain((prev) => {
      const next: Record<string, string> = {};
      transactions.forEach((tx) => {
        const defaultsForTx = defaults[tx.id];
        const previous = prev[tx.id];
        const fallback = defaultsForTx?.main ?? '';
        next[tx.id] = previous && previous.length ? previous : fallback;
      });
      return next;
    });
  }, [transactions, defaults]);

  useEffect(() => {
    setSelectedSub((prev) => {
      const next: Record<string, string> = {};
      transactions.forEach((tx) => {
        const defaultsForTx = defaults[tx.id];
        const previous = prev[tx.id];
        const fallback = defaultsForTx?.sub ?? '';
        next[tx.id] = previous && previous.length ? previous : fallback;
      });
      return next;
    });
  }, [transactions, defaults]);

  useEffect(() => {
    setCustomCategory((prev) => {
      const next: Record<string, string> = {};
      transactions.forEach((tx) => {
        if (prev[tx.id]) {
          next[tx.id] = prev[tx.id];
        }
      });
      return next;
    });
  }, [transactions]);

  const handleAssign = async (transactionId: string) => {
    const mainId = selectedMain[transactionId] ?? defaults[transactionId]?.main ?? '';
    const subId = selectedSub[transactionId] ?? defaults[transactionId]?.sub ?? '';
    const customLabel = customCategory[transactionId]?.trim();

    if (!mainId && !subId && !customLabel) {
      toast.error('Choose a category or type a new category name.');
      return;
    }

    setPendingId(transactionId);

    try {
      await onAssign(transactionId, {
        categoryId: subId || undefined,
        mainCategoryId: mainId || undefined,
        categoryName: customLabel || undefined,
      });
      toast.success('Category saved');
      setCustomCategory((state) => ({ ...state, [transactionId]: '' }));
    } catch (error) {
      console.error(error);
      toast.error('Unable to save category');
    } finally {
      setPendingId(null);
    }
  };

  if (!transactions.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 py-16 text-center text-sm text-white/60">
        All caught up — no transactions need review.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {transactions.map((tx) => {
        const suggestion = suggestions[tx.id];
        const defaultsForTx = defaults[tx.id] ?? { main: '', sub: '' };
        const mainId = selectedMain[tx.id] && selectedMain[tx.id].length ? selectedMain[tx.id] : defaultsForTx.main;
        const subId = selectedSub[tx.id] && selectedSub[tx.id].length ? selectedSub[tx.id] : defaultsForTx.sub;
        const confidence: SuggestionConfidence = suggestion?.confidence ?? 'none';
        const badgeConfig = BADGE_STYLE[confidence];
        const cardTone = CARD_TONE[confidence];
        const normalizedNotification = tx.notificationDetail
          ? tx.notificationDetail.replace(/^Name:\s*/i, '').trim()
          : '';
        const shortNotification = normalizedNotification
          ? normalizedNotification.length > 140
            ? `${normalizedNotification.slice(0, 137)}…`
            : normalizedNotification
          : '';
        const notificationTooltip = normalizedNotification || undefined;
        const tooltipContent = notificationTooltip ?? buildTransactionTooltip(tx);
        const tooltipAttrs = tooltipContent
          ? {
              'data-tooltip-id': 'tooltip',
              'data-tooltip-content': tooltipContent,
              'data-tooltip-place': 'top' as PlacesType,
            }
          : undefined;
        const isDebit = tx.direction === 'debit' || tx.amount < 0;
        const absoluteAmount = Math.abs(tx.amount);
        const formattedAmount = formatAmount(absoluteAmount);
        const amountLabel = isDebit ? `- ${formattedAmount}` : formattedAmount;
        const amountClassName = isDebit ? 'text-rose-300' : 'text-emerald-300';
        const amountTooltip = tx.counterpartyAccount ? `Counterparty: ${tx.counterpartyAccount}` : undefined;
        const dateLabel = formatDate(tx.date);
        const disabled = pendingId === tx.id;
        const subs = subcategoryOptions[mainId] ?? [];
        const hasSelectedSub = subId && subs.some((item) => item.id === subId);
        const subOptions = hasSelectedSub
          ? subs
          : subId
          ? [
              ...subs,
              {
                id: subId,
                name: suggestion?.categoryName ?? tx.categoryName ?? 'Selected category',
                parentId: mainId || null,
              },
            ]
          : subs;
        const badgeLabel = badgeConfig.label(tx.classificationSource);

        return (
          <article
            key={tx.id}
            className={cn(
              'rounded-2xl border px-5 py-6 transition-shadow duration-200',
              cardTone,
            )}
          >
            <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/60">
                  <span>{dateLabel}</span>
                  <span className="inline-flex h-1 w-1 rounded-full bg-white/30" />
                  <AccountBadge
                    label={tx.accountLabel}
                    identifier={tx.accountIdentifier}
                    fallback={tx.source}
                  />
                </div>
                <div
                  className={cn(
                    'text-base font-semibold text-white',
                    tooltipContent ? 'cursor-help decoration-dotted underline-offset-4 hover:underline' : '',
                  )}
                  title={notificationTooltip}
                  {...tooltipAttrs}
                >
                  {tx.description}
                </div>
                {shortNotification ? (
                  <p className="text-xs text-white/50" title={notificationTooltip}>
                    {shortNotification}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col items-start gap-3 md:items-end">
                <span
                  className={cn('text-lg font-semibold', amountClassName)}
                  title={amountTooltip}
                >
                  {amountLabel}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide',
                    badgeConfig.className,
                  )}
                >
                  {badgeLabel}
                </span>
              </div>
            </header>

            <div className="mt-6 grid gap-4 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,220px)]">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-white/60">
                  Main category
                </label>
                <select
                  className={cn(
                    'w-full rounded-xl border bg-black/30 px-3 py-2 text-sm text-white shadow-inner shadow-black/30 transition',
                    disabled ? 'opacity-70' : 'focus-visible:border-emerald-300 focus-visible:outline-none',
                  )}
                  value={mainId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedMain((state) => ({ ...state, [tx.id]: value }));
                    setSelectedSub((state) => ({ ...state, [tx.id]: '' }));
                  }}
                  disabled={disabled}
                >
                  <option value="">Select main category</option>
                  {mainOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-white/60">
                  Sub category
                </label>
                <select
                  className={cn(
                    'w-full rounded-xl border bg-black/30 px-3 py-2 text-sm text-white shadow-inner shadow-black/30 transition',
                    disabled ? 'opacity-70' : 'focus-visible:border-emerald-300 focus-visible:outline-none',
                  )}
                  value={subId}
                  onChange={(event) =>
                    setSelectedSub((state) => ({ ...state, [tx.id]: event.target.value }))
                  }
                  disabled={disabled || !mainId}
                >
                  <option value="">Select sub category</option>
                  {subOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-white/60">
                  New category name (optional)
                </label>
                <input
                  type="text"
                  className={cn(
                    'w-full rounded-xl border bg-black/30 px-3 py-2 text-sm text-white shadow-inner shadow-black/30 transition',
                    disabled ? 'opacity-70' : 'focus-visible:border-emerald-300 focus-visible:outline-none',
                  )}
                  placeholder="Type to create a new category"
                  value={customCategory[tx.id] ?? ''}
                  onChange={(event) =>
                    setCustomCategory((state) => ({ ...state, [tx.id]: event.target.value }))
                  }
                  disabled={disabled}
                />
                <p className="text-[11px] text-white/40">
                  Leave the selects as-is to confirm the suggested category, or type a new name to create one.
                </p>
              </div>

              <div className="flex flex-col justify-end gap-2 sm:flex-row lg:flex-col">
                <button
                  className={cn(
                    'w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transform transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-emerald-400 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70',
                    'sm:w-36 lg:w-full',
                  )}
                  onClick={() => handleAssign(tx.id)}
                  disabled={disabled}
                >
                  {disabled ? 'Saving…' : 'Save'}
                </button>
                {onCreateRule ? (
                  <button
                    type="button"
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transform transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/10 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 sm:w-36 lg:w-full"
                    onClick={() => onCreateRule(tx)}
                    disabled={disabled}
                  >
                    Create rule
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
