export type ExportPayload = {
  filename: string;
  mimeType: string;
  data: Blob;
};

export const LEDGER_PRIMARY_BUTTON_CLASSES =
  'inline-flex items-center justify-center rounded-md border border-transparent bg-[#2970FF] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2970FF]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-70';

export const downloadExportPayload = (payload: ExportPayload) => {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(payload.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = payload.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const blobToBase64 = async (blob: Blob): Promise<string> => {
	const arrayBuffer = await blob.arrayBuffer();
	const bytes = new Uint8Array(arrayBuffer);
	if (typeof window === 'undefined') {
		return Buffer.from(bytes).toString('base64');
	}
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i += 1) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
};

export type ExportEmailContext =
  | { view: 'dashboard'; periodLabel?: string }
  | { view: 'monthly'; periodLabel: string; accountLabel: string }
  | { view: 'transactions'; description: string }
  | { view: 'cashflow'; periodLabel: string };
