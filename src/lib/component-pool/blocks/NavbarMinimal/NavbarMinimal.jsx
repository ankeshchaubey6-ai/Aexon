import { cn } from "../../utils/cn.js";
import { useScroll } from "../../hooks/useScroll.js";

/**
 * NavbarMinimal — a clean, lightweight nav for auth pages, apps, and docs.
 * No mega-menus, no mobile drawer complexity — just logo + optional right slot.
 *
 * @param {React.ReactNode} logo
 * @param {React.ReactNode} [right]      - Anything on the right (buttons, avatar, etc.)
 * @param {React.ReactNode} [center]     - Optional center content (breadcrumb, title)
 * @param {boolean}         [border=true]
 * @param {boolean}         [sticky=true]
 * @param {"white"|"transparent"|"blur"} [bg="blur"]
 *
 * @example
 * // App shell header
 * <NavbarMinimal
 *   logo={<Logo />}
 *   right={
 *     <div className="flex items-center gap-2">
 *       <IconButton icon={<BellIcon/>} label="Notifications" />
 *       <Avatar name={user.name} src={user.avatar} size="sm" />
 *     </div>
 *   }
 * />
 *
 * // Auth page
 * <NavbarMinimal logo={<Logo />} border={false} bg="transparent" />
 */
export function NavbarMinimal({
  logo,
  right,
  center,
  border  = true,
  sticky  = true,
  bg      = "blur",
  className,
}) {
  const { y } = useScroll();

  const bgClass = {
    blur:        "bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md",
    white:       "bg-white dark:bg-zinc-950",
    transparent: "bg-transparent",
  }[bg] ?? "bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md";

  return (
    <>
      <header
        className={cn(
          "z-40 w-full",
          sticky && "fixed top-0 left-0 right-0",
          bgClass,
          border && "border-b border-gray-100 dark:border-zinc-800",
          y > 8 && bg === "transparent" && "bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800",
          "transition-all duration-200",
          className,
        )}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-4">
          <div className="shrink-0">
            {logo ?? <span className="text-lg font-bold text-gray-900 dark:text-white">Brand</span>}
          </div>

          {center && (
            <div className="flex-1 flex items-center justify-center">
              {center}
            </div>
          )}

          {right && (
            <div className={cn("flex items-center gap-3", !center && "ml-auto")}>
              {right}
            </div>
          )}
        </div>
      </header>
      {sticky && <div className="h-14" aria-hidden="true" />}
    </>
  );
}