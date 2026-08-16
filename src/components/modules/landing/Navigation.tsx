import React from "react";
import Image from "next/image";
import Link from "next/link";

import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { ModeToggle } from "@/components/common/ModeToggle";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

import logoImage from "../../../../public/assets/aexon-logo.svg";

interface NavigationProps {}

const Navigation: React.FC<NavigationProps> = async ({}) => {
  const user = await currentUser();

  const navItems = [
    { name: "Pricing",  href: "#pricing"  },
    { name: "Features", href: "#features" },
    { name: "About",    href: "#about"    },
    { name: "Docs",     href: "#join"     },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');

        .nav-root { font-family: 'DM Sans', sans-serif; }

        /* ── Clean navigation shell ── */
        .nav-shell {
          border-radius: 20px;
          background: hsl(var(--background) / 0.88);
          border: 1px solid hsl(var(--border) / 0.4);
          backdrop-filter: blur(24px) saturate(160%);
          -webkit-backdrop-filter: blur(24px) saturate(160%);
          box-shadow: 0 4px 20px -8px rgba(0, 0, 0, 0.15);
          transition: box-shadow 0.3s ease, transform 0.2s ease;
        }
        .nav-shell:hover {
          box-shadow: 0 8px 28px -8px rgba(59, 130, 246, 0.2);
          transform: translateY(-1px);
        }

        /* ── Premium Nav Link with improved hover ── */
        .nav-link {
          position: relative;
          display: block;
          padding: 6px 14px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: -0.01em;
          color: hsl(var(--foreground) / 0.6);
          transition: all 0.25s cubic-bezier(0.2, 0, 0, 1);
          overflow: hidden;
        }

        /* Background reveal effect */
        .nav-link::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #06b6d4, #4f46e5);
          opacity: 0;
          transform: translate(-50%, -50%);
          transition: width 0.4s ease, height 0.4s ease, opacity 0.3s ease;
          z-index: -1;
        }

        .nav-link:hover {
          color: white;
          transform: translateY(-1px);
        }

        .nav-link:hover::before {
          width: 200%;
          height: 200%;
          opacity: 0.15;
        }

        /* Subtle underline that expands on hover */
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: 4px;
          left: 50%;
          width: 0;
          height: 2px;
          background: linear-gradient(90deg, #3b82f6, #06b6d4, #4f46e5);
          transform: translateX(-50%);
          transition: width 0.3s cubic-bezier(0.2, 0, 0, 1);
          border-radius: 2px;
        }

        .nav-link:hover::after {
          width: calc(100% - 28px);
        }

        /* Active state for current page - can be toggled with a class */
        .nav-link.active {
          color: white;
          background: linear-gradient(135deg, #3b82f6, #06b6d4, #4f46e5);
          box-shadow: 0 4px 10px -2px #3b82f6;
        }

        /* ── Logo wordmark with blue/cyan/indigo gradient ── */
        .logo-wordmark {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.04em;
          line-height: 1;
          background: linear-gradient(135deg, #3b82f6, #06b6d4, #4f46e5);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        /* ── Logo image hover with premium effect ── */
        .logo-img {
          transition: transform 0.4s cubic-bezier(0.2, 0, 0, 1);
        }
        .logo-wrap {
          position: relative;
        }
        .logo-wrap::before {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 12px;
          background: linear-gradient(135deg, #3b82f6, #06b6d4, #4f46e5);
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: -1;
          filter: blur(8px);
        }
        .logo-wrap:hover::before {
          opacity: 0.3;
        }
        .logo-wrap:hover .logo-img {
          transform: scale(1.1);
        }

        /* ── Premium CTA button with enhanced hover ── */
        .cta-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 16px !important;
          border-radius: 10px !important;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: -0.01em;
          background: linear-gradient(135deg, #3b82f6, #06b6d4, #4f46e5) !important;
          color: white !important;
          border: none !important;
          box-shadow: 0 4px 12px -4px #3b82f6;
          transition: all 0.25s cubic-bezier(0.2, 0, 0, 1) !important;
          overflow: hidden;
          z-index: 1;
        }

        /* Gradient shift effect */
        .cta-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, #2563eb, #0891b2, #4338ca);
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: -1;
        }

        .cta-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 18px -4px #3b82f6;
        }

        .cta-btn:hover::before {
          opacity: 1;
        }

        .cta-btn:active {
          transform: translateY(0);
          box-shadow: 0 4px 10px -3px #3b82f6;
        }

        /* Arrow animation */
        .cta-arrow {
          transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1);
        }
        .cta-btn:hover .cta-arrow {
          transform: translateX(4px);
        }

        /* ── Premium divider ── */
        .nav-sep {
          width: 1px;
          height: 20px;
          background: linear-gradient(180deg, transparent, hsl(var(--foreground) / 0.2), transparent);
        }

        /* ── Version badge with premium style ── */
        .nav-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 30px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          background: #3b82f6;
          color: white;
          box-shadow: 0 2px 8px -2px #3b82f6;
          transition: all 0.25s ease;
        }
        .nav-badge:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px -2px #3b82f6;
        }
        .nav-badge-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: white;
          animation: subtlePulse 2s ease-in-out infinite;
        }

        @keyframes subtlePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        /* ── Avatar hover premium effect ── */
        .avatar-wrapper {
          transition: transform 0.25s ease;
        }
        .avatar-wrapper:hover {
          transform: scale(1.05);
        }

        /* ── Theme toggle hover effect ── */
        .theme-toggle {
          transition: all 0.25s ease;
        }
        .theme-toggle:hover {
          background: hsl(var(--foreground) / 0.08);
          transform: scale(1.05);
        }

        /* ── Mount animation ── */
        @keyframes nav-mount {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .nav-mount { animation: nav-mount 0.4s ease both; }

        /* ── Top padding ── */
        .nav-top-padding { padding-top: 20px; }
      `}</style>

      <header className="nav-root fixed top-0 left-0 right-0 z-[100] w-full nav-top-padding px-4 md:px-6">
        <div className="max-w-7xl mx-auto nav-mount">

          {/* ── PILL ── */}
          <div className="nav-shell relative">
            <div className="relative z-10 flex items-center justify-between h-[60px] px-4 md:px-5">

              {/* LOGO with premium hover effect */}
              <Link href="/" className="logo-wrap flex items-center gap-2.5 shrink-0 select-none">
                <div className="relative w-[32px] h-[32px] flex items-center justify-center">
                  <Image
                    src={logoImage}
                    width={28}
                    height={28}
                    alt="Aexon Logo"
                    className="logo-img relative"
                  />
                </div>
                <span className="logo-wordmark">
                  Aexon.
                </span>
              </Link>

              {/* NAV LINKS with premium hover effects */}
              <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-1">
                {navItems.map((item) => (
                  <Link key={item.name} href={item.href} className="nav-link">
                    {item.name}
                  </Link>
                ))}
              </nav>

              {/* ACTIONS */}
              <div className="flex items-center gap-2 shrink-0">

                {/* Version badge removed */}
                <span className="nav-sep hidden sm:block" />

                {/* CTA with enhanced premium hover */}
                <Link
                  href={user ? "/agency" : "/agency/sign-up"}
                  className={cn(
                    buttonVariants({ size: "sm", variant: "default" }),
                    "cta-btn"
                  )}
                >
                  <span>{user ? "Dashboard" : "Get Started"}</span>
                  <svg
                    className="cta-arrow w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>

                <span className="nav-sep" />

                {/* Avatar with premium hover */}
                {user && (
                  <div className="avatar-wrapper">
                    <UserButton
                      afterSignOutUrl="/"
                      appearance={{
                        elements: {
                          avatarBox:
                            "w-[30px] h-[30px] ring-1 ring-foreground/10 hover:ring-blue-500/50 transition-all duration-200 rounded-lg",
                          userButtonPopoverCard:
                            "border border-border/40 shadow-lg mt-3 rounded-xl",
                        },
                      }}
                    />
                  </div>
                )}

                {/* Theme toggle with premium hover */}
                <div className="theme-toggle flex items-center justify-center w-[32px] h-[32px] rounded-lg">
                  <ModeToggle />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export default Navigation;