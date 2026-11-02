"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/components/ui/cn";
import type { Borrower, Section } from "./data";
import { OUTCOME_LABEL, formatRupees } from "./data";
import {
  Layout,
  drawFaces,
  drawLabel,
  easeInOut,
  faceUrl,
  lerp,
  loadAtlases,
  radiusRatio,
  readTokens,
  strokeTile,
} from "./engine";
import type { LevelDef, Tile, Tokens } from "./engine";

/**
 * Zooming moves one level at a time. Each step is a fixed choreography that plays forwards to zoom in
 * and backwards to zoom out, so every part starts and ends in sync:
 *  - grid to grid: camera zoom around the anchor face (like the intro), then the new grid fades in cell for cell
 *  - grid to list: the anchor's column slides to the list's photo column while the other faces fade,
 *    then the list rows fade in on top of it
 *  - list to list: rows resize in place around the anchor row
 */
const STEP_MS = { grid: 760, mixed: 1000, list: 520 };
/** Steps run this much faster while more than one step is queued (dragging the slider across stops). */
const QUEUED_SPEED = 0.5;
/** grid step: share spent on the camera zoom before the new grid fades in. */
const CAMERA_END = 0.6;
/**
 * grid-to-list step, in order: the other faces fade out, the column moves (starting once the others
 * are mostly gone, so nothing overlaps), then the list fades in over the column.
 */
const OTHERS_GONE = 0.3;
const COLUMN_FROM = 0.2;
const COLUMN_ARRIVED = 0.62;
const LIST_FROM = 0.55;
/** Pointer travel (px) below which a press counts as a tap. */
const TAP_SLOP = 6;
/** ctrl+wheel / trackpad pinch delta that triggers one step. */
const WHEEL_STEP = 40;
/** Two-finger spread ratio that triggers one step. */
const PINCH_STEP = 1.3;

const OUTCOME_TEXT = { repaid: "text-green-100", "second-loan": "text-primary-100", repaying: "text-text-grey-64" };
const OUTCOME_DOT = { repaid: "bg-green-100", "second-loan": "bg-primary-100", repaying: "bg-text-grey-40" };

type View = { L: Layout; scroll: number };
type Kind = keyof typeof STEP_MS;
type Step = { lo: number; hi: number; A: View; B: View; anchor: [number, number] | null; p: number; d: 1 | -1; kind: Kind };

/** A grid drawn with screen = m * content + (tx, ty). `tiles` replaces the visible tiles when set. */
type GridLayer = { L: Layout; m: number; tx: number; ty: number; alpha: number; tiles?: Tile[] };
type LabelDraw = { x: number; y: number; title: string; detail: string; band: boolean; alpha: number };
/** A list row in screen coordinates; `full` cross-fades the compact text (0) into the full text (1). */
type Row = { b: Borrower; x: number; y: number; w: number; h: number; photo: number; ratio: number; full: number };
type Frame = { grids: GridLayer[]; labels: LabelDraw[]; rows: Row[]; listAlpha: number; live: boolean };

type GalleryProps = {
  sections: Section[];
  levels: LevelDef[];
  /** Target zoom level (0 = most zoomed out). */
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onOpen: (b: Borrower) => void;
  /** Panel height in px. */
  height: number;
  /** Empty space under the last row so the floating dock never covers it. */
  padBottom: number;
  /** Jump to a borrower (highlighted) or to the top of a section. Change `nonce` to repeat. */
  focus: GalleryFocus | null;
};

export type GalleryFocus = ({ id: number } | { section: string }) & { nonce: number };

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

export function Gallery({ sections, levels, zoom, onZoomChange, onOpen, height, padBottom, focus }: GalleryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const facesRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLCanvasElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<{ rows: Row[]; alpha: number; live: boolean; shift: number }>({
    rows: [],
    alpha: 0,
    live: false,
    shift: 0,
  });
  const [flashId, setFlashId] = useState<number | null>(null);

  const st = useRef({
    tokens: null as Tokens | null,
    width: 0,
    dpr: 1,
    off: [] as HTMLCanvasElement[],
    target: zoom,
    settled: zoom,
    view: null as View | null,
    step: null as Step | null,
    raf: 0,
    last: 0,
    point: null as [number, number] | null,
    hover: null as [number, number] | null,
    down: null as { x: number; y: number; moved: boolean } | null,
    touches: new Map<number, [number, number]>(),
    pinch: 0,
    wheel: 0,
  });
  const live = useRef({ sections, levels, padBottom, onZoomChange });
  live.current = { sections, levels, padBottom, onZoomChange };

  const viewH = () => scrollRef.current?.clientHeight ?? 0;
  const maxScroll = (L: Layout) => Math.max(0, L.height - viewH());

  const layoutFor = useCallback((level: number) => {
    const s = st.current;
    const { sections: secs, levels: lv, padBottom: pad } = live.current;
    return new Layout(secs.map((x) => x.items.length), s.width, lv[level], lv, s.tokens!, pad);
  }, []);

  /** Default anchor point: the middle of the visible gallery (above the dock). */
  const centre = useCallback((): [number, number] => {
    const h = viewH();
    return [st.current.width / 2, Math.max(h / 3, (h - live.current.padBottom) / 2)];
  }, []);

  /**
   * Builds the view for level `to` from view A, and picks the anchor: the face at the anchor point,
   * or a face on screen in the same column that lands closest to that point in the new layout.
   */
  const link = useCallback(
    (A: View, to: number): { B: View; anchor: [number, number] | null } => {
      const s = st.current;
      const B = layoutFor(to);
      const h = viewH();
      const [px, py] = s.point ?? centre();
      const hit = A.L.hit(px, py + A.scroll, true);
      if (!hit) return { B: { L: B, scroll: 0 }, anchor: null };
      const [sec, k0] = hit;
      const colB = B.colAt(px);
      let best = k0;
      let bestCost = Infinity;
      for (let dr = -12; dr <= 12; dr++) {
        const k = k0 + dr * A.L.cols;
        if (k < 0 || k >= A.L.counts[sec]) continue;
        const y = A.L.pos(sec, k)[1] - A.scroll;
        if (y < 0 || y + A.L.tile > h) continue;
        const cost = Math.abs(dr) * A.L.pitchY + Math.abs((k % B.cols) - colB) * B.pitchX;
        if (cost < bestCost) [best, bestCost] = [k, cost];
      }
      // Keep the anchor's centre at the same height on screen.
      const ya = A.L.pos(sec, best)[1] - A.scroll + A.L.tile / 2;
      const scroll = B.pos(sec, best)[1] + B.tile / 2 - ya;
      return { B: { L: B, scroll: Math.min(Math.max(scroll, 0), maxScroll(B)) }, anchor: [sec, best] };
    },
    [layoutFor, centre],
  );

  // ---------- Frames ----------

  const labelsOf = useCallback((L: Layout, m: number, tx: number, ty: number, alpha: number, pinned: boolean) => {
    const t = st.current.tokens!;
    const h = viewH();
    const out: LabelDraw[] = [];
    const cur = pinned ? L.sectionAt(-ty) : -1;
    live.current.sections.forEach((sec, i) => {
      let y = m * L.tops[i] + ty;
      const band = i === cur && y < 0;
      if (i === cur) y = Math.min(Math.max(y, 0), m * (L.tops[i + 1] ?? Infinity) + ty - t.headerH);
      if (y > h || y < -t.headerH) return;
      out.push({ x: m * L.labelX + tx, y, title: sec.label, detail: `${sec.items.length.toLocaleString("en-IN")} borrowers`, band, alpha });
    });
    return out;
  }, []);

  /** Visible list rows of a settled list view. */
  const rowsOf = useCallback((V: View): Row[] => {
    const { L, scroll } = V;
    const rows: Row[] = [];
    live.current.sections.forEach((sec, i) => {
      const [k0, k1] = L.range(i, scroll - L.pitchY, scroll + viewH());
      for (let k = k0; k < k1; k++) {
        const [x, y] = L.box(i, k);
        rows.push({ b: sec.items[k], x, y: y - scroll, w: L.rowW, h: L.pitchY, photo: L.tile, ratio: L.ratio, full: L.compact ? 0 : 1 });
      }
    });
    return rows;
  }, []);

  const settledFrame = useCallback(
    (V: View): Frame => {
      const { L, scroll } = V;
      return {
        grids: L.list ? [] : [{ L, m: 1, tx: 0, ty: -scroll, alpha: 1 }],
        labels: labelsOf(L, 1, 0, -scroll, 1, true),
        rows: L.list ? rowsOf(V) : [],
        listAlpha: L.list ? 1 : 0,
        live: true,
      };
    },
    [labelsOf, rowsOf],
  );

  const stepFrame = useCallback(
    (step: Step): Frame => {
      const { A, B, anchor, p, kind } = step;
      const s = st.current;
      const t = s.tokens!;
      const h = viewH();
      const lv = live.current.levels;
      if (!anchor) {
        // Nothing to anchor on (empty results): plain cross-fade.
        const a = settledFrame(A);
        const b = settledFrame(B);
        a.grids.forEach((g) => (g.alpha = 1 - p));
        b.grids.forEach((g) => (g.alpha = p));
        return { grids: [...a.grids, ...b.grids], labels: p < 0.5 ? a.labels : b.labels, rows: b.rows, listAlpha: p, live: false };
      }
      const [sec, ka] = anchor;
      const [xa, ya] = A.L.pos(sec, ka);
      const [xb, yb] = B.L.pos(sec, ka);
      const qa: [number, number] = [xa, ya - A.scroll];
      const qb: [number, number] = [xb, yb - B.scroll];

      if (kind === "grid") {
        // 1) Camera zoom of the old grid until its faces match the new size and sit on the new grid's cells.
        const c = easeInOut(clamp01(p / CAMERA_END));
        const size = Math.exp(lerp(Math.log(A.L.tile), Math.log(B.L.tile), c));
        const m = size / A.L.tile;
        const tx = lerp(qa[0], qb[0], c) - xa * m;
        const ty = lerp(qa[1], qb[1], c) - ya * m;
        // 2) The new grid fades in over it, cell for cell; the old one leaves once the new one is mostly in.
        const f = easeInOut(clamp01((p - CAMERA_END) / (1 - CAMERA_END)));
        const grids: GridLayer[] = [{ L: A.L, m, tx, ty, alpha: 1 - clamp01((f - 0.5) / 0.5) }];
        if (f > 0) grids.push({ L: B.L, m: 1, tx: 0, ty: -B.scroll, alpha: f });
        return {
          grids,
          labels: [...labelsOf(A.L, m, tx, ty, 1 - f, false), ...labelsOf(B.L, 1, 0, -B.scroll, f, false)],
          rows: [],
          listAlpha: 0,
          live: false,
        };
      }

      if (kind === "mixed") {
        const others = 1 - easeInOut(clamp01(p / OTHERS_GONE));
        const c = easeInOut(clamp01((p - COLUMN_FROM) / (COLUMN_ARRIVED - COLUMN_FROM)));
        const listAlpha = easeInOut(clamp01((p - LIST_FROM) / (1 - LIST_FROM)));
        const G = A.L;
        const col = ka % G.cols;
        const count = G.counts[sec];
        const size = Math.exp(lerp(Math.log(G.tile), Math.log(B.L.tile), c));
        const ratio = radiusRatio(size, s.width, lv, t);
        const tiles: Tile[] = [];
        // Every other visible face fades out where it is.
        if (others > 0) {
          live.current.sections.forEach((x, i) => {
            const [k0, k1] = G.range(i, A.scroll - G.tile, A.scroll + h);
            for (let k = k0; k < k1; k++) {
              if (i === sec && k % G.cols === col) continue;
              const [gx, gy] = G.pos(i, k);
              tiles.push({ x: gx, y: gy - A.scroll, face: x.items[k].face, tone: x.items[k].tone, alpha: others });
            }
          });
        }
        // The anchor's column slides to the list's photo column, spreading to one face per row.
        const r0 = -Math.ceil(Math.max(qa[1] / G.pitchY, qb[1] / B.L.pitchY)) - 1;
        const r1 = Math.ceil(Math.max((h - qa[1]) / G.pitchY, (h - qb[1]) / B.L.pitchY)) + 1;
        for (let r = r0; r <= r1; r++) {
          const k = ka + r * G.cols;
          if (k < 0 || k >= count) continue;
          const [gx, gy] = G.pos(sec, k);
          const x = lerp(gx, qb[0], c);
          const y = lerp(gy - A.scroll, qb[1] + r * B.L.pitchY, c);
          if (y > h || y + size < 0) continue;
          const b = live.current.sections[sec].items[k];
          tiles.push({ x, y, face: b.face, tone: b.tone, s: size, ratio });
        }
        return {
          grids: [{ L: G, m: 1, tx: 0, ty: -A.scroll, alpha: 1, tiles }],
          labels: [...labelsOf(G, 1, 0, -A.scroll, others, false), ...labelsOf(B.L, 1, 0, -B.scroll, listAlpha, false)],
          rows: rowsOf(B),
          listAlpha,
          live: false,
        };
      }

      // list to list: rows resize in place around the anchor row.
      const e = easeInOut(p);
      const rows: Row[] = [];
      const seen = new Set<number>();
      const photo = Math.exp(lerp(Math.log(A.L.tile), Math.log(B.L.tile), e));
      const add = (i: number, k: number) => {
        const b = live.current.sections[i].items[k];
        if (seen.has(b.id)) return;
        seen.add(b.id);
        const y = lerp(A.L.box(i, k)[1] - A.scroll, B.L.box(i, k)[1] - B.scroll, e);
        rows.push({ b, x: B.L.left, y, w: B.L.rowW, h: lerp(A.L.pitchY, B.L.pitchY, e), photo, ratio: lerp(A.L.ratio, B.L.ratio, e), full: e });
      };
      live.current.sections.forEach((_, i) => {
        const [a0, a1] = A.L.range(i, A.scroll - A.L.pitchY, A.scroll + h);
        const [b0, b1] = B.L.range(i, B.scroll - B.L.pitchY, B.scroll + h);
        for (let k = a0; k < a1; k++) add(i, k);
        for (let k = b0; k < b1; k++) add(i, k);
      });
      const labels = live.current.sections.flatMap((x, i) => {
        const y = lerp(A.L.tops[i] - A.scroll, B.L.tops[i] - B.scroll, e);
        if (y > h || y < -t.headerH) return [];
        return [{ x: B.L.labelX, y, title: x.label, detail: `${x.items.length.toLocaleString("en-IN")} borrowers`, band: false, alpha: 1 }];
      });
      return { grids: [], labels, rows, listAlpha: 1, live: false };
    },
    [labelsOf, rowsOf, settledFrame],
  );

  const draw = useCallback((frame: Frame) => {
    const s = st.current;
    const el = scrollRef.current;
    const faces = facesRef.current;
    const labels = labelsRef.current;
    const t = s.tokens;
    if (!el || !faces || !labels || !t) return;
    const w = s.width;
    const h = el.clientHeight;
    const dpr = s.dpr;
    const lv = live.current.levels;

    const ctx = faces.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, faces.width, faces.height);
    frame.grids.forEach((g, li) => {
      if (g.alpha <= 0) return;
      const size = g.L.tile * g.m;
      let tiles = g.tiles;
      if (!tiles) {
        tiles = [];
        const top = -g.ty / g.m - g.L.tile;
        const bottom = (h - g.ty) / g.m;
        live.current.sections.forEach((sec, i) => {
          const [k0, k1] = g.L.range(i, top, bottom);
          for (let k = k0; k < k1; k++) {
            const [x, y] = g.L.pos(i, k);
            const sx = g.m * x + g.tx;
            if (sx > w || sx + size < 0) continue;
            tiles!.push({ x: sx, y: g.m * y + g.ty, face: sec.items[k].face, tone: sec.items[k].tone });
          }
        });
      }
      // Faces go to an offscreen canvas so the rounded mask only touches this layer.
      const off = s.off[li];
      const octx = off.getContext("2d")!;
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.clearRect(0, 0, off.width, off.height);
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFaces(octx, tiles, size, radiusRatio(size, w, lv, t), t, dpr);
      ctx.globalAlpha = g.alpha;
      ctx.drawImage(off, 0, 0);
      ctx.globalAlpha = 1;
    });
    if (frame.live && s.hover && s.view && !s.view.L.list) {
      const L = s.view.L;
      const [x, y] = L.pos(s.hover[0], s.hover[1]);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      strokeTile(ctx, x, y - s.view.scroll, L.tile, L.ratio, t.accent);
    }

    const lctx = labels.getContext("2d")!;
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.clearRect(0, 0, labels.width, labels.height);
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const l of frame.labels) drawLabel(lctx, t, l.x, l.y, w, l.title, l.detail, l.band, l.alpha, true);

    setList({ rows: frame.rows, alpha: frame.listAlpha, live: frame.live, shift: el.scrollTop });
  }, []);

  const paintSettled = useCallback(() => {
    const s = st.current;
    if (s.step || !s.view) return;
    s.view.scroll = scrollRef.current!.scrollTop;
    draw(settledFrame(s.view));
  }, [draw, settledFrame]);

  /** Shows view V as the resting state of `level`. */
  const settle = useCallback(
    (level: number, V: View) => {
      const s = st.current;
      const el = scrollRef.current!;
      s.settled = level;
      s.view = V;
      s.step = null;
      s.hover = null;
      spacerRef.current!.style.height = `${Math.max(0, V.L.height - el.clientHeight)}px`;
      el.scrollTop = V.scroll;
      V.scroll = el.scrollTop;
      el.style.overflowY = "";
      draw(settledFrame(V));
    },
    [draw, settledFrame],
  );

  /** Starts the next step from the settled level toward the target. */
  const begin = useCallback(() => {
    const s = st.current;
    const el = scrollRef.current!;
    if (s.step || !s.view || s.target === s.settled) return false;
    const from = s.settled;
    const to = from + Math.sign(s.target - from);
    s.view.scroll = el.scrollTop;
    const { B, anchor } = link(s.view, to);
    const lv = live.current.levels;
    const up = to > from;
    const lo = up ? s.view : B;
    const hi = up ? B : s.view;
    const loList = lv[Math.min(from, to)].kind === "list";
    const hiList = lv[Math.max(from, to)].kind === "list";
    const kind: Kind = loList && hiList ? "list" : !loList && !hiList ? "grid" : "mixed";
    s.step = { lo: Math.min(from, to), hi: Math.max(from, to), A: lo, B: hi, anchor, p: up ? 0 : 1, d: up ? 1 : -1, kind };
    s.hover = null;
    el.style.overflowY = "hidden";
    return true;
  }, [link]);

  const tick = useCallback(
    (now: number) => {
      const s = st.current;
      const dt = Math.min(now - s.last, 50);
      s.last = now;
      const step = s.step;
      if (!step) {
        s.raf = 0;
        return;
      }
      // Turn around if the target moved behind us.
      if (step.d > 0 && s.target <= step.lo) step.d = -1;
      else if (step.d < 0 && s.target >= step.hi) step.d = 1;
      const queued = Math.abs(s.target - (step.d > 0 ? step.lo : step.hi)) > 1;
      step.p += (step.d * dt) / (STEP_MS[step.kind] * (queued ? QUEUED_SPEED : 1));
      if (step.p >= 1 || step.p <= 0) {
        const done = step.p >= 1;
        settle(done ? step.hi : step.lo, done ? step.B : step.A);
        if (!begin()) {
          s.point = null;
          s.raf = 0;
          return;
        }
      } else {
        draw(stepFrame(step));
      }
      s.raf = requestAnimationFrame(tick);
    },
    [begin, draw, settle, stepFrame],
  );

  const kick = useCallback(() => {
    const s = st.current;
    if (!s.step) begin();
    if (s.step && !s.raf) {
      s.last = performance.now();
      s.raf = requestAnimationFrame(tick);
    }
  }, [begin, tick]);

  /** Resets to a level with a fresh layout (no animation). */
  const reset = useCallback(
    (level: number, scroll: number) => {
      const s = st.current;
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.step = null;
      s.point = null;
      const L = layoutFor(level);
      settle(level, { L, scroll: Math.min(Math.max(scroll, 0), maxScroll(L)) });
    },
    [layoutFor, settle],
  );

  // Tokens, canvases, atlases and resize.
  useLayoutEffect(() => {
    const s = st.current;
    s.tokens = readTokens();
    s.off = [document.createElement("canvas"), document.createElement("canvas")];
    const el = scrollRef.current!;
    const resize = () => {
      s.dpr = window.devicePixelRatio || 1;
      s.width = el.clientWidth;
      for (const c of [facesRef.current!, labelsRef.current!, ...s.off]) {
        c.width = Math.round(el.clientWidth * s.dpr);
        c.height = Math.round(el.clientHeight * s.dpr);
      }
    };
    resize();
    let lastSize = `${el.clientWidth}x${el.clientHeight}`;
    const ro = new ResizeObserver(() => {
      const size = `${el.clientWidth}x${el.clientHeight}`;
      if (size === lastSize) return;
      lastSize = size;
      const frac = el.scrollTop / Math.max(1, el.scrollHeight);
      s.tokens = readTokens();
      resize();
      const level = s.step ? s.target : s.settled;
      reset(level, frac * layoutFor(level).height);
    });
    ro.observe(el);
    loadAtlases().then(paintSettled);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [layoutFor, reset, paintSettled]);

  // New grouping, search results or level set: start from the top at the current target.
  useLayoutEffect(() => {
    const s = st.current;
    s.target = Math.min(s.target, levels.length - 1);
    reset(s.target, 0);
  }, [sections, levels, reset]);

  // Dock height changed: same place, new bottom padding (wait for a running step to finish).
  const padRef = useRef(padBottom);
  useEffect(() => {
    if (padRef.current === padBottom) return;
    padRef.current = padBottom;
    const s = st.current;
    if (!s.step) reset(s.settled, scrollRef.current?.scrollTop ?? 0);
  }, [padBottom, reset]);

  // Jump straight to a section (hero pills) or to a borrower, highlighted (Surprise me).
  useLayoutEffect(() => {
    if (!focus) return;
    st.current.target = zoom;
    const L = layoutFor(zoom);
    let scroll = 0;
    sections.forEach((sec, i) => {
      if ("section" in focus) {
        if (sec.key === focus.section) scroll = L.tops[i];
        return;
      }
      const k = sec.items.findIndex((b) => b.id === focus.id);
      if (k >= 0) scroll = L.pos(i, k)[1] - (viewH() - L.tile) / 2;
    });
    reset(zoom, scroll);
    if ("section" in focus) return;
    setFlashId(focus.id);
    const timer = setTimeout(() => setFlashId(null), 2400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on a new focus request
  }, [focus?.nonce]);

  // Target changed (slider, buttons, gesture): step toward it.
  useEffect(() => {
    st.current.target = Math.min(Math.max(zoom, 0), levels.length - 1);
    kick();
  }, [zoom, levels, kick]);

  /** Zoom request from the gallery itself (tap, keys, pinch, ctrl+wheel), anchored at a point. */
  const request = useCallback((delta: number, point?: [number, number]) => {
    const s = st.current;
    const next = Math.min(Math.max(s.target + delta, 0), live.current.levels.length - 1);
    if (next === s.target) return;
    if (point && !s.step) s.point = point;
    s.target = next;
    live.current.onZoomChange(next);
  }, []);

  // ctrl+wheel and trackpad pinch (non-passive, to stop the browser zooming the page).
  useEffect(() => {
    const el = scrollRef.current!;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) {
        // At the top or bottom of the gallery, hand the wheel straight to the page. Browsers otherwise
        // keep the rest of the gesture locked to this box, so the page only moved after a pause.
        const max = el.scrollHeight - el.clientHeight;
        const atTop = el.scrollTop <= 0 && e.deltaY < 0;
        const atBottom = el.scrollTop >= max - 1 && e.deltaY > 0;
        if (atTop || atBottom || st.current.step) {
          e.preventDefault();
          const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
          window.scrollBy({ top: e.deltaY * unit, behavior: "instant" });
        }
        return;
      }
      e.preventDefault();
      const s = st.current;
      s.wheel += e.deltaY;
      if (Math.abs(s.wheel) < WHEEL_STEP) return;
      const rect = el.getBoundingClientRect();
      request(s.wheel < 0 ? 1 : -1, [e.clientX - rect.left, e.clientY - rect.top]);
      s.wheel = 0;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [request]);

  function local(e: ReactPointerEvent): [number, number] {
    const rect = scrollRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  function onPointerDown(e: ReactPointerEvent) {
    const s = st.current;
    const p = local(e);
    if (e.pointerType === "touch") {
      s.touches.set(e.pointerId, p);
      if (s.touches.size === 2) {
        const [a, b] = [...s.touches.values()];
        s.pinch = Math.hypot(a[0] - b[0], a[1] - b[1]);
        s.down = null;
        return;
      }
    }
    s.down = { x: p[0], y: p[1], moved: false };
  }

  function onPointerMove(e: ReactPointerEvent) {
    const s = st.current;
    const p = local(e);
    if (s.down && Math.hypot(p[0] - s.down.x, p[1] - s.down.y) > TAP_SLOP) s.down.moved = true;
    if (e.pointerType === "touch" && s.touches.has(e.pointerId)) {
      s.touches.set(e.pointerId, p);
      if (s.touches.size === 2 && s.pinch) {
        const [a, b] = [...s.touches.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (d / s.pinch > PINCH_STEP) request(1, mid);
        else if (s.pinch / d > PINCH_STEP) request(-1, mid);
        else return;
        s.pinch = d;
      }
      return;
    }
    // Hover ring (mouse only, resting grid levels only).
    if (s.step || !s.view || s.view.L.list) return;
    const hit = s.view.L.hit(p[0], p[1] + scrollRef.current!.scrollTop);
    if (hit?.[0] !== s.hover?.[0] || hit?.[1] !== s.hover?.[1]) {
      s.hover = hit;
      scrollRef.current!.style.cursor = hit ? "zoom-in" : "";
      paintSettled();
    }
  }

  function onPointerUp(e: ReactPointerEvent) {
    const s = st.current;
    s.touches.delete(e.pointerId);
    if (s.touches.size < 2) s.pinch = 0;
    const down = s.down;
    s.down = null;
    if (!down || down.moved || s.step || !s.view || s.view.L.list) return;
    const p = local(e);
    if (s.view.L.hit(p[0], p[1] + scrollRef.current!.scrollTop)) request(1, p);
  }

  function onPointerLeave() {
    const s = st.current;
    s.touches.clear();
    s.pinch = 0;
    if (s.hover) {
      s.hover = null;
      paintSettled();
    }
  }

  return (
    <div
      ref={scrollRef}
      tabIndex={0}
      aria-label="Borrower gallery. Use plus and minus keys to zoom."
      onScroll={paintSettled}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerLeave}
      onPointerLeave={onPointerLeave}
      onKeyDown={(e) => {
        if (e.key === "+" || e.key === "=") request(1);
        if (e.key === "-" || e.key === "_") request(-1);
      }}
      className="relative touch-pan-y overflow-y-auto overflow-x-hidden bg-white-100 outline-none"
      // Reserve the scrollbar's space from the start so the measured width never changes under the layout.
      style={{ height, scrollbarGutter: "stable" }}
    >
      {/* Layers, bottom to top: faces canvas, list rows (DOM), labels canvas. Canvases let pointers through. */}
      <canvas ref={facesRef} className="pointer-events-none sticky top-zero z-0 block w-full" style={{ height }} />
      <canvas
        ref={labelsRef}
        className="pointer-events-none sticky top-zero z-20 block w-full"
        style={{ height, marginTop: -height }}
      />
      <div ref={spacerRef} />
      {list.rows.length > 0 && (
        <div
          className={cn("absolute inset-x-zero top-zero z-10", !list.live && "pointer-events-none")}
          style={{ transform: `translateY(${list.shift}px)`, opacity: list.alpha }}
        >
          {list.rows.map((row) => (
            <ListRow key={row.b.id} row={row} flash={flashId === row.b.id} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

function ListRow({ row, flash, onOpen }: { row: Row; flash: boolean; onOpen: (b: Borrower) => void }) {
  const { b } = row;
  return (
    <button
      type="button"
      onClick={() => onOpen(b)}
      className={cn(
        "absolute flex items-center gap-r4 border-b border-text-grey-16 px-r4 text-left transition-colors hover:bg-text-grey-4",
        flash && "bg-primary-8 hover:bg-primary-8",
      )}
      style={{ left: row.x, top: row.y, width: row.w, height: row.h }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized square crop */}
      <img
        src={faceUrl(b.face)}
        alt=""
        decoding="async"
        className="shrink-0 bg-neutral-6 object-cover"
        style={{ width: row.photo, height: row.photo, borderRadius: `${row.ratio * 100}%` }}
      />
      <span className="relative h-full min-w-0 flex-1">
        {row.full < 1 && <RowText b={b} compact style={{ opacity: 1 - row.full }} />}
        {row.full > 0 && <RowText b={b} compact={false} style={{ opacity: row.full }} />}
      </span>
    </button>
  );
}

function RowText({ b, compact, style }: { b: Borrower; compact: boolean; style: React.CSSProperties }) {
  const small = compact ? "text-p4" : "text-p3";
  return (
    <span className={cn("absolute inset-zero flex flex-col justify-center", compact ? "gap-f1" : "gap-2")} style={style}>
      <span className={cn("truncate font-bold text-text-grey-100", compact ? "text-p3" : "text-p1")}>{b.name}</span>
      <span className={cn("truncate font-medium text-text-grey-64", small)}>
        {b.village}, {b.state} · {b.livelihood}
      </span>
      <span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-f1">
        <span className={cn("flex items-center gap-2 font-bold", small, OUTCOME_TEXT[b.outcome])}>
          <span className={cn("rounded-full", compact ? "size-2" : "size-3", OUTCOME_DOT[b.outcome])} />
          {OUTCOME_LABEL[b.outcome]}
        </span>
        <span className={cn("font-bold text-text-grey-100 max-md:hidden", small)}>
          {formatRupees(b.amount)} for {b.purpose}
        </span>
      </span>
    </span>
  );
}
