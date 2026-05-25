/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, @next/next/no-img-element */
// @ts-nocheck
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface ShowcaseItem {
  id: number;
  title: string;
  subtitle: string;
  year?: string;
  image: string;
  status?: string;
}

export function Showcase1() {
  const [activeId, setActiveId] = useState(1);

  const items: ShowcaseItem[] = [
    {
      id: 1,
      title: "Quantum Dynamics",
      subtitle: "Real-time Analytics, Cloud Infra,",
      year: "2024",
      image:
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=800&fit=crop",
    },
    {
      id: 2,
      title: "Nexus Platform",
      subtitle: "API Integration, Scalability,",
      year: "2024",
      image:
        "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=800&fit=crop",
    },
    {
      id: 3,
      title: "Atlas Framework",
      subtitle: "Performance Optimization, Security,",
      year: "2023",
      image:
        "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=800&fit=crop",
    },
    {
      id: 4,
      title: "Horizon Analytics",
      subtitle: "",
      status: "Coming soon",
      image:
        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=800&fit=crop",
    },
  ];

  const activeItem = items.find((item) => item.id === activeId);

  return (
    <section className="w-full min-h-screen flex items-start lg:items-center py-12 px-4 sm:px-6 lg:px-8 bg-white dark:bg-neutral-950">
      <div className="max-w-[1400px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_600px] gap-2 lg:gap-16 xl:gap-20">
          {/* Left Column - Items List */}
          <div className="flex flex-col relative">
            {items.map((item, index) => (
              <motion.button
                key={item.id}
                onClick={() => setActiveId(item.id)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="relative w-full text-left py-6 sm:py-8"
              >
                {activeId === item.id && (
                  <motion.div
                    layoutId="active-background"
                    className="absolute inset-0 bg-neutral-900 dark:bg-white rounded-lg"
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                    }}
                  />
                )}
                <div
                  className={`relative px-4 sm:px-6 flex items-center justify-between gap-4 ${
                    activeId === item.id
                      ? ""
                      : "transition-opacity duration-300 hover:opacity-60"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <h2
                      className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-medium tracking-tight mb-2 truncate ${
                        activeId === item.id
                          ? "text-white dark:text-neutral-900"
                          : "text-neutral-900 dark:text-white"
                      }`}
                    >
                      {item.title}
                    </h2>
                    {item.subtitle && (
                      <p
                        className={`text-sm ${
                          activeId === item.id
                            ? "text-neutral-300 dark:text-neutral-600"
                            : "text-neutral-600 dark:text-neutral-400"
                        }`}
                      >
                        {item.subtitle} {item.year}
                      </p>
                    )}
                    {item.status && (
                      <p
                        className={`text-sm ${
                          activeId === item.id
                            ? "text-neutral-300 dark:text-neutral-600"
                            : "text-neutral-600 dark:text-neutral-400"
                        }`}
                      >
                        {item.status}
                      </p>
                    )}
                  </div>
                  {activeId === item.id && (
                    <motion.div
                      layoutId="active-indicator"
                      className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white dark:bg-neutral-900"
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 25,
                      }}
                    />
                  )}
                </div>
              </motion.button>
            ))}
          </div>

          {/* Right Column - Image */}
          <div className="relative w-full h-[300px] sm:h-[400px] lg:h-full overflow-hidden order-first lg:order-0 lg:rounded-none lg:mb-0">
            <AnimatePresence initial={false}>
              {activeItem && (
                <motion.img
                  key={activeItem.id}
                  src={activeItem.image}
                  alt={activeItem.title}
                  initial={{ y: "60%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
