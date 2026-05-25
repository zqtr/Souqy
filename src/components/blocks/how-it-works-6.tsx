'use client';

import { Layers, Rocket, SlidersHorizontal, Sparkles, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { HomeStaggeredText } from '@/components/sections/home/HomeStaggeredText';
import type { Locale } from '@/i18n/locales';

export type HowItWorksStep = {
  key: 'begin' | 'build' | 'tune' | 'publish';
  roman: string;
  name: string;
  echoName: string;
  time: string;
  caption: string;
  body: string;
};

type Props = {
  locale: Locale;
  eyebrow: string;
  title: string;
  steps: HowItWorksStep[];
};

const icons: Record<HowItWorksStep['key'], LucideIcon> = {
  begin: Sparkles,
  build: Layers,
  tune: SlidersHorizontal,
  publish: Rocket,
};

function ProcessCard({
  step,
  index,
  isRtl,
}: {
  step: HowItWorksStep;
  index: number;
  isRtl: boolean;
}) {
  const Icon = icons[step.key];
  const echoDir = isRtl ? 'ltr' : 'rtl';

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true, margin: '-12%' }}
      whileInView={{ opacity: 1, y: 0 }}
      className="group rounded-2xl border border-black/10 bg-white/42 p-5 text-black shadow-[0_18px_60px_-42px_rgba(0,0,0,0.55)] backdrop-blur-md transition-colors dark:border-white/14 dark:bg-black/34 dark:text-white sm:p-6"
    >
      <div className="flex items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-black/10 bg-white/46 text-black shadow-sm dark:border-white/15 dark:bg-black/30 dark:text-white">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <HomeStaggeredText
                as="span"
                blur={false}
                className="rounded-full border border-black/10 bg-white/42 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-black/58 dark:border-white/14 dark:bg-black/24 dark:text-white/60"
                delay={12}
                text={step.roman}
              />
              <HomeStaggeredText
                as="h3"
                className="m-0 text-xl font-medium leading-tight tracking-normal text-black dark:text-white sm:text-2xl"
                delay={18}
                text={step.name}
              />
              <span
                dir={echoDir}
                className="rounded-full border border-black/10 bg-white/36 px-2.5 py-1 text-sm leading-none text-black/62 dark:border-white/14 dark:bg-black/20 dark:text-white/62"
              >
                <HomeStaggeredText as="span" blur={false} delay={10} text={step.echoName} />
              </span>
            </div>
            <HomeStaggeredText
              as="p"
              className="mt-5 text-sm leading-7 text-black/72 dark:text-white/72 sm:text-base"
              delay={14}
              text={step.body}
            />
          </div>
        </div>
        <HomeStaggeredText
          as="span"
          blur={false}
          className="shrink-0 rounded-full border border-black/10 bg-white/44 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-black/58 dark:border-white/14 dark:bg-black/28 dark:text-white/58"
          delay={12}
          text={step.time}
        />
      </div>
    </motion.article>
  );
}

export default function HowItWorks6({ locale, eyebrow, title, steps }: Props) {
  const isRtl = locale === 'ar';

  return (
    <section
      id="process"
      dir={isRtl ? 'rtl' : 'ltr'}
      className="relative w-full overflow-hidden bg-transparent px-[var(--gutter-tight)] py-16 text-black dark:text-white sm:py-20 lg:px-[var(--gutter)] lg:py-24"
    >
      <div className="relative mx-auto grid w-full max-w-[1400px] gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <motion.div
            className="flex items-center gap-4 font-mono text-xs uppercase tracking-[0.18em] text-black/58 dark:text-white/58"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1 }}
          >
            <span className="h-px w-9 bg-current" />
            <HomeStaggeredText as="p" blur={false} delay={14} text={eyebrow} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            style={{
              fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
              lineHeight: isRtl ? 1.18 : 0.98,
            }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <HomeStaggeredText
              as="h2"
              className="mt-8 max-w-[900px] text-balance text-[clamp(42px,7.2vw,104px)] font-light leading-[0.98] tracking-normal text-black dark:text-white"
              delay={24}
              text={title}
            />
          </motion.div>
        </div>

        <ol className="m-0 grid list-none gap-4 p-0 sm:gap-5">
          {steps.map((step, index) => (
            <li key={step.key}>
              <ProcessCard index={index} isRtl={isRtl} step={step} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
