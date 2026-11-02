"use client";

import { useEffect, useRef } from "react";
import {
  DEFAULT_LEVEL,
  INTRO_COLS,
  MOBILE_BREAKPOINT,
  bezier,
  drawFaces,
  easeInOut,
  levelsFor,
  loadAtlases,
  loadedAtlases,
  radiusRatio,
  readTokens,
  tileSize,
} from "./engine";
import type { Tile, Tokens } from "./engine";
import { FACE_COUNT } from "./faces";

/**
 * Opening sequence: a wall of tiny borrower faces travels upward through it (the wall slides down)
 * and eases to a stop, the camera zooms in five steps until faces are recognisable, then every face fades out.
 */
/** Longest wait for the face atlas before starting with grey frames. */
const ATLAS_WAIT_MS = 1500;
const SCROLL_MS = 2400;
const ZOOM_STEPS = 5;
const ZOOM_STEP_MS = 480;
const ZOOM_PAUSE_MS = 110;
const FADE_MS = 520;
/** Each frame starts fading after a random delay up to this, so the wall dissolves rather than blinks. */
const FADE_SPREAD_MS = 420;
/** At least this many borrowers scroll past. */
const MIN_PASSED = 800;
/** Wall opacity before the first zoom; it reaches 1 at the end of the last zoom. */
const START_OPACITY = 0.64;
/** Zoom steps showing at least this many faces at their start are pre-drawn instead of drawn live. */
const CACHE_MIN_FACES = 2500;

const scrollEase = bezier(0.45, 0, 0.12, 1);

/** Cheap integer hash -> [0, 1). */
function hash(n: number) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Random face for a wall cell that differs from its left and upper neighbours' first picks. */
function faceAt(r: number, c: number, cols: number) {
  const pick = (rr: number, cc: number, salt: number) => Math.floor(hash(((rr + 100000) * cols + cc) ^ salt) * FACE_COUNT);
  const face = pick(r, c, 0x51ed);
  if (face !== pick(r, c - 1, 0x51ed) && face !== pick(r - 1, c, 0x51ed)) return face;
  return pick(r, c, 0x2c1b);
}

/** Tile size for `cols` columns spanning the full width with no side padding. */
function edgeTile(width: number, cols: number, t: Tokens) {
  return width / (cols + (cols - 1) * t.gapRatio);
}

export function Intro({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const t = readTokens();
    // Columns and the distance travelled (in rows) are fixed at the start; sizes follow the window,
    // so browser zoom (which resizes the viewport) rescales the wall without restarting the sequence.
    const cols = window.innerWidth < MOBILE_BREAKPOINT ? INTRO_COLS.mobile : INTRO_COLS.desktop;
    const startPitch = edgeTile(window.innerWidth, cols, t) * (1 + t.gapRatio);
    const travelRows = Math.max((window.innerHeight * 1.5) / startPitch, Math.ceil(MIN_PASSED / cols));
    const zoomStart = SCROLL_MS;
    const fadeStart = zoomStart + ZOOM_STEPS * (ZOOM_STEP_MS + ZOOM_PAUSE_MS);
    const end = fadeStart + FADE_SPREAD_MS + FADE_MS;
    let start = 0;
    let raf = 0;
    let cancelled = false;

    // Drawing every face live costs ~3µs each; the dense early frames hold 5,000–20,000 faces, which
    // blew the frame budget and made the browser flash black tiles. So the busy parts are pre-drawn:
    //  - the scroll phase (no zoom) slides a window over one tall image of the whole wall
    //  - each busy zoom step scales one image, drawn once at the sharpness of that step's end
    // Only the light steps and the fade-out draw faces live. Images are redrawn if the window
    // size changes (browser zoom).
    const white = getComputedStyle(document.documentElement).getPropertyValue("--color-white-100").trim();
    type Cached = { image: HTMLCanvasElement; key: string; x0: number; y0: number; scale: number };
    let wall: Cached | null = null;
    const steps = new Map<number, { from: Cached; to: Cached }>();

    /** Draws world rect [x0,x1]×[y0,y1] (world y = row × pitch, before any scroll offset) at `scale` device px per world px. */
    const bake = (key: string, W: number, x0: number, y0: number, x1: number, y1: number, scale: number, ratio: number): Cached | null => {
      if (!loadedAtlases().length) return null;
      const s0 = edgeTile(W, cols, t);
      const pitch = s0 * (1 + t.gapRatio);
      const image = document.createElement("canvas");
      image.width = Math.ceil((x1 - x0) * scale);
      image.height = Math.ceil((y1 - y0) * scale);
      const ictx = image.getContext("2d")!;
      ictx.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
      const tiles: Tile[] = [];
      for (let r = Math.floor(y0 / pitch) - 1; r <= Math.ceil(y1 / pitch); r++) {
        for (let c = Math.floor(x0 / pitch) - 1; c <= Math.ceil(x1 / pitch); c++) {
          const id = (r + 100000) * cols + c;
          tiles.push({ x: c * pitch, y: r * pitch, face: faceAt(r, c, cols), tone: Math.floor(hash(id) * t.tones.length) });
        }
      }
      drawFaces(ictx, tiles, s0, ratio, t, scale);
      return { image, key, x0, y0, scale };
    };

    const wallFor = (W: number, H: number, dpr: number) => {
      const key = `${W}x${H}x${dpr}`;
      if (wall?.key !== key) {
        const s0 = edgeTile(W, cols, t);
        const pitch = s0 * (1 + t.gapRatio);
        wall = bake(key, W, 0, -pitch, W, travelRows * pitch + H + pitch, dpr, radiusRatio(s0, W, levelsFor(W), t));
      }
      return wall;
    };

    /** Zoom of step k (1-based) at its start and end. */
    const stepZoom = (k: number, zEnd: number) => [Math.pow(zEnd, (k - 1) / ZOOM_STEPS), Math.pow(zEnd, k / ZOOM_STEPS)];

    /**
     * Images for zoom step k: everything visible at the step's start, drawn as sharp as its end needs,
     * twice: with the corner radius of the step's start and of its end. Cross-fading the two across
     * the step makes the corners round smoothly, as they do when drawn live. Null = draw live.
     */
    const stepFor = (k: number, W: number, H: number, dpr: number, zEnd: number) => {
      const s0 = edgeTile(W, cols, t);
      const pitch = s0 * (1 + t.gapRatio);
      const [zA, zB] = stepZoom(k, zEnd);
      if ((W / (pitch * zA)) * (H / (pitch * zA)) < CACHE_MIN_FACES) return null;
      const key = `${k}:${W}x${H}x${dpr}`;
      const hit = steps.get(k);
      if (hit?.from.key === key) return hit;
      const cx = W / 2;
      const cy = H / 2;
      const levels = levelsFor(W);
      const at = (z: number) =>
        bake(key, W, cx - cx / zA, cy - cy / zA, cx + (W - cx) / zA, cy + (H - cy) / zA, zB * dpr, radiusRatio(s0 * z, W, levels, t));
      const from = at(zA);
      const to = at(zB);
      if (!from || !to) return null;
      const pair = { from, to };
      steps.set(k, pair);
      return pair;
    };

    const frame = () => {
      const now = performance.now() - start;
      const W = window.innerWidth;
      const H = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      const levels = levelsFor(W);
      const s0 = edgeTile(W, cols, t);
      const pitch = s0 * (1 + t.gapRatio);
      // Ends at the face size the directory opens with.
      const landing = levels[DEFAULT_LEVEL];
      const zEnd = (landing.kind === "grid" ? tileSize(W, landing.cols, t) : t.listPhoto) / s0;
      const cx = W / 2;
      const cy = H / 2;
      // The wall slides down, so the eye travels from bottom to top, then eases to a stop.
      const offset = travelRows * pitch * (1 - scrollEase(Math.min(now / SCROLL_MS, 1)));
      // Zoom: geometric steps of equal ratio, each eased, with a short pause between.
      let z = 1;
      let zoomed = 0;
      let stepNo = 0; // 1..5 while zooming (and in the pause after), 0 before
      let pausing = false;
      if (now > zoomStart) {
        const into = now - zoomStart;
        const step = Math.floor(into / (ZOOM_STEP_MS + ZOOM_PAUSE_MS));
        const local = Math.min((into - step * (ZOOM_STEP_MS + ZOOM_PAUSE_MS)) / ZOOM_STEP_MS, 1);
        const k = step >= ZOOM_STEPS ? ZOOM_STEPS : step + easeInOut(local);
        z = Math.pow(zEnd, k / ZOOM_STEPS);
        zoomed = k / ZOOM_STEPS;
        stepNo = Math.min(step + 1, ZOOM_STEPS);
        pausing = local >= 1 && step < ZOOM_STEPS - 1;
      }

      const draw = () => {
        // Scroll phase: copy a window of the wall.
        const wallImg = now <= zoomStart ? wallFor(W, H, dpr) : null;
        if (wallImg) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(wallImg.image, 0, (offset - wallImg.y0) * dpr, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
          return;
        }
        wall = null; // Scroll phase is over: free the image.
        // Busy zoom step: scale its image about the screen centre.
        const stepImg = now < fadeStart && stepNo ? stepFor(stepNo, W, H, dpr, zEnd) : null;
        if (stepImg) {
          const { from, to } = stepImg;
          const w = from.image.width / from.scale;
          const h = from.image.height / from.scale;
          const x = cx + (from.x0 - cx) * z;
          const y = cy + (from.y0 - cy) * z;
          // How far through this step's zoom we are (same easing as the zoom itself).
          const f = Math.min(Math.max(zoomed * ZOOM_STEPS - (stepNo - 1), 0), 1);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, W, H);
          // Additive cross-fade: faces stay fully opaque, only the corners blend from one radius to the other.
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = 1 - f;
          ctx.drawImage(from.image, x, y, w * z, h * z);
          ctx.globalAlpha = f;
          ctx.drawImage(to.image, x, y, w * z, h * z);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
          return;
        }
        // Light steps and the fade-out: draw faces live.
        const size = s0 * z;
        const x0 = cx - cx / z;
        const x1 = cx + (W - cx) / z;
        const y0 = cy - cy / z + offset;
        const y1 = cy + (H - cy) / z + offset;
        const tiles: Tile[] = [];
        for (let r = Math.floor(y0 / pitch) - 1; r <= Math.ceil(y1 / pitch); r++) {
          for (let c = Math.floor(x0 / pitch) - 1; c <= Math.ceil(x1 / pitch); c++) {
            const id = (r + 100000) * cols + c;
            let alpha = 1;
            if (now > fadeStart) {
              const delay = hash(id ^ 0x9e37) * FADE_SPREAD_MS;
              alpha = 1 - Math.min(Math.max((now - fadeStart - delay) / FADE_MS, 0), 1);
            }
            tiles.push({
              x: cx + (c * pitch - cx) * z,
              y: cy + (r * pitch - offset - cy) * z,
              face: faceAt(r, c, cols),
              tone: Math.floor(hash(id) * t.tones.length),
              alpha,
            });
          }
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        drawFaces(ctx, tiles, size, radiusRatio(size, W, levels, t), t, dpr);
      };
      draw();

      // Opacity climbs in equal steps with each zoom, on the same easing: 64, 71.2, 78.4, 85.6, 92.8, 100%.
      // Painted as a white veil inside the canvas (identical on the white backdrop) rather than CSS
      // opacity, which made the browser re-composite this huge layer every frame.
      const veil = (1 - START_OPACITY) * (1 - zoomed);
      if (veil > 0) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "source-atop";
        ctx.globalAlpha = veil;
        ctx.fillStyle = white;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }

      // Prepare the next step's image during this pause, while nothing on screen moves.
      if (pausing) stepFor(stepNo + 1, W, H, dpr, zEnd);
      for (const k of steps.keys()) if (k < stepNo) steps.delete(k);

      if (now >= end) done.current();
      else raf = requestAnimationFrame(frame);
    };
    // Start once the faces are ready (or after a short wait, with grey frames).
    const go = () => {
      if (cancelled || start) return;
      // Build the wall and the first zoom step before the clock starts, so no frame stalls.
      const W = window.innerWidth;
      const dpr = window.devicePixelRatio || 1;
      const landing = levelsFor(W)[DEFAULT_LEVEL];
      const zEnd = (landing.kind === "grid" ? tileSize(W, landing.cols, t) : t.listPhoto) / edgeTile(W, cols, t);
      wallFor(W, window.innerHeight, dpr);
      stepFor(1, W, window.innerHeight, dpr, zEnd);
      start = performance.now();
      raf = requestAnimationFrame(frame);
    };
    loadAtlases().then(go, go);
    const timer = setTimeout(go, ATLAS_WAIT_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="fixed inset-zero z-50 bg-white-100" aria-hidden="true">
      {/* The wall starts at 64% opacity and reaches 100% on the fifth zoom (painted per frame). */}
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
