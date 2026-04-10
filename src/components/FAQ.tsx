"use client";

import React, { useState, useEffect } from "react";
import { Heading } from "@/components";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const StaticData = {
	title: "Frequently Asked Questions",
	below_title: "Have another question? Contact us.",
	faqs: [
		{
			id: 1,
			question: "What is Finance Admin?",
			answer:
				"Finance Admin is Yeshua Academy&apos;s internal finance workspace for ledger imports, categorization review, reconciliation, and account oversight.",
		},
		{
			id: 2,
			question: "Does it support multiple accounts?",
			answer: "Yes. You can keep separate accounts and balances inside one shared finance workspace.",
		},
		{
			id: 3,
			question: "Is this a public donor portal?",
			answer:
				"No. This application is an internal finance administration tool for Yeshua Academy, not a public fundraising or donor-facing product.",
		},
		{
			id: 4,
			question: "Where does my data come from?",
			answer:
				"You upload bank statements or ledger files, and the system imports, categorizes, and prepares them for review.",
		},
		{
			id: 5,
			question: "Do I need accounting experience?",
			answer:
				"Not necessarily. The workflow is designed to make finance administration easier for the internal team, with review and reconciliation built into the app.",
		},
	],
};

const Faq = ({ data, isHomePage }: any) => {
  const StaticFAQs = StaticData.faqs;
  const faqData = data?.length > 0 ? data : StaticFAQs;

  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null; // Avoid rendering until after the initial mount
  }

  return (
    <div id="faq" className="flex justify-center items-center bg-white dark:bg-[#010814] my-16 w-full">
      <div className="max-w-[1440px] w-full px-4 sm:px-12">
        {isHomePage && (
          <div className="max-w-[624px] mx-auto mb-16">
            <Heading
              title="Frequently Asked Questions"
              desc="Have another question? Contact us."
            />
          </div>
        )}
        <div>
          <Accordion defaultValue={["item-0"]} type="multiple">
            {faqData?.map((item: any, index: number) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="shadow-2xl dark:shadow-none border dark:border-[#373C53] py-2 px-6 rounded-[12px] bg-white dark:bg-gradient-to-r from-[#1E242D] to-[#0B111B] h-full transition-all duration-300 mb-4"
              >
                <AccordionTrigger className="text-start font-semibold text-xl hover:no-underline">
                  {item?.question}
                </AccordionTrigger>
                <AccordionContent className="mt-2">
                  <div className="text-[#010610A6] dark:text-[#808389] font-medium text-base sm:mr-12 mb-4">
                    <div dangerouslySetInnerHTML={{ __html: item?.answer }} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
};

export default Faq;
