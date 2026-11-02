import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "pill" | "underlined";
export type ButtonSize = "lg" | "md" | "sm";
/** "primary" = blue on light surfaces (Figma Color=Primary/Default). "white" = for dark surfaces. */
export type ButtonTone = "primary" | "white";
/** success and delete exist only for variant="primary" size="lg" in Figma. */
export type ButtonStatus = "default" | "success" | "delete";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  tone?: ButtonTone;
  status?: ButtonStatus;
  iconBefore?: ReactNode;
  iconAfter?: ReactNode;
  className?: string;
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-2 font-sans transition-colors disabled:cursor-not-allowed";

/** Padding, height and type size for filled (primary/secondary) buttons. */
const BOX_SIZE: Record<ButtonSize, string> = {
  lg: "min-h-8 px-x24 py-3 text-p3 font-bold",
  md: "px-4 py-2 text-p3 font-bold",
  sm: "min-h-x36 px-4 py-x6 text-p4 font-bold",
};

/** Type size only, for text-only buttons. */
const TEXT_SIZE: Record<ButtonSize, string> = {
  lg: "text-p3 font-bold",
  md: "text-p3 font-bold",
  sm: "text-p4 font-bold",
};

const PRIMARY: Record<ButtonTone, string> = {
  primary:
    "bg-primary-100 text-white-100 hover:opacity-88 disabled:bg-primary-64 disabled:hover:opacity-100",
  white:
    "bg-white-100 text-primary-100 hover:opacity-88 disabled:bg-white-64 disabled:text-white-64 disabled:hover:opacity-100",
};

const SECONDARY: Record<ButtonTone, string> = {
  primary:
    "bg-primary-16 text-primary-100 hover:bg-primary-24 disabled:bg-primary-8 disabled:text-primary-40",
  white:
    "bg-white-16 text-white-100 hover:bg-white-24 disabled:bg-white-16 disabled:text-white-40",
};

const TERTIARY: Record<ButtonTone, string> = {
  primary: "text-primary-100 disabled:text-primary-40",
  white: "text-white-100 disabled:text-white-40",
};

const PILL: Record<ButtonTone, string> = {
  primary:
    "rounded-full border border-primary-48 px-4 py-2 text-p4 font-bold text-primary-100 decoration-primary-48 decoration-from-font hover:bg-primary-8 hover:underline disabled:opacity-50",
  white:
    "rounded-full border border-white-48 px-4 py-2 text-p4 font-bold text-white-100 decoration-white-48 decoration-from-font hover:bg-white-8 hover:underline disabled:opacity-50",
};

const UNDERLINED: Record<ButtonTone, string> = {
  primary:
    "text-p3 font-medium text-text-grey-64 underline decoration-dotted decoration-text-grey-48 decoration-from-font hover:text-text-grey-80 disabled:text-text-grey-40",
  white:
    "text-p3 font-medium text-white-64 underline decoration-dotted decoration-white-32 decoration-from-font hover:text-white-100 disabled:text-white-40",
};

/** Success / delete tint. On the white tone the tint sits over a white fill. */
const STATUS: Record<Exclude<ButtonStatus, "default">, Record<ButtonTone, string>> = {
  success: {
    primary: "bg-green-16 text-green-100 hover:opacity-100",
    white:
      "relative isolate bg-white-100 text-green-100 hover:opacity-100 before:absolute before:inset-zero before:-z-10 before:rounded-2 before:bg-green-16",
  },
  delete: {
    primary: "bg-red-16 text-red-100 hover:opacity-100",
    white:
      "relative isolate bg-white-100 text-red-100 hover:opacity-100 before:absolute before:inset-zero before:-z-10 before:rounded-2 before:bg-red-16",
  },
};

function look(variant: ButtonVariant, size: ButtonSize, tone: ButtonTone, status: ButtonStatus) {
  switch (variant) {
    case "primary": {
      const colours = status === "default" ? PRIMARY[tone] : STATUS[status][tone];
      return cn(BOX_SIZE[size], colours);
    }
    case "secondary":
      return cn(BOX_SIZE[size], SECONDARY[tone]);
    case "tertiary":
      return cn(TEXT_SIZE[size], TERTIARY[tone]);
    case "pill":
      return PILL[tone];
    case "underlined":
      return UNDERLINED[tone];
  }
}

export function Button({
  variant = "primary",
  size = "lg",
  tone = "primary",
  status = "default",
  iconBefore,
  iconAfter,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const filled = variant === "primary" || variant === "secondary";
  return (
    <button type={type} className={cn(BASE, look(variant, size, tone, status), className)} {...rest}>
      <span className={cn("inline-flex items-center justify-center gap-2", filled && "py-r1")}>
        {iconBefore && <span className="flex items-center py-r0">{iconBefore}</span>}
        {children}
        {iconAfter && <span className="flex items-center py-r0">{iconAfter}</span>}
      </span>
    </button>
  );
}
