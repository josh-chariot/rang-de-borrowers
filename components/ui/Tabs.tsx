"use client";

import type { ReactNode } from "react";
import { cn } from "./cn";

export type TabItem = {
  id: string;
  label: string;
  /** Level 1 only. Pass an <Icon /> element. */
  icon?: ReactNode;
  disabled?: boolean;
};

type TabsProps = {
  /** level1 = underlined top-level tabs. level2 = segmented pill group. */
  level?: 1 | 2;
  /** Level 2 only. "lg" = roomier tabs, P3 medium black labels on one line (e.g. the borrower directory's view switcher). */
  size?: "md" | "lg";
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
};

export function Tabs({ level = 1, size = "md", items, value, onChange, className }: TabsProps) {
  if (level === 2) {
    return (
      <div
        role="tablist"
        className={cn(
          "flex items-center justify-center gap-f1 rounded-4 bg-text-grey-8 p-f1",
          className,
        )}
      >
        {items.map((item, i) => {
          const selected = item.id === value;
          return (
            <span key={item.id} className="flex flex-1 items-center gap-f1">
              {item.disabled && i > 0 && (
                // eslint-disable-next-line @next/next/no-img-element -- static SVG
                <img src="/ui/tab-separator.svg" width={1} height={16} alt="" aria-hidden="true" />
              )}
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                disabled={item.disabled}
                onClick={() => onChange(item.id)}
                className={cn(
                  "flex min-w-0 flex-1 items-center justify-center rounded-2 py-2 transition-colors",
                  size === "lg" ? "whitespace-nowrap px-r4 text-p3 font-medium text-text-grey-100" : "px-r3 text-p4 text-text-grey-80",
                  selected
                    ? cn("bg-white-100", size === "md" && "font-bold")
                    : cn("hover:bg-white-48", size === "md" && "font-medium"),
                  "disabled:cursor-not-allowed disabled:bg-transparent disabled:text-text-grey-40",
                )}
              >
                {item.label}
              </button>
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      className={cn("flex items-center gap-r4 border-b border-text-grey-16", className)}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={cn(
              "flex min-w-9 shrink-0 flex-col items-center justify-center gap-2 py-4 text-p3 transition-colors",
              selected
                ? "border-b-2 border-primary-100 font-bold text-primary-100"
                : "font-medium text-text-grey-80 hover:text-text-grey-100",
              "disabled:cursor-not-allowed disabled:text-text-grey-40",
            )}
          >
            {item.icon}
            <span className="whitespace-nowrap">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
