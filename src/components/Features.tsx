import { Heading } from "@/components";
import { Auth, Blog, Email, Landing, Payment, Seo } from "@/icons";

const data = [
  {
    icon: <Landing />,
    title: "Ledger Overview",
    desc: "Track income, expenses, balances, and account-level performance from one internal finance workspace.",
    features: [
      "Monthly overview, transactions, and cash flow views",
      "Per-account balances and running totals",
      "Exports ready for internal reporting and review",
    ],
    time: "FINANCE DASHBOARD",
  },
  {
    icon: <Auth />,
    title: "Automated Ledger Imports",
    desc: "Drop in monthly bank files and let Finance Admin prepare the ledger with minimal manual work.",
    features: [
      "Upload statements once and let the import pipeline handle matching",
      "Automatic reconciliation across all of your accounts",
      "Spot exceptions instantly without combing through rows",
    ],
    time: "90% LESS MANUAL WORK",
  },
  {
    icon: <Email />,
    title: "Smart Categorization",
    desc: "Detects recurring payees and expense types. Flags only the ones needing manual review (usually under 10%). Save up to 90% of the time you spend on spreadsheets.",
    features: [
      "Learns recurring payees and categories automatically",
      "Surfaces only edge cases that need a manual review",
      "Keeps your chart of accounts consistent across the team",
    ],
    time: "95% AUTO-CATEGORIZED",
  },
  {
    icon: <Payment />,
    title: "Reconciliation Workflow",
    desc: "Lock opening balances, reconcile periods, and keep completed months protected from accidental edits.",
    features: [
      "Period locks after reconciliation",
      "Clear review queue for uncategorized transactions",
      "Status signals for balanced and pending work",
    ],
    time: "CLOSE THE BOOKS",
  },
  {
    icon: <Seo />,
    title: "Multi-Account Dashboard",
    desc: "Manage multiple accounts - church, outreach, fundraising - from one place. Separate ledgers, one unified view.",
    features: [
      "Switch between church, outreach, and fundraising accounts instantly",
      "Keep ledgers separated while rolling them into a single overview",
      "See consolidated balances without exporting a thing",
    ],
    time: "ALL ACCOUNTS, ONE HUB",
  },
  {
    icon: <Blog />,
    title: "Peace of Mind",
    desc: "Every transaction is traceable, every euro accounted for. Transparency you can stand behind.",
    features: [
      "Maintain an audit-ready trail for every transaction",
      "Document impact stories alongside the numbers",
      "Give leadership and donors reports they can trust",
    ],
    time: "CONFIDENCE GUARANTEED",
  },
];

const Features = () => {
  return (
    <section id="what" className="relative isolate overflow-hidden px-4 py-24 sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[6%] top-[18%] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,_rgba(122,122,255,0.28),_rgba(6,9,24,0))] blur-3xl" />
        <div className="absolute right-[4%] top-[58%] h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,_rgba(36,196,255,0.22),_rgba(6,9,24,0))] blur-3xl" />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-[1200px]">
        <div className="mx-auto mb-20 max-w-[640px] text-center">
          <Heading
            title="What Finance Admin Handles"
            desc="Purpose-built for Yeshua Academy finance operations: imports, categorization, reconciliation, and ledger oversight."
          />
        </div>
        <div className="grid gap-10 sm:grid-cols-2">
          {data?.map((item, index) => {
            return (
              <div
                key={index}
                className="rounded-[32px] border border-slate-200/80 bg-white/80 p-8 shadow-[0_45px_140px_-90px_rgba(15,23,42,0.3)] backdrop-blur-2xl transition hover:shadow-[0_60px_160px_-90px_rgba(15,23,42,0.35)] dark:border-white/15 dark:bg-white/5 dark:shadow-[0_45px_140px_-90px_rgba(41,112,255,0.55)] lg:p-10"
              >
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-[#4E5BFF] shadow-[0_16px_40px_-18px_rgba(82,109,255,0.35)] backdrop-blur-lg dark:border-white/15 dark:bg-[radial-gradient(circle_at_35%_35%,rgba(134,160,255,0.45),rgba(6,12,30,0.25))] dark:text-[#8FB3FF] dark:shadow-[0_20px_50px_-18px_rgba(68,110,255,0.55)]">
                      {item.icon}
                    </div>
                    <h3 className="text-2xl font-semibold text-slate-900 sm:text-3xl dark:text-white">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-base text-slate-700 sm:text-lg dark:text-white/75">
                    {item.desc}
                  </p>
                  <ul className="mt-6 space-y-3 text-slate-700 dark:text-white/80">
                    {item.features.map((feature, featureIndex) => (
                      <li
                        key={featureIndex}
                        className="flex items-start gap-3 text-sm font-medium leading-relaxed sm:text-base"
                      >
                        <span className="mt-1 size-2 rounded-full bg-gradient-to-r from-[#7A7AFF] to-[#24C4FF]" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-600 shadow-[0_12px_30px_-20px_rgba(99,97,255,0.25)] dark:border-white/20 dark:bg-gradient-to-r dark:from-[#7A7AFF] dark:via-[#5F65FF] dark:to-[#24C4FF] dark:text-white dark:shadow-[0_12px_40px_-20px_rgba(99,97,255,0.85)]">
                    {item.time}
                  </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
