"use client";

import { useEffect, useRef } from "react";
import type { MouseEvent, PointerEvent } from "react";
import { cn } from "./cn";

export type TickerPill = { id: string; label: string };

type PillTickerProps = {
  items: TickerPill[];
  onSelect?: (id: string) => void;
  /**
   * Classes for the edge fades, which must match the surface behind the strip,
   * e.g. "from-bg-grey". `edgeHoverClassName` is shown on top when the parent `group` is hovered.
   */
  edgeClassName?: string;
  edgeHoverClassName?: string;
  className?: string;
};

/** Ticker speed in px per second. */
const SPEED = 32;
/** Pointer travel (px) after which a press becomes a drag instead of a click. */
const DRAG_SLOP = 5;

/**
 * A strip of pills that scrolls right to left forever, fading out under a 24px left edge and
 * in from under a 64px right edge. It pauses while the pointer or focus is on it, and can be dragged
 * left or right with a mouse or a finger; a drag never counts as a click on a pill or the card behind.
 */
export function PillTicker({
  items,
  onSelect,
  edgeClassName = "from-bg-grey",
  edgeHoverClassName,
  className,
}: PillTickerProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const st = useRef({
    offset: 0,
    hovered: false,
    focused: false,
    drag: null as null | { id: number; x: number; start: number; moved: boolean },
    /** True right after a drag, to swallow the click the browser fires on release. */
    dragged: false,
  });

  // Moves the strip each frame: a steady right-to-left drift unless hovered, focused or held.
  // The offset wraps at one copy's width (the second copy hides the seam), in both directions.
  useEffect(() => {
    const track = trackRef.current!;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const s = st.current;
      if (!s.hovered && !s.focused && !s.drag) s.offset -= (SPEED * Math.min(now - last, 50)) / 1000;
      last = now;
      const loop = track.scrollWidth / 2;
      if (loop > 0) s.offset = (((s.offset % loop) - loop) % loop);
      track.style.transform = `translateX(${s.offset}px)`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [items]);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    const s = st.current;
    s.drag = { id: e.pointerId, x: e.clientX, start: s.offset, moved: false };
    s.dragged = false;
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = st.current.drag;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > DRAG_SLOP) {
      d.moved = true;
      // Keep following the pointer outside the strip; not every pointer can be captured.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    }
    if (d.moved) st.current.offset = d.start + dx;
  }

  function endDrag(e: PointerEvent<HTMLDivElement>) {
    const s = st.current;
    if (!s.drag || s.drag.id !== e.pointerId) return;
    s.dragged = s.drag.moved;
    s.drag = null;
  }

  function onClickCapture(e: MouseEvent<HTMLDivElement>) {
    const s = st.current;
    if (!s.dragged) return;
    s.dragged = false;
    e.stopPropagation();
    e.preventDefault();
  }

  const edge = (side: "left" | "right") => {
    const shape = side === "left" ? "left-zero w-x24 bg-linear-to-r" : "right-zero w-9 bg-linear-to-l";
    return (
      <>
        <div className={cn("pointer-events-none absolute inset-y-zero z-10 to-transparent", shape, edgeClassName)} />
        {edgeHoverClassName && (
          <div
            className={cn(
              "pointer-events-none absolute inset-y-zero z-10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100",
              shape,
              edgeHoverClassName,
            )}
          />
        )}
      </>
    );
  };

  return (
    <div
      className={cn("relative cursor-grab touch-pan-y select-none overflow-hidden active:cursor-grabbing", className)}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") st.current.hovered = true;
      }}
      onPointerLeave={() => {
        st.current.hovered = false;
      }}
      onFocus={() => {
        st.current.focused = true;
      }}
      onBlur={() => {
        st.current.focused = false;
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={onClickCapture}
      onDragStart={(e) => e.preventDefault()}
    >
      <div ref={trackRef} className="flex w-max items-center will-change-transform">
        {/* Two copies so the loop is seamless; the second is decorative. */}
        {[0, 1].map((copy) => (
          <div key={copy} className="flex items-center gap-2 pr-2" aria-hidden={copy === 1 || undefined}>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                tabIndex={copy === 1 ? -1 : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(item.id);
                }}
                className="whitespace-nowrap rounded-full bg-text-grey-16 px-4 py-f1 text-p3 font-medium text-text-grey-48 transition-colors duration-300 hover:bg-primary-24 hover:text-text-grey-64"
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>
      {edge("left")}
      {edge("right")}
    </div>
  );
}
