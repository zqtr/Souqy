"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { motion } from "motion/react";
import { useState, useTransition } from "react";
import type { CSSProperties, ReactNode } from "react";
import { startCheckout } from "@/app/actions/billing";
import { MetalFrame } from "@/components/primitives/MetalFrame";
import type { Locale } from "@/i18n/locales";

type PaidPlan = "starter" | "pro" | "atelier";

type PricingPlan = {
  billingPlan?: PaidPlan;
  cta: string;
  description: string;
  features: string[];
  href: string;
  label: string;
  name: string;
  price: string;
};

const planCopy = {
  en: {
    eyebrow: "Plans",
    title: "Start free. Upgrade when growth tools matter.",
    muted: "Souqna plans now match real storefront growth: product caps, AI credits, platform fees, integrations, and support scale clearly by tier.",
    plans: [
      {
        name: "Free",
        price: "0 QAR",
        label: "start",
        description: "Launch one branded storefront with clear caps.",
        cta: "Start free",
        href: "/begin",
        features: ["1 storefront", "10 products", "1 template", "25 orders/month", "5% transaction fee", "Souqna branding locked", "Upgrade to unlock growth tools"],
      },
      {
        name: "Pro",
        price: "49 QAR",
        label: "/ mo",
        description: "The core conversion plan for growing merchants.",
        cta: "Choose Pro",
        billingPlan: "starter",
        href: "/account/settings/plan?plan=pro",
        features: ["2 storefronts", "Unlimited products", "Custom domain", "Remove branding", "Basic analytics", "WhatsApp, discounts, and SEO", "100 AI credits/month", "3% transaction fee"],
      },
      {
        name: "Pro+",
        price: "145 QAR",
        label: "/ mo",
        description: "Most chosen: AI, marketing, teams, and automation.",
        cta: "Choose Pro+",
        billingPlan: "pro",
        href: "/account/settings/plan?plan=pro_plus",
        features: ["8 storefronts", "Souqy AI operator", "AI branding assets", "EN + AR AI generation", "Marketing apps", "Meta/TikTok integrations", "Team and automation flows", "Advanced analytics", "1% transaction fee"],
      },
      {
        name: "Max+",
        price: "235 QAR",
        label: "/ mo",
        description: "For agencies, operators, and multi-brand sellers.",
        cta: "Choose Max+",
        billingPlan: "atelier",
        href: "/account/settings/plan?plan=max",
        features: ["Unlimited storefronts", "Team workspace", "Client permissions", "White-label tools", "API access", "AI bulk operations", "Advanced SEO AI", "Dedicated support", "0% transaction fee"],
      },
    ],
  },
  ar: {
    eyebrow: "الباقات",
    title: "ابدأ مجاناً. رقّ الباقة عندما يحتاج المتجر مساحة أكبر.",
    muted: "كل الباقات تشمل واجهات ثنائية اللغة، صفحات مستضافة، محرر الواجهة، وسير عمل مناسب لتجارة الخليج.",
    plans: [
      {
        name: "مجاني",
        price: "مجاني",
        label: "للبداية",
        description: "أنشئ أول واجهة متجر وابدأ بالأساسيات.",
        cta: "ابدأ مجاناً",
        href: "/ar/begin",
        features: ["واجهة متجر واحدة", "3 قوالب بداية", "محرر واجهة كامل", "واجهة عربي + إنجليزي", "نطاق سوقنا الفرعي"],
      },
      {
        name: "Pro",
        price: "49 ر.ق",
        label: "/ شهر",
        description: "أطلق متاجر أكثر مع نطاق خاص ودعم مباشر.",
        cta: "اختر Pro",
        billingPlan: "starter",
        href: "/account/settings/plan?plan=pro",
        features: ["واجهتا متجر", "5 قوالب تجارة", "نطاق خاص", "دعم بالبريد والمحادثة"],
      },
      {
        name: "Pro+",
        price: "145 ر.ق",
        label: "/ شهر",
        description: "أضف سوقي، أصول الذكاء، نصوص المنتجات، وتطبيقات النمو.",
        cta: "اختر Pro +",
        billingPlan: "pro",
        href: "/account/settings/plan?plan=pro_plus",
        features: ["8 واجهات متاجر", "أصول علامة بالذكاء", "مشغل سوقي الذكي", "نصوص منتجات عربي + إنجليزي", "تطبيقات التسويق والتحليلات"],
      },
      {
        name: "Max+",
        price: "235 ر.ق",
        label: "/ شهر",
        description: "وسّع التشغيل مع ذكاء متقدم، تكاملات، ومقاعد فريق.",
        cta: "اختر Max +",
        billingPlan: "atelier",
        href: "/account/settings/plan?plan=max",
        features: ["واجهات غير محدودة", "كل البلوكات المميزة", "ذكاء متقدم للتسعير والـ SEO", "دفعات شهرية", "دعم الفريق"],
      },
    ],
  },
} satisfies Record<
  Locale,
  {
    eyebrow: string;
    muted: string;
    plans: PricingPlan[];
    title: string;
  }
>;

const PLAN_TOKEN_PATTERN = /(Pro\s*\+|Max\s*\+|Pro|Max)/g;
const LTR_ISOLATE = "\u2066";
const POP_DIRECTIONAL_ISOLATE = "\u2069";

function renderPlanText(text: string, isRtl: boolean): string {
  if (!isRtl) return text;

  return text.replace(PLAN_TOKEN_PATTERN, (match) => {
    const normalized = match.replace(/\s*\+$/, "+");
    return `${LTR_ISOLATE}${normalized}${POP_DIRECTIONAL_ISOLATE}`;
  });
}

export function Pricing5({ locale }: { locale: Locale }) {
  const copy = planCopy[locale];
  const isRtl = locale === "ar";
  const [pendingPlan, setPendingPlan] = useState<PaidPlan | null>(null);
  const [errorPlan, setErrorPlan] = useState<PaidPlan | null>(null);
  const [, startTransition] = useTransition();
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.12,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 18 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
  };

  const beginCheckout = (billingPlan: PaidPlan) => {
    setErrorPlan(null);
    setPendingPlan(billingPlan);
    startTransition(async () => {
      const res = await startCheckout({ plan: billingPlan, cycle: "monthly" });
      if (res.status === "redirect" || res.status === "sign_in") {
        window.location.href = res.url;
        return;
      }
      setPendingPlan(null);
      setErrorPlan(billingPlan);
    });
  };

  return (
    <section
      id="plans"
      dir={isRtl ? "rtl" : "ltr"}
      className="scroll-mt-28 w-full border-y border-[color:var(--sq-rule)] bg-[color:var(--sq-bg)] px-[var(--sq-page-pad)] py-[var(--sq-section-y)] text-[color:var(--sq-ink)]"
    >
      <motion.div
        className="mx-auto flex w-full max-w-[1400px] flex-col"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
      >
        <div className="mb-12 grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
          <motion.p
            variants={itemVariants}
            className="sq-kicker m-0 text-[color:var(--sq-gold-deep)]"
          >
            <span />
            {copy.eyebrow}
          </motion.p>
          <div>
            <motion.h2
              variants={itemVariants}
              className="m-0 max-w-5xl text-balance font-[var(--font-english)] text-[clamp(36px,5vw,72px)] font-normal leading-none tracking-normal text-[color:var(--sq-ink)]"
            >
              {copy.title}
            </motion.h2>
            <motion.p
              variants={itemVariants}
              className="mt-5 max-w-3xl text-[15px] leading-7 text-[color:var(--sq-muted)] sm:text-base"
            >
              {copy.muted}
            </motion.p>
          </div>
        </div>

        <motion.div
          variants={containerVariants}
          className="grid w-full grid-cols-1 gap-3 lg:grid-cols-4 lg:gap-0"
        >
          {copy.plans.map((plan, index) => {
            const featured = index === 2;
            return (
              <motion.article
                key={plan.name}
                variants={itemVariants}
                className={[
                  "relative flex min-h-[440px] flex-col border p-6 transition duration-300 sm:p-7",
                  "border-[color:color-mix(in_srgb,var(--sq-ink)_18%,transparent)]",
                  "bg-[color:color-mix(in_srgb,var(--sq-bg)_88%,var(--sq-ink))]",
                  "hover:-translate-y-1 hover:border-[color:color-mix(in_srgb,var(--sq-ink)_38%,transparent)]",
                  "lg:border-r-0 lg:first:rounded-s-lg lg:last:rounded-e-lg lg:last:border-r",
                  "max-lg:rounded-lg",
                  featured
                    ? "z-10 bg-[color:var(--sq-charcoal)] text-[color:var(--sq-bg)] shadow-[0_24px_80px_rgba(0,0,0,0.2)]"
                    : "",
                ].join(" ")}
              >
                {featured ? (
                  <span className="absolute end-5 top-5 rounded-full border border-[color:color-mix(in_srgb,var(--sq-bg)_32%,transparent)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--sq-bg)]">
                    {isRtl ? "الأكثر اختياراً" : "Most chosen"}
                  </span>
                ) : null}

                <div className="mb-8 pe-20">
                  <h3
                    className={[
                      "mb-3 text-2xl font-semibold tracking-normal",
                      featured ? "text-[color:var(--sq-bg)]" : "text-[color:var(--sq-ink)]",
                    ].join(" ")}
                  >
                    {renderPlanText(plan.name, isRtl)}
                  </h3>
                  <p
                    className={[
                      "m-0 text-sm leading-6",
                      featured
                        ? "text-[color:color-mix(in_srgb,var(--sq-bg)_70%,transparent)]"
                        : "text-[color:var(--sq-muted)]",
                    ].join(" ")}
                  >
                    {plan.description}
                  </p>
                </div>

                <div className="mb-8 flex items-baseline gap-2">
                  <span
                    className={[
                      "text-[clamp(34px,3.4vw,48px)] font-semibold leading-none",
                      featured ? "text-[color:var(--sq-bg)]" : "text-[color:var(--sq-ink)]",
                    ].join(" ")}
                  >
                    {plan.price}
                  </span>
                  <span
                    className={[
                      "rounded-sm px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                      featured
                        ? "bg-[color:color-mix(in_srgb,var(--sq-bg)_12%,transparent)] text-[color:color-mix(in_srgb,var(--sq-bg)_74%,transparent)]"
                        : "bg-[color:color-mix(in_srgb,var(--sq-ink)_8%,transparent)] text-[color:var(--sq-muted)]",
                    ].join(" ")}
                  >
                    {plan.label}
                  </span>
                </div>

                <ul className="mb-8 flex flex-1 flex-col gap-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check
                        className={[
                          "mt-0.5 h-4 w-4 shrink-0",
                          featured ? "text-[color:var(--sq-bg)]" : "text-[color:var(--sq-ink)]",
                        ].join(" ")}
                      />
                      <span
                        className={[
                          "text-sm leading-6",
                          featured
                            ? "text-[color:color-mix(in_srgb,var(--sq-bg)_78%,transparent)]"
                            : "text-[color:var(--sq-muted)]",
                        ].join(" ")}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {featured ? (
                  <MetalFrame
                    strength={0.62}
                    borderRadius={999}
                    style={{
                      width: "100%",
                      backgroundColor: "var(--sq-bg)",
                      color: "var(--sq-charcoal)",
                    }}
                  >
                    <PlanButton
                      href={plan.href}
                      billingPlan={plan.billingPlan}
                      pendingPlan={pendingPlan}
                      onCheckout={beginCheckout}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-full border-0 bg-transparent px-5 text-sm font-semibold text-[color:var(--sq-charcoal)] transition hover:opacity-86 disabled:cursor-progress disabled:opacity-70"
                      style={{ backgroundColor: "transparent", color: "var(--sq-charcoal)" }}
                    >
                      {pendingPlan === plan.billingPlan ? (isRtl ? "جارٍ التحويل..." : "Redirecting...") : renderPlanText(plan.cta, isRtl)}
                    </PlanButton>
                  </MetalFrame>
                ) : (
                  <PlanButton
                    href={plan.href}
                    billingPlan={plan.billingPlan}
                    pendingPlan={pendingPlan}
                    onCheckout={beginCheckout}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-[color:color-mix(in_srgb,var(--sq-ink)_20%,transparent)] bg-transparent px-5 text-sm font-semibold text-[color:var(--sq-ink)] transition hover:bg-[color:var(--sq-ink)] hover:text-[color:var(--sq-bg)] disabled:cursor-progress disabled:opacity-70"
                  >
                    {pendingPlan === plan.billingPlan ? (isRtl ? "جارٍ التحويل..." : "Redirecting...") : renderPlanText(plan.cta, isRtl)}
                  </PlanButton>
                )}
                {plan.billingPlan && errorPlan === plan.billingPlan ? (
                  <p className="mt-3 text-center text-xs text-[color:var(--color-maroon,#8b3a3a)]">
                    {isRtl ? "تعذر فتح دفع SkipCash. حاول مرة أخرى." : "Could not open SkipCash checkout. Please try again."}
                  </p>
                ) : null}
              </motion.article>
            );
          })}
        </motion.div>
      </motion.div>
    </section>
  );
}

function PlanButton({
  billingPlan,
  children,
  className,
  href,
  onCheckout,
  pendingPlan,
  style,
}: {
  billingPlan?: PaidPlan;
  children: ReactNode;
  className: string;
  href: string;
  onCheckout: (plan: PaidPlan) => void;
  pendingPlan: PaidPlan | null;
  style?: CSSProperties;
}) {
  if (!billingPlan) {
    return (
      <Link href={href} className={className} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={pendingPlan !== null}
      onClick={() => onCheckout(billingPlan)}
      className={className}
      style={style}
    >
      {children}
    </button>
  );
}
