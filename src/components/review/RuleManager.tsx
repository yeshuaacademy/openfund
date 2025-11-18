'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useLedger } from '@/context/ledger-context';

const MATCH_TYPES = [
  { value: 'contains', label: 'Contains' },
  { value: 'startsWith', label: 'Starts with' },
  { value: 'endsWith', label: 'Ends with' },
  { value: 'regex', label: 'Regex' },
] as const;

const MATCH_FIELDS = [
  { value: 'description', label: 'Description' },
  { value: 'counterparty', label: 'Counterparty' },
  { value: 'reference', label: 'Reference' },
  { value: 'source', label: 'Source' },
] as const;

const DEFAULT_PRIORITY = 100;

export type RuleFormState = {
  label: string;
  pattern: string;
  categoryId: string;
  matchType: string;
  matchField: string;
  priority: number;
  isActive: boolean;
};

type RuleManagerProps = {
  categoryOptions: Array<{ id: string; name: string }>;
  draft?: Partial<RuleFormState> & { categoryId?: string };
  onDraftConsumed?: () => void;
};

const createInitialState = (): RuleFormState => ({
  label: '',
  pattern: '',
  categoryId: '',
  matchType: 'contains',
  matchField: 'description',
  priority: DEFAULT_PRIORITY,
  isActive: true,
});

export function RuleManager({ categoryOptions, draft, onDraftConsumed }: RuleManagerProps) {
  const { rules, serverPipelineEnabled, createRule, updateRule, deleteRule, refreshRules } = useLedger();
  const [form, setForm] = useState<RuleFormState>(createInitialState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (draft && draft.pattern) {
      setForm((prev) => ({
        ...prev,
        ...draft,
        pattern: draft.pattern ?? prev.pattern,
        label: draft.label ?? draft.pattern ?? prev.label,
        categoryId: draft.categoryId ?? prev.categoryId,
        matchType: draft.matchType ?? prev.matchType,
        matchField: draft.matchField ?? prev.matchField,
      }));
      setEditingId(null);
      onDraftConsumed?.();
    }
  }, [draft, onDraftConsumed]);

  const sortedCategories = useMemo(
    () => categoryOptions.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [categoryOptions],
  );

  const handleChange = (field: keyof RuleFormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = field === 'priority'
        ? Number(event.target.value || DEFAULT_PRIORITY)
        : field === 'isActive'
        ? (event.target as HTMLInputElement).checked
        : event.target.value;
      setForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const resetForm = () => {
    setForm(createInitialState());
    setEditingId(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!serverPipelineEnabled) {
      toast.error('Rule management is only available when connected to the server.');
      return;
    }
    if (!form.label.trim() || !form.pattern.trim() || !form.categoryId) {
      toast.error('Label, pattern, and category are required.');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        label: form.label.trim(),
        pattern: form.pattern.trim(),
        categoryId: form.categoryId,
        matchType: form.matchType,
        matchField: form.matchField,
        priority: form.priority,
        isActive: form.isActive,
      };

      if (editingId) {
        await updateRule(editingId, payload);
        toast.success('Rule updated');
      } else {
        await createRule(payload);
        toast.success('Rule created');
      }

      resetForm();
    } catch (error) {
      console.error(error);
      toast.error(editingId ? 'Unable to update rule' : 'Unable to create rule');
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = (id: string) => {
    const rule = rules.find((item) => item.id === id);
    if (!rule) return;
    setEditingId(rule.id);
    setForm({
      label: rule.label,
      pattern: rule.pattern,
      categoryId: rule.categoryId,
      matchType: rule.matchType,
      matchField: rule.matchField,
      priority: rule.priority ?? DEFAULT_PRIORITY,
      isActive: rule.isActive,
    });
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      await updateRule(id, { isActive: active });
    } catch (error) {
      console.error(error);
      toast.error('Unable to update rule');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this rule?')) {
      return;
    }
    try {
      await deleteRule(id);
      toast.success('Rule deleted');
    } catch (error) {
      console.error(error);
      toast.error('Unable to delete rule');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70 transform transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/10 hover:shadow-lg"
          onClick={() => {
            refreshRules().catch(() => {});
            toast.success('Rules refreshed');
          }}
        >
          Refresh
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-white/10 bg-[#061124] p-4">
        <div className="grid gap-3">
          <label className="text-xs font-semibold text-white/60">
            Label
            <input
              type="text"
              value={form.label}
              onChange={handleChange('label')}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:border-[#2970FF]/70 focus:outline-none"
              placeholder="e.g. ING – Rent"
            />
          </label>
          <label className="text-xs font-semibold text-white/60">
            Pattern
            <input
              type="text"
              value={form.pattern}
              onChange={handleChange('pattern')}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:border-[#2970FF]/70 focus:outline-none"
              placeholder="What text should match?"
            />
          </label>
          <label className="text-xs font-semibold text-white/60">
            Category
            <select
              value={form.categoryId}
              onChange={handleChange('categoryId')}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:border-[#2970FF]/70 focus:outline-none"
            >
              <option value="">Select category</option>
              {sortedCategories.map((category) => (
                <option key={category.id} value={category.id} className="bg-[#061124]">
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-white/60">
            <label>
              Match type
              <select
                value={form.matchType}
                onChange={handleChange('matchType')}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:border-[#2970FF]/70 focus:outline-none"
              >
                {MATCH_TYPES.map((type) => (
                  <option key={type.value} value={type.value} className="bg-[#061124]">
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Field
              <select
                value={form.matchField}
                onChange={handleChange('matchField')}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:border-[#2970FF]/70 focus:outline-none"
              >
                {MATCH_FIELDS.map((field) => (
                  <option key={field.value} value={field.value} className="bg-[#061124]">
                    {field.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-white/60">
            <label>
              Priority
              <input
                type="number"
                value={form.priority}
                onChange={handleChange('priority')}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:border-[#2970FF]/70 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 pt-5 text-xs text-white/60">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={handleChange('isActive')}
                className="h-4 w-4 rounded border-white/20 bg-black/40 text-[#2970FF] focus:ring-0"
              />
              Active
            </label>
          </div>
        </div>
      <div className="flex items-center justify-between text-xs">
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy || !serverPipelineEnabled}
            className="rounded-lg border border-[#2970FF]/60 bg-[#2970FF]/80 px-3 py-1.5 font-semibold text-white transform transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#2970FF] hover:shadow-lg disabled:opacity-50"
          >
            {editingId ? (busy ? 'Updating…' : 'Update rule') : busy ? 'Creating…' : 'Create rule'}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-semibold text-white/70 transform transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/10 hover:shadow-lg"
            >
              Cancel
            </button>
          ) : null}
        </div>
          <span className="text-[11px] text-white/40">Priority ↑ means rule runs first</span>
        </div>
      </form>

      <div className="space-y-2">
        {rules.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-center text-xs text-white/50">
            No rules yet. Capture a recurring description to get started.
          </p>
        ) : null}
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="rounded-xl border border-white/10 bg-[#050F20] px-4 py-3 text-xs text-white/70"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{rule.label}</div>
                <div className="text-[11px] text-white/50">
                  {rule.matchType} {rule.matchField} → <span className="font-semibold text-white/70">{rule.categoryName ?? rule.categoryId}</span>
                </div>
                <div className="mt-1 text-[11px] text-white/40">Pattern: {rule.pattern}</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(rule.id)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/70 transition hover:bg-white/10"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleActive(rule.id, !rule.isActive)}
                  className="rounded-lg border border-white/10 px-2 py-1 text-[11px] font-semibold transition hover:bg-white/10"
                  style={{ color: rule.isActive ? '#34D399' : '#FBBF24', borderColor: 'rgba(255,255,255,0.1)' }}
                >
                  {rule.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(rule.id)}
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-200 transition hover:bg-red-500/20"
                >
                  Delete
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-white/40">
              <span>Priority {rule.priority}</span>
              <span>Updated {new Date(rule.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
