'use client';

import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useLedger } from '@/context/ledger-context';

export function UploadCsvButton() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const { importCsv, refreshLedger } = useLedger();

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setBusy(true);

    try {
      const summary = await importCsv(file);
      const parts = [
        `Imported ${summary.importedCount}`,
        `Auto ${summary.autoCategorized}`,
        `Review ${summary.reviewCount}`,
      ];

      if (summary.duplicateCount) {
        parts.push(`Duplicates ${summary.duplicateCount}`);
      }

      if (summary.errorCount) {
        parts.push(`Errors ${summary.errorCount}`);
      }

      toast.success(parts.join(' • '));
      await refreshLedger();

      if (summary.errors && summary.errors.length) {
        console.warn('Import row issues', summary.errors);
        toast((t) => (
          <div className="text-left text-sm">
            <div className="font-semibold mb-1">Import completed with warnings</div>
            <div className="max-h-32 overflow-y-auto">
              <ul className="list-disc pl-4">
                {summary.errors.slice(0, 3).map((error) => (
                  <li key={`${error.rowNumber}-${error.message}`}>{`Row ${error.rowNumber}: ${error.message}`}</li>
                ))}
              </ul>
              {summary.errors.length > 3 ? (
                <div className="mt-2 text-xs opacity-70">{summary.errors.length - 3} more rows skipped</div>
              ) : null}
            </div>
          </div>
        ));
      }
    } catch (error) {
      console.error(error);
      toast.error('Upload failed. Please try again.');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="btn bg-primary text-white px-4 py-2 rounded-md hover:opacity-90 transition"
        disabled={busy}
      >
        {busy ? 'Importing…' : 'Import Statement'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
}
