export function DashboardExample() {
  return (
    <div className="min-h-screen bg-[#020617] px-8 py-10 text-slate-50">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-white/40">Overview</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Dashboard</h1>
          <p className="text-sm text-white/60">Visualize your main activities data.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
            Download
          </button>
          <button className="rounded-2xl bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-emerald-950">
            Share
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-[#050c1c] p-6 shadow-inner shadow-black/30 lg:col-span-2">
          <p className="text-sm text-white/60">Revenue</p>
          <p className="mt-2 text-3xl font-semibold">€128,450</p>
          <div className="mt-6 h-48 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-white/5 to-transparent p-4">
            <div className="h-full w-full rounded-2xl border border-white/5 bg-white/5" />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#050c1c] p-6 shadow-inner shadow-black/30">
          <p className="text-sm text-white/60">Website Traffic</p>
          <div className="mt-4 space-y-3">
            {[65, 45, 80, 55].map((value) => (
              <div key={value}>
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>Channel</span>
                  <span>{value}%</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-emerald-400"
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#050c1c] p-6 shadow-inner shadow-black/30">
          <p className="text-sm text-white/60">New Customers</p>
          <p className="mt-2 text-3xl font-semibold">312</p>
          <div className="mt-4 space-y-2">
            {[60, 40, 70, 35].map((height, index) => (
              <div key={index} className="flex items-end gap-1">
                <div className="h-24 w-2 rounded-full bg-white/10" />
                <div
                  className="w-full rounded-full bg-gradient-to-t from-rose-500/50 to-rose-300"
                  style={{ height: `${height}px` }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#050c1c] p-6 shadow-inner shadow-black/30 lg:col-span-2">
          <p className="text-sm text-white/60">Cashflow</p>
          <div className="mt-4 h-48 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-white/5 to-transparent" />
        </div>
      </div>
    </div>
  );
}
