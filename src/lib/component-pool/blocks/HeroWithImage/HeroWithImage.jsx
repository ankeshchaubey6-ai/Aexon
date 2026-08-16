import { cn } from "../../utils/cn.js";

/**
 * HeroWithImage — a hero section with a full-bleed background image,
 * dark overlay, and centered or left-aligned content.
 * Great for travel, real-estate, events, hospitality sites.
 *
 * @param {string}           imageSrc          - Background image URL
 * @param {string}           [imageAlt=""]
 * @param {string|ReactNode} title
 * @param {string}           [subtitle]
 * @param {{ label, href?, variant?, onClick? }[]} [actions=[]]
 * @param {"center"|"left"}  [align="center"]
 * @param {number}           [overlayOpacity=0.55] - 0–1
 * @param {"sm"|"md"|"lg"|"xl"|"screen"} [height="lg"]
 * @param {string}           [overlayColor="black"] - CSS color for gradient overlay
 *
 * @example
 * <HeroWithImage
 *   imageSrc="/mountain.jpg"
 *   title="Discover the world"
 *   subtitle="Book extraordinary experiences in seconds."
 *   actions={[{ label: "Explore destinations", href: "/explore" }]}
 *   height="screen"
 *   overlayOpacity={0.5}
 * />
 */
export function HeroWithImage({
  imageSrc,
  imageAlt       = "",
  title,
  subtitle,
  actions        = [],
  align          = "center",
  overlayOpacity = 0.55,
  overlayColor   = "#000",
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
        "relative flex items-center overflow-hidden",
        heights[height] ?? heights.lg,
        className,
      )}
    >
      {/* Background image */}
      {imageSrc && (
        <img
          src={imageSrc}
          alt={imageAlt}
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden={!imageAlt}
        />
      )}

      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, ${overlayColor}${Math.round(overlayOpacity * 0.6 * 255).toString(16).padStart(2,"0")} 0%, ${overlayColor}${Math.round(overlayOpacity * 255).toString(16).padStart(2,"0")} 100%)`,
        }}
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
          style={{ lineHeight: 1.1, textShadow: "0 2px 20px rgba(0,0,0,0.3)" }}
        >
          {title}
        </h1>

        {subtitle && (
          <p
            className={cn(
              "mt-6 text-lg sm:text-xl text-white/85 leading-relaxed",
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
                secondary: "inline-flex items-center px-7 py-3.5 bg-white/15 backdrop-blur-sm text-white border border-white/30 rounded-xl text-base font-semibold hover:bg-white/25 hover:-translate-y-0.5 transition-all",
                ghost:     "inline-flex items-center px-7 py-3.5 text-white/90 text-base font-semibold hover:text-white transition-colors",
              }[variant] ?? "";
              return href
                ? <a key={i} href={href} className={cls}>{label}</a>
                : <button key={i} type="button" onClick={onClick} className={cls}>{label}</button>;
            })}
          </div>
        )}

        {children}
      </div>
    </section>
  );
}