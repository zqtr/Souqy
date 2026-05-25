"use client";

import { Check } from "lucide-react";
import {
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
  useTransform,
} from "motion/react";
import { useRef } from "react";
import { HomeStaggeredText } from "@/components/sections/home/HomeStaggeredText";

const plans = [
  {
    name: "Free",
    price: "0",
    description: "Start with one branded storefront and clear launch limits.",
    cta: "Start free",
    features: [
      "1 storefront",
      "10 products",
      "25 orders/month",
      "5% transaction fee",
    ],
  },
  {
    name: "Pro",
    price: "49",
    description: "The conversion plan for merchants ready to grow.",
    cta: "Choose Pro",
    features: [
      "2 storefronts",
      "Unlimited products",
      "Custom domain",
      "Remove branding",
      "Basic analytics",
      "3% transaction fee",
    ],
  },
  {
    name: "Pro+",
    price: "145",
    description: "Grow with Souqy, automation, and marketing integrations.",
    cta: "Choose Pro+",
    highlighted: true,
    features: [
      "Everything in Pro",
      "8 storefronts",
      "Souqy AI operator",
      "Meta/TikTok integrations",
      "1% transaction fee",
    ],
  },
  {
    name: "Max+",
    price: "235",
    description: "For agencies, operators, and multi-brand sellers.",
    cta: "Choose Max+",
    features: [
      "Everything in Pro+",
      "Unlimited storefronts",
      "White-label tools",
      "API access",
      "0% transaction fee",
    ],
  },
];

const MovingBorder = ({
  children,
  duration = 3000,
  rx,
  ry,
}: {
  children: React.ReactNode;
  duration?: number;
  rx?: string;
  ry?: string;
}) => {
  const pathRef = useRef<SVGRectElement | null>(null);
  const progress = useMotionValue<number>(0);

  useAnimationFrame((time: number) => {
    const length = pathRef.current?.getTotalLength();
    if (length) {
      const pxPerMillisecond = length / duration;
      progress.set((time * pxPerMillisecond) % length);
    }
  });

  const x = useTransform(
    progress,
    (val) => pathRef.current?.getPointAtLength(val).x,
  );
  const y = useTransform(
    progress,
    (val) => pathRef.current?.getPointAtLength(val).y,
  );

  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`;

  return (
    <>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="absolute h-full w-full"
        width="100%"
        height="100%"
      >
        <rect
          fill="none"
          width="100%"
          height="100%"
          rx={rx}
          ry={ry}
          ref={pathRef}
        />
      </svg>
      <motion.div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          display: "inline-block",
          transform,
        }}
      >
        {children}
      </motion.div>
    </>
  );
};

export default function Pricing1() {
  return (
    <section id="pricing" className="relative w-full bg-transparent px-[var(--gutter-tight)] py-16 sm:py-20 lg:px-[var(--gutter)]">
      <div className="mx-auto max-w-[1400px] w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
            className="mb-8 text-center sm:mb-12"
          >
          <HomeStaggeredText
            as="h1"
            className="mb-2 text-3xl font-medium leading-tight tracking-tight text-black dark:text-white"
            delay={22}
            text="Pricing for every AI storefront"
          />
          <HomeStaggeredText
            as="p"
            className="mx-auto max-w-2xl text-base text-black/68 dark:text-white/68 sm:text-lg md:text-xl"
            delay={16}
            text="Start free, then upgrade when your website, integrations, and operations need more power."
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="max-w-xl mx-auto mb-10 sm:mb-12"
        >
          <div className="relative overflow-hidden p-0.5 rounded-3xl">
            <div
              className="absolute inset-0"
              style={{ borderRadius: "1.5rem" }}
            >
              <MovingBorder duration={5000} rx="30%" ry="30%">
                <div className="h-48 w-48 bg-[radial-gradient(#10b981_15%,transparent_80%)] opacity-[0.5]" />
              </MovingBorder>
            </div>
            <div className="relative flex flex-col items-start justify-between gap-4 rounded-3xl border border-white/15 bg-white/10 py-4 pl-6 pr-4 backdrop-blur-md sm:flex-row sm:items-center">
              <div className="flex items-start gap-2 sm:gap-3">
                <div>
                  <HomeStaggeredText
                    as="h3"
                    className="mb-1 text-lg font-semibold text-black dark:text-white sm:text-xl"
                    delay={16}
                    text="Generate your first storefront free"
                  />
                  <div className="flex items-center gap-2 text-black/68 dark:text-white/68">
                    <HomeStaggeredText
                      as="span"
                      blur={false}
                      className="text-xs"
                      delay={10}
                      text="Use Souqna AI before choosing a paid plan."
                    />
                  </div>
                </div>
              </div>
              <button className="w-full sm:w-auto px-8 py-3.5 rounded-lg bg-black text-white dark:bg-white dark:text-black font-medium text-sm hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors duration-200">
                <HomeStaggeredText as="span" blur={false} delay={12} text="Get Started" />
              </button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 + index * 0.08 }}
              className={
                plan.highlighted
                  ? "relative flex flex-col overflow-hidden rounded-3xl border-2 border-black/30 bg-white/65 p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)] backdrop-blur-md ring-2 ring-black/20 dark:border-white/40 dark:bg-white/15 dark:shadow-[0_24px_60px_-20px_rgba(255,255,255,0.18)] dark:ring-white/25"
                  : "flex flex-col rounded-3xl border border-black/10 bg-white/55 p-5 backdrop-blur-md dark:border-white/15 dark:bg-white/10"
              }
            >

              <div className="relative z-10 flex flex-1 flex-col">
                <div className="mb-6">
                  <div className="flex items-center justify-between gap-3">
                    <HomeStaggeredText
                      as="h3"
                      className="text-xl font-bold text-black dark:text-white sm:text-2xl"
                      delay={14}
                      text={plan.name}
                    />
                    {plan.highlighted ? (
                      <HomeStaggeredText
                        as="span"
                        blur={false}
                        className="rounded-full bg-neutral-950 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-neutral-950"
                        delay={10}
                        text="Popular"
                      />
                    ) : null}
                  </div>
                  <HomeStaggeredText
                    as="p"
                    className="mt-4 min-h-16 text-sm text-black/68 dark:text-white/68 sm:text-base"
                    delay={12}
                    text={plan.description}
                  />
                </div>

                <div className="mb-8 flex items-baseline gap-1">
                  <HomeStaggeredText
                    as="span"
                    blur={false}
                    className="text-4xl font-bold text-black dark:text-white"
                    delay={10}
                    text={`$${plan.price}`}
                  />
                  <HomeStaggeredText
                    as="span"
                    blur={false}
                    className="text-sm text-black/55 dark:text-white/55"
                    delay={10}
                    text="/mo"
                  />
                </div>

                <div className="flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-black dark:text-white" />
                      <HomeStaggeredText
                        as="span"
                        blur={false}
                        className="text-sm text-black/78 dark:text-white/78 sm:text-base"
                        delay={10}
                        text={feature}
                      />
                    </div>
                  ))}
                </div>

                <button className="mt-8 w-full rounded-lg bg-black px-6 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 sm:text-base">
                  <HomeStaggeredText as="span" blur={false} delay={12} text={plan.cta} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
