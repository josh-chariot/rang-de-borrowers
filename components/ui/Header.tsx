"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { cn } from "./cn";
import { Icon } from "./Icon";

/**
 * Figma: Common Assets > Header (General / Investment / Focus, logged out).
 * Logged-in states are not built yet.
 */
type HeaderProps = {
  /** general = Lend CTA + login + menu. investment = no Lend CTA. focus = logo only. */
  variant?: "general" | "investment" | "focus";
  /** Optional strip above the nav, e.g. a story or announcement. */
  banner?: string;
  onBannerClick?: () => void;
  menuItems?: { label: string; href: string }[];
  className?: string;
};

const DEFAULT_MENU = [
  { label: "About us", href: "#" },
  { label: "How it works", href: "#" },
  { label: "Borrow", href: "#" },
  { label: "Contact", href: "#" },
];

export function Header({
  variant = "general",
  banner,
  onBannerClick,
  menuItems = DEFAULT_MENU,
  className,
}: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Shadow fades in once the page is scrolled and disappears back at the very top.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  return (
    <>
      {banner && (
        <button
          type="button"
          onClick={onBannerClick}
          className="flex w-full items-center justify-center gap-f1 bg-primary-16 px-3 py-2 text-h6 font-black uppercase text-primary-100"
        >
          {banner}
          <Icon name="chevron-right-small" />
        </button>
      )}
      <header id="site-header" className={cn("sticky top-6 z-40 pt-4", className)}>
        <div className="relative isolate mx-auto flex w-full max-w-page items-center justify-between px-4">
          {/* White card behind the nav, wider than the content so nothing moves when it sticks. */}
          <div data-nav-card className="absolute -inset-x-2 -inset-y-4 -z-10 rounded-4 bg-white-100 md:-inset-x-6" />
          <div
            className={cn(
              "absolute -inset-x-2 -inset-y-4 -z-10 rounded-4 shadow-6 transition-opacity duration-300 md:-inset-x-6",
              scrolled ? "opacity-100" : "opacity-0",
            )}
          />
          <a href="/" aria-label="Rang De home" className="flex flex-col items-start">
            <span className="grid h-7 place-items-center md:h-8">
              {/* eslint-disable-next-line @next/next/no-img-element -- static SVG */}
              <img src="/brand/rangde-logo.svg" width={57} height={45} alt="Rang De" className="h-full w-auto" />
            </span>
            <small
              className="whitespace-nowrap font-medium uppercase tracking-wider text-text-grey-48"
              style={{ fontSize: "calc(var(--font-size-h6) * 0.6)", lineHeight: "var(--space-2)" }}
            >
              Rang De P2P Financial Services Ltd.
            </small>
          </a>

          {variant !== "focus" && (
            <div ref={menuRef} className="relative flex items-stretch gap-f1 md:gap-2">
              {variant === "general" && (
                <Button size="md" className="max-md:p-2 max-md:text-p4">
                  Lend
                </Button>
              )}
              <Button variant="secondary" size="md" className="max-md:p-2 max-md:text-p4">
                Sign up / Login
              </Button>
              <button
                type="button"
                aria-label="Menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center rounded-2 border-2 border-text-grey-16 px-2 transition-colors hover:bg-text-grey-4 md:px-3"
              >
                <Icon name="menu" />
              </button>
              {menuOpen && (
                <nav className="absolute right-zero top-full z-10 mt-2 grid min-w-max rounded-4 bg-white-100 p-2 shadow-popup">
                  {menuItems.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="rounded-2 px-4 py-3 text-p3 font-medium text-text-grey-100 hover:bg-text-grey-8"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              )}
            </div>
          )}
        </div>
      </header>
    </>
  );
}
