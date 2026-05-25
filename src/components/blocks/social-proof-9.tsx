"use client";

import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useTransform,
} from "motion/react";
import { useRef, useState } from "react";
import { HomeStaggeredText } from "@/components/sections/home/HomeStaggeredText";

const platformLogos = [
  { name: "Vercel", logo: "https://cdn.simpleicons.org/vercel/000000" },
  { name: "Next.js", logo: "https://cdn.simpleicons.org/nextdotjs/000000" },
  { name: "Clerk", logo: "https://cdn.simpleicons.org/clerk/6c47ff" },
  { name: "Neon", logo: "https://cdn.simpleicons.org/neon/00e699" },
  { name: "Vercel Blob", logo: "https://cdn.simpleicons.org/vercel/000000" },
  { name: "PostHog", logo: "https://cdn.simpleicons.org/posthog/000000" },
  { name: "Sentry", logo: "https://cdn.simpleicons.org/sentry/362d59" },
  { name: "AI Gateway", logo: "https://cdn.simpleicons.org/vercel/000000" },
];

const integrationLogos = [
  { name: "Meta", logo: "https://cdn.simpleicons.org/meta/0467df" },
  { name: "WhatsApp Business", logo: "/apps/whatsapp-business/mark.svg" },
  { name: "Instagram Shop", logo: "/apps/instagram-shop/mark.svg" },
  { name: "Mailchimp", logo: "/apps/mailchimp/mark.svg" },
  { name: "Klaviyo", logo: "/apps/klaviyo/mark.svg" },
  { name: "Tap Payments", logo: "/apps/tap-payments/mark.svg" },
  { name: "Google Analytics", logo: "/apps/google-analytics/mark.svg" },
  { name: "HubSpot", logo: "/apps/hubspot/mark.svg" },
  { name: "Zapier", logo: "/apps/zapier/mark.svg" },
  { name: "TikTok Pixel", logo: "/apps/tiktok-pixel/mark.svg" },
  { name: "Postmark", logo: "https://cdn.simpleicons.org/postmark/ffde00" },
  { name: "Resend", logo: "https://cdn.simpleicons.org/resend/000000" },
];

type LogoItem = (typeof platformLogos)[number];

function LogoPill({ logo }: { logo: LogoItem }) {
  return (
    <div className="flex min-w-max items-center gap-3 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-black dark:text-white opacity-70 shadow-sm backdrop-blur-md transition-opacity duration-300 hover:opacity-100">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white p-1.5 dark:bg-white/10">
        <img
          src={logo.logo}
          alt=""
          className="h-full w-full object-contain [filter:brightness(0)_saturate(100%)] dark:[filter:brightness(0)_saturate(100%)_invert(1)]"
          loading="lazy"
          aria-hidden="true"
        />
      </span>
      <HomeStaggeredText
        as="span"
        blur={false}
        className="text-base font-medium tracking-tight md:text-lg"
        delay={12}
        text={logo.name}
      />
    </div>
  );
}

const Marquee = ({
  items,
  direction = "left",
  speed = 20,
}: {
  items: LogoItem[];
  direction?: "left" | "right";
  speed?: number;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const xPercent = useMotionValue(0);
  const x = useTransform(xPercent, (v) => `${v}%`);
  const containerRef = useRef<HTMLDivElement>(null);

  useAnimationFrame((time, delta) => {
    if (isHovered) return;

    const moveBy = (speed * delta) / 1000;

    if (direction === "left") {
      const newX = xPercent.get() - moveBy;
      if (newX <= -50) {
        xPercent.set(0);
      } else {
        xPercent.set(newX);
      }
    } else {
      const newX = xPercent.get() + moveBy;
      if (newX >= 0) {
        xPercent.set(-50);
      } else {
        xPercent.set(newX);
      }
    }
  });

  return (
    <div
      className="flex overflow-hidden w-full group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      ref={containerRef}
    >
      <motion.div
        className="flex shrink-0 gap-8 sm:gap-16 pr-8 sm:pr-16 min-w-full items-center justify-around"
        style={{ x }}
      >
        {[...items, ...items].map((logo, idx) => (
          <LogoPill key={idx} logo={logo} />
        ))}
      </motion.div>
      <motion.div
        className="flex shrink-0 gap-8 sm:gap-16 pr-8 sm:pr-16 min-w-full items-center justify-around"
        style={{ x }}
        aria-hidden="true"
      >
        {[...items, ...items].map((logo, idx) => (
          <LogoPill key={`dup-${idx}`} logo={logo} />
        ))}
      </motion.div>
    </div>
  );
};

export function SocialProof9() {
  return (
    <section className="overflow-hidden bg-transparent px-[var(--gutter-tight)] py-10 text-black dark:text-white sm:py-12 lg:px-[var(--gutter)]">
      <div className="mx-auto mb-8 max-w-[1400px] text-center sm:mb-10">
        <HomeStaggeredText
          as="h3"
          blur={false}
          className="text-sm font-medium uppercase tracking-widest text-black dark:text-white"
          delay={14}
          text="Built on the stack and apps your AI storefront needs"
        />
      </div>

      <div className="relative mx-auto flex max-w-[1400px] flex-col gap-10">
        <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
          <Marquee items={platformLogos} direction="left" speed={2} />

          <div className="h-8" />

          <Marquee items={integrationLogos} direction="right" speed={2} />

          <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-white/70 to-transparent dark:from-black/55"></div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-linear-to-l from-white/70 to-transparent dark:from-black/55"></div>
        </div>
      </div>
    </section>
  );
}
