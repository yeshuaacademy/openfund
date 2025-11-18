'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  LEDGER_PRIMARY_BUTTON_CLASSES,
  ExportEmailContext,
  ExportPayload,
  downloadExportPayload,
  blobToBase64,
} from '@/helpers/export-utils';
import { Download, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

type ExportActionsProps = {
  getExportPayload?: () => Promise<ExportPayload>;
  context: ExportEmailContext;
};

const STORAGE_KEY = 'ledger-notify-subscribers';

export function ExportActions({ getExportPayload, context }: ExportActionsProps) {
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const hasHandler = Boolean(getExportPayload);

  const handleExport = useCallback(async () => {
    if (!getExportPayload) return;
    setIsExporting(true);
    try {
      const payload = await getExportPayload();
      downloadExportPayload(payload);
    } catch (error) {
      console.error(error);
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [getExportPayload]);

  return (
    <div className="flex items-center gap-4">
      <Button
        type="button"
        className={`${LEDGER_PRIMARY_BUTTON_CLASSES} gap-2`}
        onClick={() => setNotifyOpen(true)}
        disabled={!hasHandler}
      >
        <Mail className="h-4 w-4" />
        Notify
      </Button>
      <Button
        type="button"
        className={`${LEDGER_PRIMARY_BUTTON_CLASSES} gap-2`}
        onClick={handleExport}
        disabled={!hasHandler || isExporting}
      >
        <Download className="h-4 w-4" />
        {isExporting ? 'Preparing…' : 'Export'}
      </Button>
      <NotifySubscribersDialog
        open={notifyOpen}
        onOpenChange={setNotifyOpen}
        getExportPayload={getExportPayload}
        context={context}
      />
    </div>
  );
}

function NotifySubscribersDialog({
  open,
  onOpenChange,
  getExportPayload,
  context,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getExportPayload?: () => Promise<ExportPayload>;
  context: ExportEmailContext;
}) {
  const [emails, setEmails] = useState<string[]>([]);
  const [draftEmail, setDraftEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setEmails(parsed.filter((value) => typeof value === 'string'));
        }
      }
    } catch (error) {
      console.error('Failed to load subscriber list', error);
    }
  }, [open]);

  const handleAdd = () => {
    const trimmed = draftEmail.trim();
    if (!trimmed) {
      toast.error('Enter an email address');
      return;
    }
    if (!isValidEmail(trimmed)) {
      toast.error('Enter a valid email address');
      return;
    }
    if (emails.includes(trimmed)) {
      toast.error('Email already added');
      return;
    }
    setEmails((state) => [...state, trimmed]);
    setDraftEmail('');
  };

  const handleRemove = (index: number) => {
    setEmails((state) => state.filter((_, idx) => idx !== index));
  };

  const handleEmailChange = (index: number, value: string) => {
    setEmails((state) =>
      state.map((email, idx) => (idx === index ? value : email)),
    );
  };

  const handleSave = async () => {
    if (!emails.length) {
      toast.error('Add at least one email address');
      return;
    }
    if (!getExportPayload) {
      toast.error('Export unavailable');
      return;
    }

    const sanitized = emails
      .map((email) => email.trim())
      .filter((email) => isValidEmail(email));

    if (!sanitized.length) {
      toast.error('No valid email addresses');
      return;
    }

    setIsSaving(true);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      }
      const payload = await getExportPayload();
      const base64Content = await blobToBase64(payload.data);
      const htmlString = await payload.data.text();
      const response = await fetch('/api/ledger/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipients: sanitized,
          attachment: {
            filename: payload.filename,
            mimeType: payload.mimeType,
            content: base64Content,
          },
          html: htmlString,
          context,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to send notification');
      }
      toast.success('Notification sent');
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error('Unable to send notification');
    } finally {
      setIsSaving(false);
    }
  };

  const existingList = useMemo(() => emails, [emails]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#060F1F]/90 text-white">
        <DialogHeader>
          <DialogTitle>Notify Subscribers</DialogTitle>
          <DialogDescription className="text-sm text-white/60">
            Email the latest export to your subscriber list.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-white/60">
              Add email
            </label>
            <div className="flex items-center gap-2">
              <Input
                value={draftEmail}
                onChange={(event) => setDraftEmail(event.target.value)}
                placeholder="name@example.com"
                className="bg-[#030914]/80 text-white"
              />
              <Button type="button" variant="ghost" onClick={handleAdd}>
                Add
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Subscribers</p>
            {existingList.length ? (
              <div className="space-y-3">
                {existingList.map((email, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={email}
                      onChange={(event) => handleEmailChange(index, event.target.value)}
                      className="bg-[#030914]/80 text-white"
                    />
                    <Button type="button" variant="ghost" onClick={() => handleRemove(index)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/50">No subscribers yet. Add an email above.</p>
            )}
          </div>
        </div>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            className={LEDGER_PRIMARY_BUTTON_CLASSES}
            onClick={handleSave}
            disabled={isSaving || !getExportPayload}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const isValidEmail = (value: string) => {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(value);
};
