'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { ReviewTable } from '@/components/review/ReviewTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { useLedger } from '@/context/ledger-context';
import type { Category, LedgerTransaction } from '@/context/ledger-context';
import { ClipboardCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { RuleManager, RuleFormState } from '@/components/review/RuleManager';
import { DEFAULT_LOCALE } from '@/constants/intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const REVIEW_MAIN_ID = 'cat-review';
const REVIEW_SUB_ID = 'sub-review-needs-category';

export default function ReviewPage() {
  return (
    <Suspense fallback={<ReviewPageSkeleton />}>
      <ReviewPageContent />
    </Suspense>
  );
}

function ReviewPageSkeleton() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#050B18] text-white/60">
      Loading review queue…
    </div>
  );
}

function ReviewPageContent() {
  const { reviewTransactions, transactions, categoryTree, categories, assignCategory, clearReviewQueue: clearReviewQueueAction } =
    useLedger();

  const mainCategories = useMemo(
    () => categoryTree.main.filter((category) => category.id !== REVIEW_MAIN_ID),
    [categoryTree.main],
  );

  const subcategories = useMemo(() => {
    const result: Record<string, Category[]> = {};
    mainCategories.forEach((main) => {
      const subs = (categoryTree.byParent[main.id] ?? []).filter((category) => category.id !== REVIEW_SUB_ID);
      if (subs.length) {
        result[main.id] = subs;
      }
    });
    return result;
  }, [mainCategories, categoryTree.byParent]);

  const suggestions = useMemo(
    () => buildSuggestions(reviewTransactions),
    [reviewTransactions],
  );

  const [ruleDraft, setRuleDraft] = useState<Partial<RuleFormState> | undefined>(undefined);
  const [isClearDialogOpen, setClearDialogOpen] = useState(false);
  const [isClearingQueue, setIsClearingQueue] = useState(false);

  const handleCreateRuleDraft = useCallback((tx: LedgerTransaction) => {
    setRuleDraft({
      label: tx.description.slice(0, 60),
      pattern: tx.description,
      categoryId: tx.categoryId ?? '',
      matchType: 'contains',
      matchField: 'description',
      priority: 100,
      isActive: true,
    });
    toast.success('Rule form pre-filled above. Adjust and save.');
  }, []);

  const handleClearQueue = useCallback(async () => {
    if (!reviewTransactions.length) {
      setClearDialogOpen(false);
      return;
    }
    setIsClearingQueue(true);
    try {
      await clearReviewQueueAction();
      toast.success('Review queue cleared');
      setClearDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Unable to clear queue');
    } finally {
      setIsClearingQueue(false);
    }
  }, [clearReviewQueueAction, reviewTransactions.length]);

  const categoryOptions = useMemo(
    () => categories.map((category) => ({ id: category.id, name: category.name })),
    [categories],
  );

  return (
    <DashboardShell
      title="Needs Review"
      subtitle="Resolve uncategorized transactions so your reports stay accurate"
      actions={
        <div className="flex flex-col gap-3 text-xs font-medium text-white/60 sm:flex-row sm:items-center">
          <div className="inline-flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            {reviewTransactions.length.toLocaleString(DEFAULT_LOCALE)} items pending
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              disabled={reviewTransactions.length === 0 || isClearingQueue}
              onClick={() => setClearDialogOpen(true)}
            >
              Clear queue
            </Button>
          </div>
          <Dialog open={isClearDialogOpen} onOpenChange={setClearDialogOpen}>
            <DialogContent className="bg-[#060F1F]/90 text-white">
              <DialogHeader>
                <DialogTitle>Delete review queue?</DialogTitle>
                <DialogDescription className="text-sm text-white/70">
                  This will permanently delete all transactions currently in the review queue for this account. Confirmed ledger
                  transactions will not be affected.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setClearDialogOpen(false)}
                  disabled={isClearingQueue}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleClearQueue} disabled={isClearingQueue}>
                  {isClearingQueue ? 'Deleting…' : 'Delete queue'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-white/5 bg-[#060F1F]/70 p-6 shadow-inner shadow-black/30">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">Categorization rules</h2>
          <p className="mt-1 text-xs text-white/50">
            Automate recurring vendors with prioritized patterns. Save a rule to apply it to future imports instantly.
          </p>
          <div className="mt-4">
            <RuleManager
              categoryOptions={categoryOptions}
              draft={ruleDraft}
              onDraftConsumed={() => setRuleDraft(undefined)}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 bg-[#060F1F]/60 p-6 shadow-inner shadow-black/30">
          <ReviewTable
            transactions={reviewTransactions}
            categoryTree={{ mainCategories, subcategories }}
            suggestions={suggestions}
            onAssign={assignCategory}
            onCreateRule={handleCreateRuleDraft}
          />
        </section>
      </div>
    </DashboardShell>
  );
}

type Suggestion = {
  mainCategoryId?: string | null;
  mainCategoryName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  confidence: 'exact' | 'fuzzy' | 'none';
};

function buildSuggestions(reviewTransactions: LedgerTransaction[]): Record<string, Suggestion> {
  if (!reviewTransactions.length) return {};

  const suggestions: Record<string, Suggestion> = {};

  reviewTransactions.forEach((tx) => {
    const mainCategoryId = tx.mainCategoryId ?? null;
    const categoryId = tx.categoryId ?? null;
    const mainCategoryName =
      tx.mainCategoryName ?? tx.suggestedMainCategoryName ?? tx.rawMainCategoryName ?? null;
    const categoryName = tx.categoryName ?? tx.suggestedSubCategoryName ?? tx.rawCategoryName ?? null;

    let confidence: Suggestion['confidence'] = 'none';
    if (
      tx.classificationSource === 'history' ||
      tx.classificationSource === 'rule' ||
      tx.suggestionConfidence === 'exact'
    ) {
      confidence = 'exact';
    } else if (
      tx.classificationSource === 'import' &&
      tx.suggestionConfidence &&
      tx.suggestionConfidence !== 'review'
    ) {
      confidence = 'fuzzy';
    }

    suggestions[tx.id] = {
      mainCategoryId,
      mainCategoryName,
      categoryId,
      categoryName,
      confidence,
    };
  });

  return suggestions;
}
