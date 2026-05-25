/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, @next/next/no-img-element */
// @ts-nocheck
"use client";

import { motion } from "motion/react";
import { HelpCircle, BookOpen, MessageCircle } from "lucide-react";

export default function Contact1() {
  const cards = [
    {
      icon: HelpCircle,
      iconColor: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      pillText: "Documentation",
      pillBg: "bg-white dark:bg-neutral-950",
      pillTextColor: "text-blue-700 dark:text-blue-400",
      linkText: "Learn how to build with our API",
      linkColor: "text-blue-600 dark:text-blue-400",
      href: "#",
    },
    {
      icon: BookOpen,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
      pillText: "Community",
      pillBg: "bg-white dark:bg-neutral-950",
      pillTextColor: "text-emerald-700 dark:text-emerald-400",
      linkText: "Join developers building the future",
      linkColor: "text-emerald-600 dark:text-emerald-400",
      href: "#",
    },
    {
      icon: MessageCircle,
      iconColor: "text-pink-600 dark:text-pink-400",
      bgColor: "bg-pink-50 dark:bg-pink-950/30",
      pillText: "Get in touch",
      pillBg: "bg-white dark:bg-neutral-950",
      pillTextColor: "text-pink-700 dark:text-pink-400",
      linkText: "Have a question? Our team is here to help",
      linkColor: "text-pink-600 dark:text-pink-400",
      href: "#",
    },
  ];

  return (
    <section className="w-full bg-white py-16 dark:bg-neutral-950 sm:py-24">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mb-6 text-4xl tracking-tight font-medium leading-tight text-neutral-900 dark:text-neutral-50 sm:text-5xl lg:mb-16 lg:text-6xl"
        >
          Let's work together
        </motion.h2>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card, index) => (
            <motion.a
              key={index}
              href={card.href}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className={`group flex flex-col justify-between rounded-3xl p-4 transition-shadow duration-300 hover:shadow-lg sm:p-6 ${card.bgColor} ${index === 2 ? "sm:col-span-2 lg:col-span-2" : ""}`}
            >
              {/* Top Section - Pill */}
              <div className="mb-12 sm:mb-16 lg:mb-20">
                <div
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 ${card.pillBg}`}
                >
                  <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                  <span className={`text-sm font-medium ${card.pillTextColor}`}>
                    {card.pillText}
                  </span>
                </div>
              </div>

              {/* Bottom Section - Link */}
              <div>
                <p
                  className={`text-lg font-medium transition-all duration-300 group-hover:scale-[1.02] sm:text-xl ${card.linkColor}`}
                >
                  {card.linkText}
                </p>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
