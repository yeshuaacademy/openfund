export function AppShellExample() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-50">
      <div className="flex h-screen max-h-screen">
        <aside className="hidden w-72 flex-col border-r border-white/10 bg-[#050816] p-6 lg:flex">
          <div className="mb-6 flex items-center justify-between">
            <span className="text-lg font-semibold tracking-tight">Trust</span>
            <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/70">Pro</span>
          </div>

          <div className="mb-6">
            <input
              type="text"
              placeholder="Search"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            />
          </div>

          <nav className="space-y-1 text-sm text-white/70">
            {['Dashboard', 'Store', 'Team', 'Settings', 'Inbox'].map((item) => (
              <button
                key={item}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-white/5"
              >
                <span>{item}</span>
                <span className="h-2 w-2 rounded-full bg-white/30" />
              </button>
            ))}
          </nav>

          <div className="mt-6 space-y-3 text-sm text-white/70">
            <p className="text-xs uppercase tracking-wide text-white/40">Workspaces</p>
            {[
              { label: 'Growth', color: 'bg-emerald-400' },
              { label: 'Marketing', color: 'bg-indigo-400' },
              { label: 'Finance', color: 'bg-amber-400' },
            ].map((workspace) => (
              <div key={workspace.label} className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${workspace.color}`} />
                <span>{workspace.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            <p className="text-xs uppercase tracking-wide text-white/40">Storage</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span>180 GB used</span>
                <span className="text-white/50">200 GB</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div className="h-full w-[90%] rounded-full bg-gradient-to-r from-amber-400 to-rose-500" />
              </div>
              <p className="text-xs text-amber-300">Storage almost full</p>
            </div>
          </div>

          <div className="mt-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
            <div className="h-10 w-10 rounded-xl bg-white/10" />
            <div>
              <p className="font-medium">Evelyn Moore</p>
              <p className="text-xs text-white/50">evelyn@trustapp.com</p>
            </div>
            <div className="ml-auto h-2 w-2 rounded-full bg-emerald-400" />
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="border-b border-white/10 bg-[#020617]/95 px-8 py-6 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white">Dashboard</h1>
                <p className="text-sm text-white/60">Monitor your key metrics and team progress.</p>
              </div>
              <div className="flex items-center gap-3">
                <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
                  Share
                </button>
                <button className="rounded-xl bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-emerald-950">
                  New Report
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-8 py-8">
            <div className="grid gap-6 md:grid-cols-2">
              {["New Orders", "Website Traffic", "New Customers", "Support Tickets"].map((title) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-[#050c1c] p-6 shadow-inner shadow-black/30"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white/60">{title}</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{Math.floor(Math.random() * 900 + 100)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-white/5" />
                  </div>
                  <div className="mt-4 h-24 rounded-xl bg-gradient-to-br from-white/5 to-white/0" />
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
