"use client";

import React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Sparkles, Zap, Crown } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { PRICING } from "@/config/pricing";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const HoverPriceCard: React.FC = () => {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);

  // Get plan icon based on index or title
  const getPlanIcon = (index: number, title: string) => {
    if (title.toLowerCase().includes('pro')) return <Zap className="h-5 w-5 text-yellow-500" />;
    if (title.toLowerCase().includes('enterprise')) return <Crown className="h-5 w-5 text-purple-500" />;
    return <Sparkles className="h-5 w-5 text-blue-500" />;
  };

  // Get gradient colors based on plan
  const getGradientColors = (index: number) => {
    const gradients = [
      'from-blue-500/10 to-cyan-500/10', // Starter
      'from-purple-500/10 to-pink-500/10', // Pro
      'from-amber-500/10 to-orange-500/10', // Enterprise
    ];
    return gradients[index % gradients.length];
  };

  // Get border gradient on hover
  const getBorderGradient = (index: number) => {
    const gradients = [
      'hover:border-blue-500/50',
      'hover:border-purple-500/50',
      'hover:border-amber-500/50',
    ];
    return gradients[index % gradients.length];
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-4 place-items-stretch">
      {PRICING.map((price, idx) => (
        <div
          key={idx}
          className="relative group block h-full cursor-pointer perspective-1000"
          onMouseEnter={() => setHoveredIndex(idx)}
          onMouseLeave={() => setHoveredIndex(null)}
          onClick={() => setSelectedIndex(idx)}
        >
          {/* Animated background glow */}
          <AnimatePresence>
            {hoveredIndex === idx && (
              <motion.div
                className="absolute inset-0 -inset-x-4 -inset-y-4 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent blur-xl -z-10 rounded-3xl"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
              />
            )}
          </AnimatePresence>

          {/* Popular Badge */}
          {idx === 1 && (
            <motion.div
              className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-50"
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-1 text-xs font-semibold shadow-lg">
                Most Popular
              </Badge>
            </motion.div>
          )}

          {/* Hover background card */}
          <AnimatePresence>
            {hoveredIndex === idx && (
              <motion.span
                className="absolute inset-0 h-full w-full bg-gradient-to-br from-background to-muted/50 -z-[1] block rounded-3xl shadow-2xl"
                layoutId={`hoverBackground-${idx}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1.02,
                  transition: { duration: 0.2 }
                }}
                exit={{
                  opacity: 0,
                  scale: 0.95,
                  transition: { duration: 0.15 }
                }}
              />
            )}
          </AnimatePresence>

          {/* Main Card */}
          <motion.div
            animate={{
              scale: hoveredIndex === idx ? 1.02 : selectedIndex === idx ? 1.02 : 1,
              y: hoveredIndex === idx ? -4 : 0,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="h-full"
          >
            <Card
              className={cn(
                "relative w-[320px] h-full flex flex-col justify-between z-30 transition-all duration-300 overflow-hidden backdrop-blur-sm bg-background/90 border-2",
                `hover:shadow-2xl ${getBorderGradient(idx)}`,
                {
                  "border-primary shadow-2xl scale-[1.02]": selectedIndex === idx,
                  "border-border": selectedIndex !== idx,
                }
              )}
            >
              {/* Gradient background overlay */}
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                getGradientColors(idx)
              )} />

              {/* Card Header with Icon */}
              <CardHeader className="relative">
                <motion.div 
                  className="flex items-center gap-3 mb-2"
                  animate={{ x: hoveredIndex === idx ? 5 : 0 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <div className={cn(
                    "p-2 rounded-lg bg-gradient-to-br",
                    idx === 0 && "from-blue-500/20 to-cyan-500/20",
                    idx === 1 && "from-purple-500/20 to-pink-500/20",
                    idx === 2 && "from-amber-500/20 to-orange-500/20",
                  )}>
                    {getPlanIcon(idx, price.title)}
                  </div>
                  <CardTitle className="text-xl">{price.title}</CardTitle>
                </motion.div>
                <CardDescription className="text-sm">{price.description}</CardDescription>
              </CardHeader>

              {/* Price Section - FIXED: Added min-height to ensure consistency */}
              <CardContent className="relative min-h-[100px]">
                <motion.div 
                  className="flex items-end gap-1"
                  animate={{ scale: hoveredIndex === idx ? 1.05 : 1 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <span className="text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                    {price.price}
                  </span>
                  {/* Always show /month placeholder for Starter to maintain height */}
                  <span className="text-muted-foreground mb-1">
                    {price.title !== "Starter" ? "/month" : "\u00A0"}
                  </span>
                </motion.div>

                {/* Savings badge for annual - FIXED: Added empty div for Starter to maintain height */}
                <div className="mt-2 min-h-[24px]">
                  {idx > 0 ? (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <Badge variant="secondary" className="text-xs">
                        Save 20% with annual
                      </Badge>
                    </motion.div>
                  ) : (
                    /* Empty placeholder to maintain height */
                    <div className="invisible">placeholder</div>
                  )}
                </div>
              </CardContent>

              {/* Features List - FIXED: Made features container consistent height */}
              <CardFooter className="relative flex flex-col items-start gap-6 flex-1">
                <motion.div 
                  className="flex flex-col gap-3 w-full"
                  animate={{ y: hoveredIndex === idx ? -2 : 0 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  {price.features.map((feature, featureIdx) => (
                    <motion.div
                      key={feature}
                      className="flex gap-3 items-center group/feature"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: featureIdx * 0.05 }}
                      whileHover={{ x: 5 }}
                    >
                      <div className="relative">
                        <CheckCircle2 className="text-emerald-500 h-5 w-5 shrink-0" />
                        <motion.div
                          className="absolute inset-0 bg-emerald-500/20 rounded-full blur-md"
                          initial={{ scale: 0 }}
                          whileHover={{ scale: 1.5 }}
                          transition={{ type: "spring", stiffness: 400 }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground group-hover/feature:text-foreground transition-colors">
                        {feature}
                      </span>
                    </motion.div>
                  ))}
                </motion.div>

                {/* CTA Button */}
                <motion.div 
                  className="w-full mt-4"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    href={`/agency?plan=${price.priceId}`}
                    className={cn(
                      "w-full relative overflow-hidden group/btn",
                      buttonVariants({
                        variant: selectedIndex === idx ? "default" : "outline",
                        size: "lg",
                      }),
                      "font-semibold"
                    )}
                  >
                    <span className="relative z-10">
                      {selectedIndex === idx ? "Selected Plan" : "Get Started"}
                    </span>
                    
                    {/* Button hover effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10"
                      initial={{ x: "100%" }}
                      whileHover={{ x: 0 }}
                      transition={{ type: "spring", stiffness: 100 }}
                    />
                  </Link>
                </motion.div>

                {/* Money-back guarantee - FIXED: Added empty div for Starter to maintain height */}
                <div className="min-h-[20px] w-full">
                  {idx > 0 ? (
                    <motion.p 
                      className="text-xs text-center w-full text-muted-foreground"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.7 }}
                      transition={{ delay: 0.3 }}
                    >
                      30-day money-back guarantee
                    </motion.p>
                  ) : (
                    /* Empty placeholder to maintain height */
                    <div className="invisible">placeholder</div>
                  )}
                </div>
              </CardFooter>

              {/* Corner decoration */}
              <motion.div
                className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-full"
                animate={{
                  scale: hoveredIndex === idx ? 1.2 : 1,
                  rotate: hoveredIndex === idx ? 5 : 0,
                }}
                transition={{ type: "spring", stiffness: 400 }}
              />
            </Card>
          </motion.div>
        </div>
      ))}
    </div>
  );
};

export default HoverPriceCard;