'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ReactNode } from 'react';
import {
  LayoutDashboard as LayoutDashboardIcon,
  Table2 as TableIcon,
  TrendingUp,
  Inbox as InboxIcon,
  PieChart,
} from 'lucide-react';
import { cn } from '@/helpers/utils';

const NAVIGATION = [
  { href: '/ledger', label: 'Dashboard', icon: LayoutDashboardIcon },
  { href: '/ledger?view=overview', label: 'Monthly Overview', icon: PieChart },
  { href: '/ledger?view=transactions', label: 'Transactions', icon: TableIcon },
  { href: '/ledger?view=cashflow', label: 'Cash Flow', icon: TrendingUp },
  { href: '/review', label: 'Review Queue', icon: InboxIcon },
];

interface DashboardShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function DashboardShell({ title, subtitle, actions, children }: DashboardShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams?.get('view');

  const isActiveLink = (href: string) => {
    if (href === '/ledger') {
      return pathname === '/ledger' && !view;
    }
    const viewMatch = href.match(/view=([^&]+)/);
    if (viewMatch) {
      return pathname === '/ledger' && view === viewMatch[1];
    }
    return pathname === href;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#01040b] via-[#040a18] to-[#020617] text-slate-50">
      <main className="mx-auto flex min-h-screen w-full max-w-[1260px] flex-col px-[30px] py-10">
        <nav className="flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-white/5 p-2 shadow-[0_25px_90px_-60px_rgba(41,112,255,0.65)] backdrop-blur">
          {NAVIGATION.map((item) => {
            const isActive = isActiveLink(item.href);
            const Icon = item.icon ?? PieChart;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transform transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
                  isActive
                    ? 'bg-[#2970FF] text-white shadow-[0_0_30px_rgba(41,112,255,0.45)] ring-1 ring-[#5B9CFF]/60 hover:-translate-y-0.5 hover:shadow-[0_25px_75px_-45px_rgba(41,112,255,0.65)]'
                    : 'text-white/70 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white hover:shadow-lg',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <header className="mt-8 border-b border-white/10 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Overview</p>
              <h1 className="text-3xl font-semibold leading-tight text-white">{title}</h1>
              {subtitle ? <p className="text-sm text-white/60">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
          </div>
        </header>

        <section className="mt-6 flex-1">
          <div className="space-y-6 pb-10">{children}</div>
        </section>
      </main>
    </div>
  );
}
