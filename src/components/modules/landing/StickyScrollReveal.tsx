"use client";

import React, { useRef } from "react";
import { useMotionValueEvent, useScroll } from "framer-motion";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import Image from "next/image";

const content = [
  {
    title: "Website Builder",
    description: (
      <>
        <p>
          The Website Builder for Agency CRM is a powerful tool designed to
          streamline the process of creating and managing websites for agencies.
        </p>
        <p>
          With its intuitive interface and robust features, agencies can easily
          build custom websites tailored to their clients&apos; needs without
          extensive coding knowledge.
        </p>
        <p>
          From drag-and-drop functionality to seamless integration with CRM
          systems, this tool empowers agencies to deliver stunning websites
          efficiently and effectively, ultimately enhancing client satisfaction
          and driving business growth.
        </p>
      </>
    ),
    content: (
      <div className="h-full w-full rounded-md flex items-center justify-center text-white">
        <Image
          src="https://utfs.io/f/30845fe9-f07d-49a4-8072-112bb8152111-euyk0.png"
          fill
          className="h-full w-full object-fit rounded-md border"
          alt="Feature"
        />
      </div>
    ),
  },
  {
    title: "Kanban Board",
    description: (
      <>
        <p>
          The Kanban Board for pipelines in Agency CRM offers a visual and
          efficient way for agencies to manage their projects and workflows.
        </p>
        <p>
          By organizing tasks into customizable pipelines, agencies can easily
          track the progress of projects from start to finish.
        </p>
        <p>
          With features like drag-and-drop functionality and customizable
          columns, this tool enables teams to prioritize tasks, collaborate
          effectively, and stay organized, ultimately improving productivity and
          project delivery.
        </p>
      </>
    ),
    content: (
      <div className="h-full w-full  flex items-center justify-center text-white">
        <Image
          src="https://utfs.io/f/76fb5e37-fa30-46e2-94c7-d664b516a67f-mc721d.png"
          fill
          className="h-full w-full object-fit rounded-md border"
          alt="Feature"
        />
      </div>
    ),
  },
  {
    title: "Team Access",
    description: (
      <>
        <p>
          Team Access for Agency CRM provides secure and seamless access control
          for agency teams, ensuring efficient collaboration and data
          management.
        </p>
        <p>
          With customizable user permissions, agencies can easily tailor access
          levels to match individual roles and responsibilities.
        </p>
        <p>
          This feature enhances teamwork by allowing team members to access the
          necessary information while maintaining data security and
          confidentiality, ultimately optimizing workflow efficiency and
          productivity.
        </p>
      </>
    ),
    content: (
      <div className="h-full w-full rounded-md flex items-center justify-center text-white">
        <Image
          src="https://utfs.io/f/9645dd80-d15c-418f-93ae-c1f329cc5ebb-1tmp4m.png"
          fill
          className="h-full w-full object-fit rounded-md border"
          alt="Feature"
        />
      </div>
    ),
  },
  {
    title: "Leads Dashboard",
    description: (
      <>
        <p>
          The Leads Dashboard for Agency CRM offers a comprehensive overview of
          potential opportunities and client interactions, empowering agencies
          to effectively manage their sales pipeline.
        </p>
        <p>
          With real-time updates and customizable filters, agencies can track
          leads, prioritize follow-ups, and analyze conversion rates with ease.
        </p>
        <p>
          This feature enhances sales performance by providing actionable
          insights, enabling agencies to make informed decisions and drive
          business growth.
        </p>
      </>
    ),
    content: (
      <div className="h-full w-full rounded-md flex items-center justify-center text-white">
        <Image
          src="/assets/preview.png"
          fill
          className="h-full w-full object-fit rounded-md border"
          alt="Feature"
        />
      </div>
    ),
  },
];

export const StickyScroll = ({
  contentClassName,
}: {
  contentClassName?: string | React.ReactNode;
}) => {
  const [activeCard, setActiveCard] = React.useState(0);
  const ref = useRef<any>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const cardLength = content.length;

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const cardsBreakpoints = content.map((_, index) => index / cardLength);
    const closestBreakpointIndex = cardsBreakpoints.reduce(
      (acc, breakpoint, index) => {
        const distance = Math.abs(latest - breakpoint);
        if (distance < Math.abs(latest - cardsBreakpoints[acc])) {
          return index;
        }
        return acc;
      },
      0
    );
    setActiveCard(closestBreakpointIndex);
  });

  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
      <div className="text-center mb-16">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
          Powerful Features
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Everything you need to run your agency efficiently
        </p>
      </div>

      <motion.div
        className="flex flex-col lg:flex-row gap-12 lg:gap-20"
        ref={ref}
      >
        {/* Content Side */}
        <div className="flex-1 space-y-16 lg:space-y-24">
          {content.map((item, index) => {
            const isActive = activeCard === index;
            const isPast = index < activeCard;
            
            return (
              <motion.div
                key={item.title + index}
                className="relative"
                id={`section-${index}`}
              >
                {/* Timeline dot */}
                <div className="absolute left-0 top-2 w-3 h-3 -translate-x-1/2 hidden lg:block">
                  <div className={cn(
                    "absolute inset-0 rounded-full transition-all duration-300",
                    isActive 
                      ? "bg-primary scale-150" 
                      : isPast 
                        ? "bg-primary/50" 
                        : "bg-muted-foreground/30"
                  )} />
                  {isActive && (
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                  )}
                </div>

                {/* Content */}
                <div className="lg:pl-8">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={cn(
                      "text-sm font-mono",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}>
                      {(index + 1).toString().padStart(2, '0')}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  
                  <motion.h3
                    animate={{
                      opacity: isActive ? 1 : 0.6,
                    }}
                    className={cn(
                      "text-2xl font-semibold mb-4 transition-colors",
                      isActive && "text-primary"
                    )}
                  >
                    {item.title}
                  </motion.h3>
                  
                  <motion.div
                    animate={{
                      opacity: isActive ? 1 : 0.5,
                    }}
                    className={cn(
                      "prose prose-sm dark:prose-invert max-w-none",
                      "text-muted-foreground",
                      "space-y-4"
                    )}
                  >
                    {item.description}
                  </motion.div>

                  {/* Subtle active indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="activeBar"
                      className="h-0.5 w-12 bg-primary rounded-full mt-6"
                      transition={{ duration: 0.3 }}
                    />
                  )}
                </div>
              </motion.div>
            );
          })}
          <div className="h-20 lg:h-0" />
        </div>

        {/* Image Side - Clean and minimal */}
        <div className="lg:w-[500px] lg:flex-shrink-0">
          <div className="sticky top-24">
            <motion.div
              key={activeCard}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className={cn(
                "relative aspect-[4/3] rounded-2xl overflow-hidden",
                "bg-gradient-to-br from-muted/50 to-muted/30",
                "border border-border shadow-lg",
                contentClassName
              )}
            >
              {content[activeCard].content}
              
              {/* Simple overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/20 via-transparent to-transparent pointer-events-none" />
            </motion.div>

            {/* Clean navigation dots */}
            <div className="flex justify-center gap-2 mt-6">
              {content.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    document.getElementById(`section-${index}`)?.scrollIntoView({ 
                      behavior: "smooth",
                      block: "center"
                    });
                  }}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-300",
                    index === activeCard
                      ? "w-6 bg-primary"
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  )}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>

            {/* Slide counter */}
            <div className="text-center mt-4 text-sm text-muted-foreground">
              {String(activeCard + 1).padStart(2, '0')} / {String(content.length).padStart(2, '0')}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};