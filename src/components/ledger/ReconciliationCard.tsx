'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useLedger } from '@/context/ledger-context';
import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from '@/constants/intl';
import {
  fetchAccounts,
  fetchReconciliation,
  saveOpeningBalance,
  lockOpeningBalance as apiLockOpeningBalance,
  lockLedgerPeriod,
  unlockLedgerPeriod,
} from '@/libs/api';
import { cn } from '@/helpers/utils';

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Date(Date.UTC(2020, index, 1)).toLocaleString('en-GB', { month: 'long' }),
}));

type AccountSummary = {
  id: string;
  name: string;
  identifier: string;
  currency: string;
  hasOpeningBalance: boolean;
  openingBalance: {
    id: string;
    amountMinor: string;
    effectiveDate: string;
    lockedAt: string | null;
  } | null;
};

type ReconciliationPayload = Awaited<ReturnType<typeof fetchReconciliation>>;

type ReconciliationStatus = 'balanced' | 'unreconciled' | 'unknown';

const formatCurrency = (valueMinor: string | null, currency = DEFAULT_CURRENCY) => {
  if (!valueMinor) return '—';
  const amount = Number(valueMinor) / 100;
  return amount.toLocaleString(DEFAULT_LOCALE, {
    style: 'currency',
    currency,
  });
};

export function ReconciliationCard({ className, onStatusChange }: { className?: string; onStatusChange?: (status: ReconciliationStatus) => void }) {
  const { serverPipelineEnabled } = useLedger();
  const now = useMemo(() => new Date(), []);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [month, setMonth] = useState<number>(now.getUTCMonth() + 1);
  const [year, setYear] = useState<number>(now.getUTCFullYear());
  const [loading, setLoading] = useState(false);
  const [savingOpening, setSavingOpening] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const [data, setData] = useState<ReconciliationPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openingAmount, setOpeningAmount] = useState('');
  const [openingDate, setOpeningDate] = useState('');
  const [openingNote, setOpeningNote] = useState('');

  useEffect(() => {
    if (!serverPipelineEnabled) return;

    const load = async () => {
      try {
        const result: AccountSummary[] = await fetchAccounts();
        setAccounts(result);
        if (result.length && !selectedAccount) {
          setSelectedAccount(result[0]!.id);
        }
      } catch (err) {
        console.error(err);
        setError('Unable to load accounts');
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverPipelineEnabled]);

  useEffect(() => {
    if (!serverPipelineEnabled || !selectedAccount) {
      onStatusChange?.('unknown');
      return;
    }

    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchReconciliation({
          accountId: selectedAccount,
          month,
          year,
        });
        if (!controller.signal.aborted) {
          setData(result);
          onStatusChange?.(result.status);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error(err);
          setError(err instanceof Error ? err.message : 'Unable to load reconciliation');
          onStatusChange?.('unknown');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => controller.abort();
  }, [serverPipelineEnabled, selectedAccount, month, year, onStatusChange]);

  if (!serverPipelineEnabled) {
    return null;
  }

  const selectedAccountSummary = accounts.find((account) => account.id === selectedAccount) ?? null;
  const currency = data?.account.currency ?? selectedAccountSummary?.currency ?? 'EUR';

  const handleSaveOpening = async () => {
    if (!selectedAccount || !openingDate || !openingAmount) {
      toast.error('Opening amount and effective date are required');
      return;
    }
    setSavingOpening(true);
    try {
      await saveOpeningBalance(selectedAccount, {
        effectiveDate: openingDate,
        amount: openingAmount,
        currency,
        note: openingNote,
      });
      toast.success('Opening balance saved');
      setOpeningAmount('');
      setOpeningDate('');
      setOpeningNote('');
      const refreshedAccounts = await fetchAccounts();
      setAccounts(refreshedAccounts);
      const refreshedReconciliation = await fetchReconciliation({
        accountId: selectedAccount,
        month,
        year,
      });
      setData(refreshedReconciliation);
      onStatusChange?.(refreshedReconciliation.status);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Unable to save opening balance');
      onStatusChange?.('unknown');
    } finally {
      setSavingOpening(false);
    }
  };

  const handleLockOpening = async () => {
    if (!data?.openingBalance?.amountMinor || !data.openingBalance.effectiveDate || !selectedAccountSummary?.openingBalance?.id) {
      toast.error('Opening balance required before locking');
      return;
    }

    setLockBusy(true);
    try {
      await apiLockOpeningBalance(selectedAccountSummary.openingBalance.id);
      toast.success('Opening balance locked');
      const refreshed = await fetchAccounts();
      setAccounts(refreshed);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Unable to lock opening balance');
    } finally {
      setLockBusy(false);
    }
  };

  const handleLedgerLock = async () => {
    if (!data?.ledger.id) {
      toast.error('No ledger for this period');
      return;
    }
    setLockBusy(true);
    try {
      await lockLedgerPeriod(data.ledger.id);
      toast.success('Ledger locked');
      const refreshed = await fetchReconciliation({ accountId: selectedAccount!, month, year });
      setData(refreshed);
      onStatusChange?.(refreshed.status);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Unable to lock ledger');
      onStatusChange?.('unknown');
    } finally {
      setLockBusy(false);
    }
  };

  const handleLedgerUnlock = async () => {
    if (!data?.ledger.id) {
      toast.error('No ledger for this period');
      return;
    }
    setLockBusy(true);
    try {
      await unlockLedgerPeriod(data.ledger.id);
      toast.success('Ledger unlocked');
      const refreshed = await fetchReconciliation({ accountId: selectedAccount!, month, year });
      setData(refreshed);
      onStatusChange?.(refreshed.status);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Unable to unlock ledger');
      onStatusChange?.('unknown');
    } finally {
      setLockBusy(false);
    }
  };

  return (
    <section className={cn('rounded-2xl border border-white/5 bg-[#060F1F]/60 p-6 shadow-inner shadow-black/30', className)}>
      <header className="flex flex-wrap items-center justify-between gap-4 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Bank Reconciliation</h2>
          <p className="text-xs text-white/60">Ensure statement balances match ledger totals for the selected month.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <label htmlFor="account-select" className="text-white/60">
              Account
            </label>
            <select
              id="account-select"
              value={selectedAccount ?? ''}
              onChange={(event) => setSelectedAccount(event.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white/80 focus:border-[#2970FF]/70 focus:outline-none"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id} className="bg-[#060F1F] text-white/80">
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="month-select" className="text-white/60">
              Period
            </label>
            <select
              id="month-select"
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white/80 focus:border-[#2970FF]/70 focus:outline-none"
            >
              {MONTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#060F1F] text-white/80">
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-right text-white/80 focus:border-[#2970FF]/70 focus:outline-none"
              min={2000}
              max={9999}
            />
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Opening balance"
          value={formatCurrency(data?.openingBalance.amountMinor ?? selectedAccountSummary?.openingBalance?.amountMinor ?? null, currency)}
          hint={data?.openingBalance.effectiveDate ? new Date(data.openingBalance.effectiveDate).toLocaleDateString() : 'Not set'}
        />
        <MetricCard
          label="Statement end"
          value={formatCurrency(data?.statementEndBalanceMinor ?? null, currency)}
          hint={data?.status === 'unknown' ? 'No statement balance yet' : undefined}
        />
        <MetricCard
          label="Ledger total"
          value={formatCurrency(data?.computedEndBalanceMinor ?? null, currency)}
          hint={loading ? 'Recomputing…' : undefined}
        />
        <StatusCard status={data?.status ?? 'unknown'} difference={formatCurrency(data?.differenceMinor ?? null, currency)} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">Opening balance</h3>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-white/50">Effective date</span>
              <input
                type="date"
                value={openingDate}
                onChange={(event) => setOpeningDate(event.target.value)}
                className="rounded-lg border border-white/10 bg-[#050B18] px-3 py-2 text-xs text-white/80 focus:border-[#2970FF]/70 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-white/50">Amount ({currency})</span>
              <input
                type="number"
                step="0.01"
                value={openingAmount}
                onChange={(event) => setOpeningAmount(event.target.value)}
                className="rounded-lg border border-white/10 bg-[#050B18] px-3 py-2 text-xs text-white/80 focus:border-[#2970FF]/70 focus:outline-none"
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-1">
              <span className="text-[11px] font-medium text-white/50">Note (optional)</span>
              <input
                type="text"
                value={openingNote}
                onChange={(event) => setOpeningNote(event.target.value)}
                className="rounded-lg border border-white/10 bg-[#050B18] px-3 py-2 text-xs text-white/80 focus:border-[#2970FF]/70 focus:outline-none"
                placeholder="e.g. Verified against June statement"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleSaveOpening}
              disabled={savingOpening}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#2970FF]/80 px-3 py-1.5 font-semibold text-white transform transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#2970FF] hover:shadow-lg disabled:opacity-50"
            >
              {savingOpening ? 'Saving…' : 'Save opening balance'}
            </button>
            <button
              type="button"
              onClick={handleLockOpening}
              disabled={lockBusy || !selectedAccountSummary?.openingBalance}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-semibold text-white/80 transform transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/10 hover:shadow-lg disabled:opacity-40"
            >
              Lock opening
            </button>
            {selectedAccountSummary?.openingBalance?.lockedAt ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-200">
                Locked {new Date(selectedAccountSummary.openingBalance.lockedAt).toLocaleDateString()}
              </span>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">Period controls</h3>
          <p className="mb-3 text-xs text-white/60">
            Lock the ledger once the statement is reconciled. Unlocking re-allows imports & edits for this month.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleLedgerLock}
              disabled={lockBusy || !data?.ledger.id || Boolean(data?.ledger.lockedAt)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-emerald-500/80 px-3 py-1.5 font-semibold text-white transform transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-lg disabled:opacity-50"
            >
              Lock period
            </button>
            <button
              type="button"
              onClick={handleLedgerUnlock}
              disabled={lockBusy || !data?.ledger.id || !data?.ledger.lockedAt}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-red-500/10 px-3 py-1.5 font-semibold text-red-200 transform transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-red-500/20 hover:shadow-lg disabled:opacity-40"
            >
              Unlock period
            </button>
            {data?.ledger.lockedAt ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-200">
                Locked {new Date(data.ledger.lockedAt).toLocaleDateString()}
              </span>
            ) : (
              <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/60">
                Unlocked
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">Missing days</h3>
          {(!data || loading) && <p className="text-xs text-white/50">Calculating…</p>}
          {data && data.missingDates.length === 0 ? (
            <p className="text-xs text-emerald-200">No gaps detected.</p>
          ) : null}
          {data && data.missingDates.length > 0 ? (
            <ul className="grid grid-cols-2 gap-1 text-[11px] text-white/70">
              {data.missingDates.slice(0, 12).map((iso: string) => (
                <li key={iso}>{new Date(iso).toLocaleDateString()}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">Potential duplicates</h3>
          {(!data || loading) && <p className="text-xs text-white/50">Scanning…</p>}
          {data && data.duplicateIndicators.length === 0 ? (
            <p className="text-xs text-emerald-200">No duplicate patterns found.</p>
          ) : null}
          {data && data.duplicateIndicators.length > 0 ? (
            <ul className="space-y-1 text-[11px] text-white/70">
              {data.duplicateIndicators.slice(0, 6).map((item: { date: string; description: string; amountMinor: string; occurrences: number }) => (
                <li key={`${item.date}-${item.amountMinor}-${item.description}`}>
                  <span className="font-semibold">{new Date(item.date).toLocaleDateString()}:</span> {item.description} · {formatCurrency(item.amountMinor, currency)} · {item.occurrences}x
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <footer className="mt-6 text-[11px] text-white/50">
        {data?.transactions.length ? (
          <p>
            {data.transactions.length.toLocaleString(DEFAULT_LOCALE)} statement lines processed. Running balance reflects opening + activity in chronological order.
          </p>
        ) : (
          <p>No transactions for this period yet.</p>
        )}
      </footer>
    </section>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
      <div className="text-[11px] uppercase tracking-wide text-white/50">{label}</div>
      <div className="mt-1 text-base font-semibold text-white">{value}</div>
      {hint ? <div className="text-[11px] text-white/50">{hint}</div> : null}
    </div>
  );
}

function StatusCard({ status, difference }: { status: ReconciliationStatus; difference: string }) {
  let tone = 'bg-white/10 text-white/70 border-white/20';
  let label = '🕒 Awaiting statement';

  if (status === 'balanced') {
    tone = 'bg-emerald-500/20 text-emerald-100 border-emerald-400/30';
    label = '✅ Reconciled';
  } else if (status === 'unreconciled') {
    tone = 'bg-amber-500/15 text-amber-100 border-amber-400/30';
    label = difference ? `⚠️ Mismatch (${difference})` : '⚠️ Mismatch';
  }

  return (
    <div className={cn('rounded-xl border px-4 py-3 text-sm font-semibold', tone)}>{label}</div>
  );
}
