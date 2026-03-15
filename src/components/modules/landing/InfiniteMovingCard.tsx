"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { TESTIMONIALS_CARD, TestimonialsItem } from "@/config/testimonials";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Quote } from "lucide-react";

interface InfiniteMovingCardsProps {
  direction?: "left" | "right";
  speed?: "fast" | "normal" | "slow";
  pauseOnHover?: boolean;
  className?: string;
  showRatings?: boolean;
  variant?: "default" | "bordered" | "glass" | "minimal";
}

export const InfiniteMovingCards: React.FC<InfiniteMovingCardsProps> = ({
  direction = "left",
  speed = "fast",
  pauseOnHover = true,
  className,
  showRatings = true,
  variant = "default",
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [start, setStart] = React.useState(false);

  React.useEffect(() => {
    addAnimation();
  }, []);

  function addAnimation() {
    if (containerRef.current && scrollerRef.current) {
      const scrollerContent = Array.from(scrollerRef.current.children);

      scrollerContent.forEach((item) => {
        const duplicatedItem = item.cloneNode(true);
        if (scrollerRef.current) {
          scrollerRef.current.appendChild(duplicatedItem);
        }
      });

      getDirection();
      getSpeed();
      setStart(true);
    }
  }

  const getDirection = () => {
    if (containerRef.current) {
      if (direction === "left") {
        containerRef.current.style.setProperty(
          "--animation-direction",
          "forwards"
        );
      } else {
        containerRef.current.style.setProperty(
          "--animation-direction",
          "reverse"
        );
      }
    }
  };

  const getSpeed = () => {
    if (containerRef.current) {
      if (speed === "fast") {
        containerRef.current.style.setProperty("--animation-duration", "20s");
      } else if (speed === "normal") {
        containerRef.current.style.setProperty("--animation-duration", "40s");
      } else {
        containerRef.current.style.setProperty("--animation-duration", "80s");
      }
    }
  };

  // Get variant-specific card styles
  const getCardVariant = (variant: string) => {
    const variants = {
      default: "bg-card hover:shadow-lg transition-shadow duration-300",
      bordered: "border-2 border-primary/10 hover:border-primary/30 bg-transparent backdrop-blur-sm",
      glass: "bg-background/50 backdrop-blur-xl border-white/10 hover:border-white/20",
      minimal: "bg-transparent border-0 shadow-none hover:bg-muted/50",
    };
    return variants[variant as keyof typeof variants] || variants.default;
  };

  // Generate random rating for demo (in production, use actual rating from data)
  const renderRating = () => {
    const rating = 4.5 + Math.random() * 0.5;
    return (
      <div className="flex items-center gap-1 mb-3">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={cn(
              "w-4 h-4",
              i < Math.floor(rating)
                ? "fill-yellow-500 text-yellow-500"
                : i < rating
                ? "fill-yellow-500/50 text-yellow-500/50"
                : "text-muted-foreground/30"
            )}
          />
        ))}
        <span className="text-xs text-muted-foreground ml-1">
          {rating.toFixed(1)}
        </span>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "scroller relative z-20 overflow-hidden",
        "[mask-image:linear-gradient(to_right,transparent,white_10%,white_90%,transparent)]",
        "py-8",
        className
      )}
    >
      <div
        ref={scrollerRef}
        className={cn(
          "flex min-w-full shrink-0 gap-6 py-4 w-max flex-nowrap",
          start && "animate-scroll",
          pauseOnHover && "hover:[animation-play-state:paused]"
        )}
      >
        {TESTIMONIALS_CARD.map((item, idx) => {
          // Generate initials for avatar fallback
          const initials = item.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

          return (
            <Card
              key={`${item.name}-${idx}`}
              className={cn(
                "w-[380px] max-w-full p-6 relative rounded-2xl flex-shrink-0 md:w-[450px]",
                "border border-border/50",
                "transition-all duration-300 ease-out",
                "hover:scale-[1.02] hover:-translate-y-1",
                getCardVariant(variant)
              )}
            >
              {/* Quote Icon Decoration */}
              <Quote className="absolute top-6 right-6 w-8 h-8 text-primary/10" />

              <CardContent className="p-0">
                {/* Rating Stars */}
                {showRatings && renderRating()}

                {/* Quote Text */}
                <blockquote className="relative z-20 text-sm md:text-base leading-relaxed text-foreground/90 italic">
                  "{item.quote}"
                </blockquote>

                {/* Author Section */}
                <div className="relative z-20 mt-6 flex flex-row items-center gap-4">
                  {/* Avatar */}
                  <Avatar className="h-12 w-12 border-2 border-primary/10 ring-2 ring-background">
                    <AvatarImage 
                      src={`https://i.pravatar.cc/150?u=${item.name}`} 
                      alt={item.name}
                    />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  {/* Author Info */}
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">
                      {item.name}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      {item.title}
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                      <span className="text-primary/70">Verified</span>
                    </span>
                  </div>
                </div>

                {/* Decorative gradient line */}
                <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
              </CardContent>

              {/* Hover glow effect */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 rounded-2xl" />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Gradient fade indicators at edges */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
    </div>
  );
};

// Additional variant: With company logos
export const InfiniteMovingCardsWithLogos: React.FC<InfiniteMovingCardsProps> = (props) => {
  return (
    <div className="relative">
      <InfiniteMovingCards {...props} variant="glass" />
      
      {/* Company logos section */}
      <div className="flex justify-center gap-8 mt-12 opacity-50">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-24 bg-muted rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
};

// Compact version for sidebars
export const InfiniteMovingCardsCompact: React.FC<InfiniteMovingCardsProps> = (props) => {
  return (
    <InfiniteMovingCards
      {...props}
      speed="normal"
      className="max-w-md mx-auto"
    />
  );
};


