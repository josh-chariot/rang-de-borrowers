"use client";

import { useId, useState } from "react";
import type { ChangeEvent, FocusEvent, InputHTMLAttributes } from "react";
import { cn } from "./cn";
import { Icon } from "./Icon";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "size"> & {
  /** "field" = floating label with optional chevron. "compact" = right-aligned value box (Figma "Type 2"). */
  variant?: "field" | "compact";
  label?: string;
  /** Shows the red error state and this message underneath. */
  error?: string;
  /** Chevron on the right of a "field" input. Defaults to true as in Figma. */
  endIcon?: boolean;
  className?: string;
};

const BOX =
  "relative flex w-full items-center rounded-2 border bg-white-100 transition-colors";

export function Input({
  variant = "field",
  label,
  error,
  endIcon = true,
  className,
  disabled,
  value,
  defaultValue,
  onFocus,
  onBlur,
  onChange,
  id,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [focused, setFocused] = useState(false);
  const [typed, setTyped] = useState(String(defaultValue ?? ""));
  const current = value !== undefined ? String(value) : typed;
  const floated = focused || current.length > 0;
  const compact = variant === "compact";

  const border = error
    ? "border-red-100"
    : focused
      ? "border-primary-100"
      : disabled
        ? "border-text-grey-16"
        : "border-text-grey-16 hover:border-text-grey-40";

  const padding = compact
    ? "px-3 py-2"
    : floated
      ? "px-3 pt-x20 pb-2 md:pt-x24"
      : "px-3 py-x14 md:py-4";

  function handleFocus(e: FocusEvent<HTMLInputElement>) {
    setFocused(true);
    onFocus?.(e);
  }
  function handleBlur(e: FocusEvent<HTMLInputElement>) {
    setFocused(false);
    onBlur?.(e);
  }
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setTyped(e.target.value);
    onChange?.(e);
  }

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      <label
        htmlFor={inputId}
        className={cn(BOX, border, padding, disabled && "bg-text-grey-8", !disabled && "cursor-text")}
      >
        {!compact && label && (
          <span
            className={cn(
              "pointer-events-none absolute left-3 font-medium transition-all",
              floated
                ? "top-2 text-h6 tracking-normal text-text-grey-64"
                : "top-1/2 -translate-y-1/2 text-p3 text-text-grey-48",
            )}
          >
            {label}
          </span>
        )}
        <input
          id={inputId}
          disabled={disabled}
          value={value}
          defaultValue={defaultValue}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          aria-invalid={error ? true : undefined}
          className={cn(
            "w-full bg-transparent text-p3 font-medium outline-none placeholder:text-text-grey-48",
            compact && "text-right",
            disabled ? "text-text-grey-64" : "text-text-grey-100",
          )}
          {...rest}
        />
        {!compact && endIcon && (
          <Icon
            name="chevron-down"
            className={cn(
              "absolute right-3 top-1/2 size-4 -translate-y-1/2 md:size-x20",
              disabled && "opacity-50",
            )}
          />
        )}
      </label>
      {error && (
        <p
          className={cn(
            "px-3 text-h6 font-medium tracking-normal text-red-100",
            compact ? "text-right" : "md:px-4",
          )}
        >
          {error}
        </p>
      )}
    </div>
  );
}
