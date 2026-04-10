import { NextResponse } from 'next/server';
import { resendService } from '@/libs/resend';
import config from '@/config';
import type { ExportEmailContext } from '@/helpers/export-utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const recipients = Array.isArray(body.recipients) ? body.recipients : [];
    const attachment = body.attachment as { filename: string; mimeType?: string; content: string } | undefined;
    const rawHtml = typeof body.html === 'string' ? body.html : '';
    const context = body.context as ExportEmailContext | undefined;

    if (!recipients.length) {
      return NextResponse.json({ error: 'Recipients required' }, { status: 400 });
    }

    if (!attachment || !attachment.filename || !attachment.content) {
      return NextResponse.json({ error: 'Attachment missing' }, { status: 400 });
    }

    const emailHtml = buildEmailHtml(rawHtml, context);

    await resendService.sendEmail(
      {
        from: config.resend.fromAdmin,
        to: recipients,
        subject: `Ledger export: ${attachment.filename}`,
        html: emailHtml,
        attachments: [
          {
            filename: attachment.filename,
            content: attachment.content,
            contentType: attachment.mimeType ?? 'application/octet-stream',
          },
        ],
      },
      'ledger export notification',
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Notify export failed', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}

const buildEmailHtml = (exportHtml: string, context?: ExportEmailContext): string => {
  const intro = buildExportIntro(context);
  const closing = buildClosingHtml();
  const safeExportHtml = exportHtml || '<p>Your ledger export is below.</p>';

  return `
    <div style="font-family: 'Inter', 'Segoe UI', sans-serif; font-size:14px; line-height:1.6; color:#0f172a;">
      ${intro}
      <div style="margin:24px 0; padding:16px; border:1px solid #e2e8f0; border-radius:12px;">
        ${safeExportHtml}
      </div>
      ${closing}
    </div>
  `;
};

const buildExportIntro = (context?: ExportEmailContext): string => {
  const greeting = '<p>Hi there,</p>';
  if (!context) {
    return `${greeting}<p>You&#8217;re receiving the latest ledger export.</p>`;
  }
  switch (context.view) {
    case 'monthly':
      return `${greeting}<p>You&#8217;re receiving the monthly overview for ${context.accountLabel} covering ${context.periodLabel}.</p>`;
    case 'transactions':
      return `${greeting}<p>You&#8217;re receiving the transaction overview for ${context.description}.</p>`;
    case 'cashflow':
      return `${greeting}<p>You&#8217;re receiving the cash flow overview for ${context.periodLabel}.</p>`;
    case 'dashboard':
      return `${greeting}<p>You&#8217;re receiving the performance summary for your ledger for ${context.periodLabel ?? 'the current period'}.</p>`;
    default:
      return `${greeting}<p>You&#8217;re receiving the latest ledger export.</p>`;
  }
};

const buildClosingHtml = () => {
  return `
    <p style="margin-top:24px;">Thank you for using Yeshua Academy Finance.</p>
    <p>If you have any questions, you can reply to this email or contact Steve at <a href="mailto:Steve@yeshua.academy">Steve@yeshua.academy</a>.</p>
  `;
};
