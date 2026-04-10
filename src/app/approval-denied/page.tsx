export const metadata = {
  title: "Access Denied | Yeshua Academy Finance",
};

const ApprovalDeniedPage = () => (
  <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-24 text-white">
    <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-white/5 p-10 text-center shadow-[0_40px_160px_-80px_rgba(15,23,42,0.65)] backdrop-blur-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">
        Request Access
      </p>
      <h1 className="mt-4 text-3xl font-semibold">Request closed</h1>
      <p className="mt-3 text-base text-slate-200">
        The requester has been notified of your decision. Thanks for reviewing.
      </p>
      <a
        href="/"
        className="mt-8 inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:scale-[1.02]"
      >
        Back to Finance Admin
      </a>
    </div>
  </main>
);

export default ApprovalDeniedPage;
