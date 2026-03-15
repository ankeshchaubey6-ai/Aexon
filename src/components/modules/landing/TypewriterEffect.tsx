"use client";

import React from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";

interface TypewriterEffectProps {
  className?: string;
  words?: Array<{ text: string; className?: string }>;
  speed?: number;
  delay?: number;
}

export const TypewriterEffect: React.FC<TypewriterEffectProps> = ({
  className,
  words = [
    { text: "Run" },
    { text: "your" },
    { text: "agency" },
    { text: "in" },
    { text: "just" },
    { text: "one" },
    {
      text: "place.",
      className: "bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent font-bold",
    },
  ],
  speed = 0.05,
  delay = 1,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [displayText, setDisplayText] = React.useState("");
  const [currentCharIndex, setCurrentCharIndex] = React.useState(0);
  const [isDeleting, setIsDeleting] = React.useState(false);
  
  const isInView = useInView(containerRef, { once: true, amount: 0.5 });

  // Typing animation effect
  React.useEffect(() => {
    if (!isInView) return;

    const fullText = words.map(word => word.text).join(" ");
    
    if (!isDeleting && currentCharIndex <= fullText.length) {
      const timer = setTimeout(() => {
        setDisplayText(fullText.substring(0, currentCharIndex + 1));
        setCurrentCharIndex(prev => prev + 1);
      }, speed * 1000);
      
      return () => clearTimeout(timer);
    }
    
    if (currentCharIndex > fullText.length) {
      // Start deleting after a pause
      const timer = setTimeout(() => {
        setIsDeleting(true);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
    
    if (isDeleting && currentCharIndex >= 0) {
      const timer = setTimeout(() => {
        setDisplayText(fullText.substring(0, currentCharIndex - 1));
        setCurrentCharIndex(prev => prev - 1);
      }, speed * 500);
      
      return () => clearTimeout(timer);
    }
    
    if (isDeleting && currentCharIndex < 0) {
      // Reset for next cycle
      setIsDeleting(false);
      setCurrentCharIndex(0);
    }
  }, [isInView, currentCharIndex, isDeleting, words, speed]);

  // Helper to get word class for a character position
  const getCharClass = (index: number) => {
    let wordIndex = 0;
    let charIndex = 0;
    let totalChars = 0;
    
    for (let i = 0; i < words.length; i++) {
      const wordLength = words[i].text.length;
      if (index < totalChars + wordLength) {
        wordIndex = i;
        charIndex = index - totalChars;
        break;
      }
      totalChars += wordLength + 1; // +1 for space
    }
    
    return words[wordIndex]?.className || "";
  };

  // Render the typing animation (NO CURSOR)
  const renderTypingEffect = () => {
    return (
      <span className="inline-block">
        {displayText.split("").map((char, index) => (
          <motion.span
            key={`char-${index}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.2,
              delay: index * speed,
              ease: "easeOut",
            }}
            className={cn(
              "inline-block",
              getCharClass(index)
            )}
          >
            {char === " " ? "\u00A0" : char}
          </motion.span>
        ))}
        {/* NO CURSOR HERE - Removed the vertical line */}
      </span>
    );
  };

  // Static version (for when not in view) - NO CURSOR
  const renderStaticWords = () => {
    return (
      <span className="inline-block">
        {words.map((word, wordIdx) => (
          <span key={`word-${wordIdx}`} className="inline-block">
            {word.text.split("").map((char, charIdx) => (
              <span
                key={`char-${wordIdx}-${charIdx}`}
                className={cn("inline-block", word.className)}
              >
                {char}
              </span>
            ))}
            {wordIdx < words.length - 1 && "\u00A0"}
          </span>
        ))}
      </span>
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex items-center justify-center min-h-[60px] py-4",
        className
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative"
      >
        {/* Glow effect using primary color with opacity */}
        <motion.div
          className="absolute inset-0 bg-primary/5 blur-xl -z-10 rounded-full"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.3, 0.2],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Main text container */}
        <div className="relative">
          {/* Typing animation when in view */}
          <motion.div
            className="text-base md:text-lg lg:text-xl font-medium leading-relaxed text-foreground"
            initial={{ width: 0 }}
            animate={isInView ? { width: "auto" } : {}}
            transition={{ duration: 0.5 }}
          >
            {isInView ? renderTypingEffect() : renderStaticWords()}
          </motion.div>

          {/* Gradient underline matching button styles */}
          <motion.div
            className="absolute -bottom-2 left-0 h-[2px] bg-gradient-to-r from-primary via-primary/80 to-primary/40"
            initial={{ width: "0%" }}
            animate={isInView ? { width: "100%" } : {}}
            transition={{ duration: 1, delay: 2 }}
          />
        </div>

        {/* Floating particles in primary color */}
        {isInView && (
          <>
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-primary/20"
                initial={{
                  x: Math.random() * 100 - 50,
                  y: Math.random() * 100 - 50,
                  opacity: 0,
                }}
                animate={{
                  x: [0, Math.random() * 40 - 20, 0],
                  y: [0, Math.random() * 40 - 20, 0],
                  opacity: [0, 0.3, 0],
                  scale: [0, 1, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: i * 1,
                  ease: "easeInOut",
                }}
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
              />
            ))}
          </>
        )}
      </motion.div>
    </div>
  );
};

// Compact version for mobile
export const TypewriterEffectCompact: React.FC<TypewriterEffectProps> = (props) => {
  return <TypewriterEffect {...props} className={cn("text-sm", props.className)} />;
};

// Word-by-word animation version (NO CURSOR)
export const TypewriterEffectWords: React.FC<TypewriterEffectProps> = ({
  className,
  words = [
    { text: "Run" },
    { text: "your" },
    { text: "agency" },
    { text: "in" },
    { text: "just" },
    { text: "one" },
    {
      text: "place.",
      className: "bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent font-bold",
    },
  ],
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [visibleWords, setVisibleWords] = React.useState(0);
  const isInView = useInView(containerRef, { once: true, amount: 0.5 });

  React.useEffect(() => {
    if (!isInView) return;

    const timer = setInterval(() => {
      setVisibleWords(prev => {
        if (prev < words.length) {
          return prev + 1;
        }
        clearInterval(timer);
        return prev;
      });
    }, 300);

    return () => clearInterval(timer);
  }, [isInView, words.length]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex items-center justify-center min-h-[60px] py-4",
        className
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        {/* Subtle glow */}
        <div className="absolute inset-0 bg-primary/5 blur-xl -z-10 rounded-full" />
        
        <div className="text-base md:text-lg lg:text-xl font-medium text-foreground">
          {words.map((word, idx) => (
            <motion.span
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={idx < visibleWords ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.3,
                delay: idx * 0.1,
                ease: "easeOut",
              }}
              className="inline-block"
            >
              <span className={cn(word.className)}>{word.text}</span>
              {idx < words.length - 1 && "\u00A0"}
            </motion.span>
          ))}
          {/* NO CURSOR HERE - Removed the vertical line */}
        </div>

        {/* Progress bar that matches button styling */}
        <motion.div
          className="absolute -bottom-2 left-0 h-[2px] bg-gradient-to-r from-primary via-primary/80 to-primary/40"
          initial={{ width: "0%" }}
          animate={isInView ? { width: `${(visibleWords / words.length) * 100}%` } : {}}
          transition={{ duration: 0.3 }}
        />
      </motion.div>
    </div>
  );
};

// Button-style variant (matches your dashboard buttons)
export const TypewriterEffectButton: React.FC<TypewriterEffectProps> = ({
  className,
  ...props
}) => {
  return (
    <div className={cn(
      "inline-flex items-center justify-center rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary ring-offset-background transition-colors hover:bg-primary/20",
      className
    )}>
      <TypewriterEffectWords {...props} />
    </div>
  );
};

// Dashboard header variant
export const TypewriterEffectHeader: React.FC<TypewriterEffectProps> = ({
  className,
  ...props
}) => {
  return (
    <div className={cn(
      "border-b border-border pb-4 mb-6",
      className
    )}>
      <h2 className="text-2xl font-semibold tracking-tight">
        <TypewriterEffectWords {...props} />
      </h2>
    </div>
  );
};

export default TypewriterEffect;