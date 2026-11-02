"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { cn } from "./cn";

type SliderProps = {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  label: string;
  className?: string;
};

/**
 * Horizontal slider that snaps to its steps. Track and fill follow the BottomBand progress bar.
 * The thumb glides between stops, including while it is being dragged.
 */
export function Slider({ min, max, step = 1, value, onChange, label, className }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const pct = ((value - min) / (max - min)) * 100;

  const snap = (v: number) => Math.min(Math.max(Math.round((v - min) / step) * step + min, min), max);

  function fromPointer(clientX: number) {
    const rect = trackRef.current!.getBoundingClientRect();
    const t = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const next = snap(min + t * (max - min));
    if (next !== value) onChange(next);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    fromPointer(e.clientX);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e.clientX);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const delta = e.key === "ArrowRight" || e.key === "ArrowUp" ? step : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step : 0;
    if (!delta) return;
    e.preventDefault();
    onChange(snap(value + delta));
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={onKeyDown}
      className={cn("group flex cursor-pointer touch-none select-none items-center py-3 outline-none", className)}
    >
      <div ref={trackRef} className="relative h-x6 w-full rounded-full bg-text-grey-8">
        <div className="h-x6 rounded-full bg-primary-100 transition-all duration-300 ease-out" style={{ width: `${pct}%` }} />
        {/* Stop marks: grey dots 2px larger than the track on every side. */}
        {Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => (
          <span
            key={i}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-6"
            style={{
              left: `${(i * step * 100) / (max - min)}%`,
              width: "calc(var(--space-x6) + 2 * var(--space-0))",
              height: "calc(var(--space-x6) + 2 * var(--space-0))",
            }}
          />
        ))}
        <div
          className={cn(
            "absolute top-1/2 size-x20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary-100 bg-white-100 shadow-tooltip transition-all duration-300 ease-out group-focus-visible:ring-4 group-focus-visible:ring-primary-24",
            dragging && "scale-110",
          )}
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}
