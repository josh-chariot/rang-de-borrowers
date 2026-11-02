"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { Icon } from "./Icon";

type AccordionProps = {
  title: string;
  children: ReactNode;
  /** Optional action under the body, e.g. <Button variant="secondary" size="md">. */
  action?: ReactNode;
  defaultOpen?: boolean;
  /** Pass both to control it from outside. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

export function Accordion({
  title,
  children,
  action,
  defaultOpen = false,
  open,
  onOpenChange,
  className,
}: AccordionProps) {
  const [inner, setInner] = useState(defaultOpen);
  const isOpen = open ?? inner;

  function toggle() {
    const next = !isOpen;
    setInner(next);
    onOpenChange?.(next);
  }

  return (
    <div className={cn("flex w-full flex-col gap-r2", className)}>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={toggle}
        className="flex w-full items-center gap-4 text-left"
      >
        <span className="min-w-0 flex-1 text-p3 font-bold text-text-grey-100">{title}</span>
        <Icon name={isOpen ? "accordion-chevron-up" : "accordion-chevron-down"} />
      </button>
      {isOpen && (
        <>
          <div className="text-p3 font-medium text-text-grey-80">{children}</div>
          {action && <div className="flex">{action}</div>}
        </>
      )}
    </div>
  );
}
