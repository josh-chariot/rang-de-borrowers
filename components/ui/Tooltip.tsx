import type { ReactNode } from "react";
import { cn } from "./cn";

type TooltipProps = {
  children: ReactNode;
  /** Optional label / value row under a divider, e.g. { label: "Total", value: "₹ 1,498" }. */
  footer?: { label: string; value: string };
  /** Which side the arrow sits on. "top" = arrow above the box. */
  arrow?: "top" | "bottom";
  pointer?: "left" | "center" | "right";
  showPointer?: boolean;
  /** "grey" = page-grey box. "tint" = 8% text-grey box. */
  tone?: "grey" | "tint";
  className?: string;
};

const POINTER_ALIGN = {
  left: "items-start",
  center: "items-center",
  right: "items-end",
} as const;

export function Tooltip({
  children,
  footer,
  arrow = "top",
  pointer = "left",
  showPointer = true,
  tone = "grey",
  className,
}: TooltipProps) {
  const pointerSrc =
    tone === "grey" ? "/ui/tooltip-pointer-bg-grey.svg" : "/ui/tooltip-pointer-8-grey.svg";

  const pointerEl = showPointer && (
    <div
      className={cn(
        "flex w-full flex-col overflow-clip px-r2",
        POINTER_ALIGN[pointer],
        arrow === "bottom" && "-scale-y-100",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG */}
      <img src={pointerSrc} width={16} height={8} alt="" aria-hidden="true" />
    </div>
  );

  const box = (
    <div
      role="tooltip"
      className={cn(
        "flex w-full flex-col gap-r2 rounded-2 p-r3 text-p4 font-medium text-text-grey-100",
        tone === "grey" ? "bg-bg-grey shadow-tooltip" : "bg-text-grey-8 shadow-popup",
      )}
    >
      <p>{children}</p>
      {footer && (
        <>
          <div className="border-t border-text-grey-16" />
          <div className="flex items-center justify-between whitespace-nowrap">
            <span>{footer.label}</span>
            <span>{footer.value}</span>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className={cn("flex w-full flex-col items-center", className)}>
      {arrow === "top" ? (
        <>
          {pointerEl}
          {box}
        </>
      ) : (
        <>
          {box}
          {pointerEl}
        </>
      )}
    </div>
  );
}
