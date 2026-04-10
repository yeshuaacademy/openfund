import { Heading, Logo } from "@/components";
import { Tick } from "@/icons";
import Image from "next/image";
import VsImg from "@/assets/images/vs.svg";
import VsColImg from "@/assets/images/vs-col.svg";

const cards = [
  {
    isGreen: false,
    title: "Financial Insights",
    items: [
      {
        time: "+ 15 hrs",
        text: "manual bookkeeping",
      },
      {
        time: "+ 3 hrs",
        text: "Excel chaos",
      },
      {
        time: "+ 8 hrs",
        text: "Chasing missing categories and statement mismatches",
      },
      {
        time: "+ 4 hrs",
        text: "No clean monthly close workflow",
      },
      {
        time: "+ 12 hrs",
        text: "Outdated financial overviews the moment they're made",
      },
      {
        time: "+ 2 hrs",
        text: "Team members working from different versions of the truth",
      },
      {
        time: "+ 2 hrs",
        text: "No single source of truth for the finance team",
      },
    ],
    totalTime: "= 55 hours of PROBLEMS",
  },
  {
    isGreen: true,
    title: <Logo />,
    items: [
      { text: "Automatically imports transactions from the bank" },
      { text: "Flags only the entries that need manual review" },
      { text: "Keeps reconciliation and running balances visible" },
      { text: "Protects closed periods with ledger locks" },
      { text: "Keeps all Yeshua Academy accounts in one workspace" },
      { text: "Provides exports and summaries for internal reporting" },
      { text: "Saves hours every month by reducing spreadsheet work" },
    ],
    totalTime: "= 17 min Setup",
  },
];

const ComparisonCard = ({ item }: any) => {
  return (
    <div
      className={`relative max-w-[350px] w-full pb-8 pt-6 px-4 min-h-[385px] border rounded-[16px] bg-white/85 text-slate-800 shadow-[0_30px_90px_-60px_rgba(15,23,42,0.25)] backdrop-blur-xl transition-transform duration-300 hover:scale-[1.05] dark:bg-gradient-to-r dark:from-[#1E242D] dark:to-[#0B111B] dark:text-white ${
        !item?.isGreen ? "border-[#EA2222]/80" : "border-[#1AAB12]/80"
      }`}
    >
      <div>
        <div className="mb-4 text-xl font-semibold">
          {item?.title}
        </div>
        {item?.items?.map((cardItem: any, index: number) => (
          <div
            key={index}
            className="flex gap-2 items-center justify-start mb-3"
          >
            {item?.isGreen ? (
              <div>
                <Tick width={20} height={20} />
              </div>
            ) : (
              <div className="text-[#EA2222] text-sm bg-[#FDE9E9] whitespace-nowrap px-[6px] py-1 rounded-[5px] dark:text-white dark:bg-[#EA2222]">
                {cardItem?.time}
              </div>
            )}
            <p className={`font-inter text-sm leading-relaxed`}>
              {cardItem?.text}
            </p>
          </div>
        ))}
      </div>
      <div
        className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 font-inter w-[250px] text-center font-bold text-base py-2 px-3 rounded-lg ${
          item?.isGreen
            ? "bg-[#1AAB12] text-white"
            : "bg-[#FDE9E9] text-[#EA2222] dark:text-white dark:bg-[#EA2222]"
        }`}
      >
        {item?.totalTime}
      </div>
    </div>
  );
};

const Comparison = () => {
  return (
    <div id="why" className="flex justify-center items-center w-full bg-white dark:bg-[#010814] pt-12 pb-24">
      <div className="max-w-[1440px] w-full px-4 sm:px-12">
        <div className="max-w-[640px] mx-auto mb-12">
          <Heading title="Why Finance Admin Exists" desc="Yeshua Academy needed a lean internal finance workspace for imports, reconciliation, and ledger review without the baggage of a sellable SaaS product." />
        </div>
        <div className="flex gap-8 items-center justify-center flex-col lg:flex-row">
          <ComparisonCard item={cards[0]} />
          <Image
            src={VsImg}
            alt="vs"
            width={134}
            height={350}
            className="h-[350px] hidden lg:block"
          />
          <Image
            src={VsColImg}
            alt="vs"
            width={134}
            height={350}
            className="h-[170px] block lg:hidden mt-4"
          />
          <ComparisonCard item={cards[1]} />
        </div>
      </div>
    </div>
  );
};

export default Comparison;
