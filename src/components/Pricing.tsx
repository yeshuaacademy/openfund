import { Heading, IconButton } from "@/components";
import { RightArrow, Tick } from "@/icons";

type PricingFeature = {
  id: number;
  text: string;
  is_heading?: boolean;
};

type PricingCardConfig = {
  id: number;
  title: string;
  subtitle?: string;
  price_label: string;
  price_suffix?: string;
  description: string;
  is_best_deal: boolean;
  btn_link: string;
  cta_text: string;
  features: PricingFeature[];
  footnote?: string;
};

const pricing_card: PricingCardConfig[] = [
  {
    id: 1,
    title: "Starter",
    subtitle: "Free forever",
    price_label: "Free",
    price_suffix: "/ forever",
    description: "For small teams or personal fund tracking.",
    is_best_deal: false,
    btn_link: "#",
    cta_text: "Start for Free",
    features: [
      { id: 1, text: "1 account" },
      { id: 2, text: "Up to 500 transactions / month" },
      { id: 3, text: "Manual and automatic categorization" },
      { id: 4, text: "Insight dashboard" },
      { id: 5, text: "Export reports (CSV, PDF)" },
    ],
  },
  {
    id: 2,
    title: "Community Plan",
    subtitle: "Best for growing transparency",
    price_label: "EUR 19",
    price_suffix: "/ month",
    description: "For churches, fundraisers, and nonprofits that need full transparency.",
    is_best_deal: true,
    btn_link: "#",
    cta_text: "Upgrade to Community",
    features: [
      { id: 1, text: "Everything in Starter, plus:", is_heading: true },
      { id: 2, text: "Unlimited accounts and transactions" },
      { id: 3, text: "Public transparency pages for campaigns" },
      { id: 4, text: "Multi-user access" },
      { id: 5, text: "Priority support and setup guidance" },
      { id: 6, text: "Early access to AI categorization" },
    ],
    footnote: "Hint: 19 euros a month to save 10+ hours of admin and gain full donor confidence.",
  },
];

const PricingCard = ({ item }: { item: (typeof pricing_card)[number] }) => {
	const cardClasses = item?.is_best_deal
		? 'border-indigo-200 bg-gradient-to-br from-[#eef0ff] via-[#f3f6ff] to-[#ffffff] text-slate-800 shadow-[0_35px_120px_-90px_rgba(15,23,42,0.35)] backdrop-blur-2xl dark:border-white/25 dark:bg-[linear-gradient(160deg,rgba(122,122,255,0.34),rgba(23,33,78,0.9))] dark:text-white dark:shadow-[0_40px_140px_-80px_rgba(49,112,255,0.85)]'
		: 'border-slate-200/80 bg-white/85 text-slate-800 shadow-[0_35px_120px_-90px_rgba(15,23,42,0.25)] backdrop-blur-2xl dark:border-white/12 dark:bg-[#0C162C]/85 dark:text-white dark:shadow-[0_35px_120px_-90px_rgba(15,23,42,0.55)]'

	return (
		<div
			className={`relative flex h-full flex-col gap-6 rounded-[32px] p-8 backdrop-blur-2xl transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_42px_150px_-90px_rgba(49,112,255,0.85)] ${cardClasses}`}
		>
			{item?.is_best_deal && (
				<div className='absolute -top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-indigo-200 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-indigo-600 shadow-[0_10px_30px_-20px_rgba(99,97,255,0.35)] backdrop-blur-xl dark:border-white/40 dark:bg-white/15 dark:text-white/85 dark:shadow-[0_10px_30px_-20px_rgba(99,97,255,0.75)]'>
					Most popular
				</div>
			)}
			<div className='flex flex-col gap-3'>
				<div>
					<p className='text-sm font-semibold uppercase tracking-[0.3em] text-slate-600 dark:text-white/60'>
						{item?.title}
					</p>
					{item?.subtitle && (
						<p className='mt-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-white/45'>
							{item.subtitle}
						</p>
					)}
				</div>
				<div className='flex items-end gap-2'>
					<p className='text-4xl font-semibold text-slate-900 sm:text-[2.75rem] dark:text-white'>
						{item?.price_label}
					</p>
					{item?.price_suffix && (
						<span className='pb-1 text-base font-medium text-slate-600 dark:text-white/65'>
							{item?.price_suffix}
						</span>
					)}
				</div>
				<p className='text-sm font-medium text-slate-700 sm:text-base dark:text-white/70'>{item?.description}</p>
			</div>
			<div className='flex flex-col gap-3'>
        {item.features.map((cardItem: PricingFeature) =>
          cardItem.is_heading ? (
            <p key={cardItem.id} className='pt-1 text-sm font-semibold text-slate-700 sm:text-base dark:text-white/75'>
              {cardItem.text}
            </p>
          ) : (
						<div
							key={cardItem.id}
							className='flex items-start gap-3 text-sm text-slate-700 sm:text-base dark:text-white/80'
						>
							<span className='mt-0.5 flex h-5 w-5 items-center justify-center'>
								<Tick width={18} height={18} />
							</span>
							<span className='flex-1'>{cardItem?.text}</span>
						</div>
					)
				)}
			</div>
			<div className='mt-auto space-y-3 pt-2'>
				<a href={item?.btn_link} className='block'>
					<IconButton text={item?.cta_text} icon={<RightArrow />} />
				</a>
				{item?.footnote && (
					<p className='text-center text-sm font-medium text-slate-600 dark:text-white/65'>{item.footnote}</p>
				)}
			</div>
		</div>
	)
}

const Pricing = () => {
  return (
    <section id="pricing" className="relative isolate overflow-hidden px-4 py-24 sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[20%] top-[10%] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,_rgba(122,122,255,0.25),_rgba(6,9,24,0))] blur-3xl" />
        <div className="absolute right-[18%] top-[60%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,_rgba(36,196,255,0.2),_rgba(6,9,24,0))] blur-3xl" />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-[1200px]">
        <div className="mx-auto max-w-[620px] text-center">
          <Heading
            title="Pricing"
            desc="Yeshua Academy Finance is being repositioned as an internal finance workspace, and this pricing section is slated for removal."
            maxWidth={520}
          />
        </div>
        <div className="mt-16 grid gap-8 md:grid-cols-2">
          {pricing_card.map((card) => (
            <PricingCard key={card.id} item={card} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
