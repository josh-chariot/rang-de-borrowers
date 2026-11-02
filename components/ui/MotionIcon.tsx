"use client";

import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";
import { cn } from "./cn";

/**
 * Animated icons (Lottie JSON from Lordicon) live in public/icons/motion.
 * Add a name here only after copying the JSON from the design assets.
 */
export type MotionIconName =
  | "eye-morph-select"
  | "calendar-dots-morph-select"
  | "heart-morph-select"
  | "location-pin-morph-select";

/**
 * Frame each icon rests on when active. These Lordicon "morph-select" files fill in during the first
 * half and empty again in the second (the eye blinks shut and open), so the selected (filled) state
 * is mid-file, where the fill has settled.
 */
const ACTIVE_FRAME: Record<MotionIconName, number> = {
  "eye-morph-select": 30,
  "calendar-dots-morph-select": 28,
  "heart-morph-select": 29,
  // Built by scripts/build-location-pin.mjs: fills bottom to top while it flips (4–40), settled by 60.
  "location-pin-morph-select": 62,
};

type MotionIconProps = {
  name: MotionIconName;
  /** false = default state (frame 0); true = plays to the selected state, and back when false again. */
  active?: boolean;
  /** Change this number to play the whole animation once (e.g. a blink on tap). */
  playKey?: number;
  /** Rendered size in px. */
  size: number;
  className?: string;
};

export function MotionIcon({ name, active = false, playKey, size, className }: MotionIconProps) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ default: lottie }, data] = await Promise.all([
        import("lottie-web/build/player/lottie_light"),
        fetch(`/icons/motion/${name}.json`).then((r) => r.json()),
      ]);
      if (cancelled || !boxRef.current) return;
      const anim = lottie.loadAnimation({
        container: boxRef.current,
        renderer: "svg",
        loop: false,
        autoplay: false,
        animationData: data,
      });
      animRef.current = anim;
      anim.goToAndStop(activeRef.current ? ACTIVE_FRAME[name] : 0, true);
    })();
    return () => {
      cancelled = true;
      animRef.current?.destroy();
      animRef.current = null;
    };
  }, [name]);

  // Play from wherever the icon is now to the target frame (backwards when the target is earlier).
  useEffect(() => {
    const anim = animRef.current;
    if (!anim) return;
    const from = anim.firstFrame + anim.currentFrame;
    const to = active ? ACTIVE_FRAME[name] : 0;
    if (Math.abs(from - to) < 0.5) anim.goToAndStop(to, true);
    else anim.playSegments([from, to], true);
  }, [active, name]);

  useEffect(() => {
    const anim = animRef.current;
    if (!anim || playKey === undefined) return;
    anim.playSegments([0, anim.getDuration(true) - 1], true);
  }, [playKey]);

  return (
    <span
      ref={boxRef}
      aria-hidden="true"
      className={cn("block shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}
