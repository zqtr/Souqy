"use client";

import { motion } from "motion/react";
import { Globe, TrendingUp, BarChart3, Zap } from "lucide-react";
import { useEffect, useRef } from "react";
import { HomeStaggeredText } from "@/components/sections/home/HomeStaggeredText";

export function Features3() {
  const marquee1Ref = useRef<HTMLDivElement>(null);
  const marquee2Ref = useRef<HTMLDivElement>(null);

  const features = [
    {
      icon: Zap,
      description: "AI writes your storefront, sections, offers, and product story",
    },
    {
      icon: Globe,
      description: "Deploy a fast website with domain, language, and SEO ready",
    },
    {
      icon: BarChart3,
      description: "Track orders, visitors, and growth from one operating system",
    },
    {
      icon: TrendingUp,
      description: "Connect payments, analytics, WhatsApp, shipping, and apps",
    },
  ];

  const images = [
    {
      name: "AI storefront",
      url: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=2070&auto=format&fit=crop",
    },
    {
      name: "Online checkout",
      url: "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?q=80&w=2070&auto=format&fit=crop",
    },
    {
      name: "Commerce dashboard",
      url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2015&auto=format&fit=crop",
    },
    {
      name: "Brand launch",
      url: "https://images.unsplash.com/photo-1557838923-2985c318be48?q=80&w=2070&auto=format&fit=crop",
    },
    {
      name: "Connected apps",
      url: "https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=2070&auto=format&fit=crop",
    },
    {
      name: "Mobile storefront",
      url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070&auto=format&fit=crop",
    },
  ];

  useEffect(() => {
    const marquee1 = marquee1Ref.current;
    const marquee2 = marquee2Ref.current;

    if (!marquee1 || !marquee2) return;

    let animation1: number;
    let progress1 = 0;
    let progress2 = 50;

    const animate = () => {
      progress1 += 0.03;
      if (progress1 >= 50) {
        progress1 = 0;
      }
      marquee1.style.transform = `translateY(-${progress1}%)`;

      progress2 -= 0.03;
      if (progress2 <= 0) {
        progress2 = 50;
      }
      marquee2.style.transform = `translateY(-${progress2}%)`;

      animation1 = requestAnimationFrame(animate);
    };

    animation1 = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animation1);
    };
  }, []);

  return (
    <section className="w-full bg-transparent px-[var(--gutter-tight)] py-14 sm:py-16 md:py-20 lg:px-[var(--gutter)]">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-2 flex flex-col">
            <div className="mb-8 md:mb-12">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
              >
                <HomeStaggeredText
                  as="p"
                  blur={false}
                  className="mb-4 text-sm text-black/65 dark:text-white/65 sm:text-base"
                  delay={16}
                  text="AI commerce OS"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <HomeStaggeredText
                  as="h2"
                  className="mb-6 text-3xl font-normal text-black dark:text-white sm:text-4xl md:text-5xl lg:text-6xl"
                  delay={22}
                  text="Generate, connect, deploy"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <HomeStaggeredText
                  as="p"
                  className="max-w-2xl text-base text-black/65 dark:text-white/65 sm:text-lg"
                  delay={18}
                  text="Souqna turns your idea into a working ecommerce website, then helps you connect the tools that make the business run."
                />
              </motion.div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-8">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                    className="flex items-start gap-3 rounded-2xl border border-black/10 bg-white/10 p-4 backdrop-blur-md dark:border-white/15 sm:gap-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 shadow-lg backdrop-blur-md sm:h-12 sm:w-12">
                      <Icon className="h-5 w-5 text-black dark:text-white sm:h-6 sm:w-6" />
                    </div>

                    <HomeStaggeredText
                      as="p"
                      className="max-w-[24ch] text-sm leading-relaxed tracking-tight text-black/68 dark:text-white/68 sm:text-base"
                      delay={14}
                      text={feature.description}
                    />
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="relative h-[260px] lg:col-span-1 lg:h-[640px]">
            <div className="relative grid h-full grid-cols-2 gap-4 overflow-hidden rounded-2xl">
              <div className="absolute inset-0 pointer-events-none z-10">
                <div className="absolute left-0 right-0 top-0 h-24 bg-linear-to-b from-black/45 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-linear-to-t from-black/45 to-transparent" />
              </div>

              <div className="relative overflow-hidden">
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  ref={marquee1Ref}
                  className="flex flex-col gap-4"
                >
                  {[...images, ...images].map((image, index) => (
                    <div
                      key={`marquee1-${index}`}
                      className="w-full aspect-square rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center overflow-hidden"
                    >
                      <img
                        src={image.url}
                        alt={image.name}
                        className="w-full h-full object-cover grayscale opacity-80 hover:opacity-100 transition-opacity duration-300"
                      />
                    </div>
                  ))}
                </motion.div>
              </div>

              <div className="relative overflow-hidden">
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  ref={marquee2Ref}
                  className="flex flex-col gap-4"
                >
                  {[...images, ...images].map((image, index) => (
                    <div
                      key={`marquee2-${index}`}
                      className="w-full aspect-square rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center overflow-hidden"
                    >
                      <img
                        src={image.url}
                        alt={image.name}
                        className="w-full h-full object-cover grayscale opacity-80 hover:opacity-100 transition-opacity duration-300"
                      />
                    </div>
                  ))}
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
