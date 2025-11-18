import Link from 'next/link';
import { ReactNode, type HTMLAttributes } from 'react';
import type { LedgerTransaction } from '@/context/ledger-context';
import { AccountBadge } from '@/components/ledger/AccountBadge';
import { buildTransactionTooltip } from '@/helpers/transaction-tooltip';
import { cn } from '@/helpers/utils';
import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from '@/constants/intl';

export type LedgerColumnVisibility = {
  date: boolean;
  account: boolean;
  description: boolean;
  amount: boolean;
  category: boolean;
  balance: boolean;
};

export const DEFAULT_LEDGER_COLUMN_VISIBILITY: LedgerColumnVisibility = {
  date: true,
  account: true,
  description: true,
  amount: true,
  category: true,
  balance: true,
};

const BADGE_VARIANTS: Record<
  string,
  { className: string; label: string }
> = {
  history: {
    className: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
    label: 'History matched',
  },
  rule: {
    className: 'border-sky-400/40 bg-sky-500/10 text-sky-100',
    label: 'Rule match',
  },
  suggested: {
    className: 'border-amber-400/40 bg-amber-500/10 text-amber-100',
    label: 'Suggested match',
  },
  review: {
    className: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
    label: 'Pending approval',
  },
};

interface LedgerSummary {
  total: number;
  reviewCount: number;
  autoCategorized: number;
  totalAmount: number;
}

export function LedgerTable({
  transactions,
  summary,
  columnVisibility,
  renderCategoryCell,
}: {
  transactions: LedgerTransaction[];
  summary: LedgerSummary;
  columnVisibility: LedgerColumnVisibility;
  renderCategoryCell?: (transaction: LedgerTransaction, defaultContent: ReactNode) => ReactNode;
}) {
  const showAccountInDescription = !columnVisibility.account;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Stat label="Transactions" value={summary.total.toLocaleString(DEFAULT_LOCALE)} />
        <Stat label="Auto Categorized" value={summary.autoCategorized.toLocaleString(DEFAULT_LOCALE)} />
        <Stat label="Needs Review" value={summary.reviewCount.toLocaleString(DEFAULT_LOCALE)} />
        <Stat
          label="Total Amount"
          value={summary.totalAmount.toLocaleString(DEFAULT_LOCALE, {
            style: 'currency',
            currency: DEFAULT_CURRENCY,
          })}
        />
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full table-fixed text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              {columnVisibility.date && <Th className="w-[110px]">Date</Th>}
              {columnVisibility.account && <Th className="w-[180px]">Account</Th>}
              {columnVisibility.description && <Th>Payee</Th>}
              {columnVisibility.amount && <Th align="right" className="w-[140px]">Amount</Th>}
              {columnVisibility.category && <Th className="w-[200px]">Category</Th>}
              {columnVisibility.balance && <Th align="right" className="w-[160px]">Running Balance</Th>}
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => {
              const parsedDate = new Date(tx.date);
              const dateLabel = Number.isNaN(parsedDate.getTime()) ? tx.date : parsedDate.toLocaleDateString();
              const tooltipContent = buildTransactionTooltip(tx);
              const tooltipProps: HTMLAttributes<HTMLDivElement> | undefined = tooltipContent
                ? {
                    'data-tooltip-id': 'tooltip',
                    'data-tooltip-content': tooltipContent,
                    'data-tooltip-place': 'top',
                  }
                : undefined;
              return (
                <tr key={tx.id} className="border-t">
                  {columnVisibility.date && <Td className="align-top">{dateLabel}</Td>}
                  {columnVisibility.account && (
                    <Td className="align-top">
                      <AccountBadge
                        label={tx.accountLabel}
                        identifier={tx.accountIdentifier}
                        fallback={tx.source}
                      />
                    </Td>
                  )}
                  {columnVisibility.description && (
                    <Td className="align-top">
                      <div
                        className={cn(
                          'font-medium leading-snug text-white',
                          tooltipContent ? 'cursor-help decoration-dotted underline-offset-4 hover:underline' : '',
                        )}
                        {...(tooltipProps ?? {})}
                      >
                        {tx.description}
                      </div>
                      {tx.classificationSource !== 'manual'
                        ? (() => {
                            const badge =
                              tx.classificationSource === 'history'
                                ? BADGE_VARIANTS.history
                                : tx.classificationSource === 'rule'
                                ? BADGE_VARIANTS.rule
                                : tx.classificationSource === 'import' &&
                                  tx.suggestionConfidence &&
                                  tx.suggestionConfidence !== 'review'
                                ? BADGE_VARIANTS.suggested
                                : BADGE_VARIANTS.review;
                            return (
                              <span
                                className={cn(
                                  'mt-1 inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                  badge.className,
                                )}
                              >
                                {badge.label}
                              </span>
                            );
                          })()
                        : null}
                      {showAccountInDescription && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {tx.accountLabel ? (
                            <AccountBadge
                              label={tx.accountLabel}
                              identifier={tx.accountIdentifier}
                              fallback={tx.source}
                              className="bg-white/5 text-white/80"
                            />
                          ) : (
                            <span className="inline-flex max-w-[220px] truncate">{tx.source}</span>
                          )}
                        </div>
                      )}
                    </Td>
                  )}
                  {columnVisibility.amount && (
                    <Td align="right" className="align-top font-semibold">
                      {tx.amount.toLocaleString(DEFAULT_LOCALE, {
                        style: 'currency',
                        currency: DEFAULT_CURRENCY,
                      })}
                    </Td>
                  )}
                  {columnVisibility.category && (
                    <Td className="align-top">
                      {(() => {
                        const baseContent = tx.categoryId ? (
                          <div className="space-y-0.5">
                            {tx.mainCategoryName && (
                              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                {tx.mainCategoryName}
                              </span>
                            )}
                            <div className="text-sm font-medium">
                              {tx.categoryName ?? tx.mainCategoryName ?? 'Uncategorized'}
                            </div>
                            {tx.needsManualCategory && (
                              <FlagPill href="/review">Needs manual review</FlagPill>
                            )}
                          </div>
                        ) : (
                          <FlagPill href="/review">Needs manual review</FlagPill>
                        );
                        return renderCategoryCell ? renderCategoryCell(tx, baseContent) : baseContent;
                      })()}
                    </Td>
                  )}
                  {columnVisibility.balance && (
                    <Td align="right" className="align-top font-semibold">
                      {typeof tx.runningBalance === 'number'
                        ? tx.runningBalance.toLocaleString(DEFAULT_LOCALE, {
                            style: 'currency',
                            currency: DEFAULT_CURRENCY,
                          })
                        : '—'}
                    </Td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function Th({
  children,
  align = 'left',
  className,
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  const alignmentClass = align === 'right' ? 'text-right' : 'text-left';
  return (
    <th
      className={cn(
        'px-4 py-3 text-xs font-semibold uppercase text-muted-foreground',
        alignmentClass,
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
  className,
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  const alignmentClass = align === 'right' ? 'text-right' : 'text-left';
  return <td className={cn('px-4 py-3', alignmentClass, className)}>{children}</td>;
}

function FlagPill({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-200"
    >
      {children}
    </Link>
  );
}
