import { cn } from "../../utils/cn.js";

/**
 * HeroWithVideo — a hero section with an autoplaying muted background video.
 * Falls back to a poster image while the video loads.
 *
 * @param {string}   videoSrc          - Video file URL (.mp4 recommended)
 * @param {string}   [posterSrc]       - Fallback image shown before video plays
 * @param {string[]} [additionalSrcs]  - Additional video sources for browser fallback
 * @param {string|ReactNode} title
 * @param {string}   [subtitle]
 * @param {{ label, href?, variant?, onClick? }[]} [actions=[]]
 * @param {"center"|"left"} [align="center"]
 * @param {number}   [overlayOpacity=0.5]
 * @param {"sm"|"md"|"lg"|"xl"|"screen"} [height="lg"]
 *
 * @example
 * <HeroWithVideo
 *   videoSrc="/videos/city-timelapse.mp4"
 *   posterSrc="/images/city-poster.jpg"
 *   title="Experience the future"
 *   subtitle="Next-generation technology for modern teams."
 *   actions={[{ label: "Get access", href: "/sign-up" }]}
 *   height="screen"
 * />
 */
export function HeroWithVideo({
  videoSrc,
  posterSrc,
  additionalSrcs = [],
  title,
  subtitle,
  actions        = [],
  align          = "center",
  overlayOpacity = 0.5,
  height         = "lg",
  className,
  children,
}) {
  const isCenter = align === "center";

  const heights = {
    sm:     "min-h-[360px]",
    md:     "min-h-[480px]",
    lg:     "min-h-[600px]",
    xl:     "min-h-[720px]",
    screen: "min-h-screen",
  };

  return (
    <section
      className={cn(
        "relative flex items-center overflow-hidden bg-gray-950",
        heights[height] ?? heights.lg,
        className,
      )}
    >
      {/* Background video */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        poster={posterSrc}
        aria-hidden="true"
      >
        {videoSrc && <source src={videoSrc} type="video/mp4" />}
        {additionalSrcs.map((src, i) => (
          <source key={i} src={src} />
        ))}
      </video>

      {/* Dark overlay */}
      <div
        className="absolute inset-0 bg-black"
        style={{ opacity: overlayOpacity }}
        aria-hidden="true"
      />

      {/* Gradient fade at bottom for smooth transition */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/30 to-transparent pointer-events-none"
        aria-hidden="true"
      />

      {/* Content */}
      <div className={cn(
        "relative z-10 w-full container mx-auto px-4 sm:px-6 lg:px-8 py-20",
        isCenter && "text-center",
      )}>
        <h1
          className={cn(
            "font-extrabold tracking-tight text-white",
            "text-4xl sm:text-5xl lg:text-6xl xl:text-7xl",
            isCenter ? "max-w-4xl mx-auto" : "max-w-2xl",
          )}
          style={{ lineHeight: 1.1 }}
        >
          {title}
        </h1>

        {subtitle && (
          <p
            className={cn(
              "mt-6 text-lg sm:text-xl text-white/80 leading-relaxed",
              isCenter ? "max-w-2xl mx-auto" : "max-w-xl",
            )}
          >
            {subtitle}
          </p>
        )}

        {actions.length > 0 && (
          <div className={cn(
            "mt-10 flex flex-wrap gap-4",
            isCenter ? "justify-center" : "justify-start",
          )}>
            {actions.map(({ label, href, variant = "primary", onClick }, i) => {
              const cls = {
                primary:   "inline-flex items-center px-7 py-3.5 bg-white text-gray-900 rounded-xl text-base font-bold hover:bg-gray-100 shadow-xl hover:-translate-y-0.5 transition-all",
                secondary: "inline-flex items-center px-7 py-3.5 border-2 border-white text-white rounded-xl text-base font-semibold hover:bg-white/10 hover:-translate-y-0.5 backdrop-blur-sm transition-all",
                ghost:     "inline-flex items-center gap-2 px-7 py-3.5 text-white/90 text-base font-semibold hover:text-white transition-colors",
              }[variant] ?? "";
              return href
                ? <a key={i} href={href} className={cls}>{label}</a>
                : <button key={i} type="button" onClick={onClick} className={cls}>{label}</button>;
            })}
          </div>
        )}

        {/* Scroll indicator */}
        <div className={cn("mt-16 animate-bounce", isCenter && "flex justify-center")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-6 h-6 opacity-60">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>

        {children}
      </div>
    </section>
  );
}