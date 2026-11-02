/**
 * Canvas engine for the borrower gallery: zoom levels, layout, face drawing, easing.
 * Every colour, size and font is read from styles/tokens.css at runtime.
 */

import { ATLAS_COLS, ATLAS_SIZES, FACE_COUNT, FACE_DIR } from "./faces";

/** A zoom level: a grid of faces, or a single column of borrower rows (photo + details). */
export type LevelDef = { kind: "grid"; cols: number } | { kind: "list"; compact: boolean };

const grid = (cols: number): LevelDef => ({ kind: "grid", cols });
const COMPACT_LIST: LevelDef = { kind: "list", compact: true };
const FULL_LIST: LevelDef = { kind: "list", compact: false };

/** Five zoom levels, most zoomed out first. */
export const DESKTOP_LEVELS: LevelDef[] = [grid(96), grid(56), grid(32), COMPACT_LIST, FULL_LIST];
export const MOBILE_LEVELS: LevelDef[] = [grid(32), grid(20), grid(12), COMPACT_LIST, FULL_LIST];
/** Level the directory opens at: faces are recognisable (32 a row on desktop, 12 on mobile). */
export const DEFAULT_LEVEL = 2;
export const MOBILE_BREAKPOINT = 768;
/** The intro starts denser than the directory's most zoomed-out level. */
export const INTRO_COLS = { desktop: 160, mobile: 48 };

/**
 * Canvas resolution: the screen's pixel density, capped at 2. 3x phone screens otherwise cost 2.25x the
 * drawing work for no visible gain at these face sizes.
 */
export function canvasDpr() {
  return Math.min(window.devicePixelRatio || 1, 2);
}

export function levelsFor(width: number) {
  return width < MOBILE_BREAKPOINT ? MOBILE_LEVELS : DESKTOP_LEVELS;
}

export type Tokens = {
  tones: string[];
  accent: string;
  text: string;
  textMuted: string;
  labelBg: string;
  labelFont: string;
  labelMutedFont: string;
  padX: number;
  headerH: number;
  gapRatio: number;
  radiusMin: number;
  radiusMax: number;
  listPhoto: number;
  listPhotoCompact: number;
  listGap: number;
  listMaxWidth: number;
};

export function readTokens(el: Element = document.documentElement): Tokens {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const px = (name: string) => parseFloat(v(name));
  const font = (weight: string) => `${v(weight)} ${v("--font-size-p3")} ${v("--font-family-base")}`;
  return {
    tones: [v("--color-neutral-6"), v("--color-text-grey-24"), v("--color-text-grey-16")],
    accent: v("--color-primary-100"),
    text: v("--color-text-grey-100"),
    textMuted: v("--color-text-grey-64"),
    labelBg: v("--color-white-80"),
    labelFont: font("--font-weight-bold"),
    labelMutedFont: font("--font-weight-medium"),
    padX: px("--space-2"),
    headerH: px("--space-8"),
    gapRatio: parseFloat(v("--gallery-gap-ratio")),
    radiusMin: parseFloat(v("--gallery-radius-min")) / 100,
    radiusMax: parseFloat(v("--gallery-radius-max")) / 100,
    listPhoto: px("--space-responsive-9"),
    listPhotoCompact: px("--space-9"),
    listGap: px("--space-responsive-4"),
    listMaxWidth: px("--container-list"),
  };
}

/** Tile edge for `cols` columns across `width`, with gaps that scale with the tile. */
export function tileSize(width: number, cols: number, t: Tokens) {
  return (width - 2 * t.padX) / (cols + (cols - 1) * t.gapRatio);
}

/**
 * Corner radius share for a face of size `s`: radiusMin at the most zoomed-out tile,
 * radiusMax at the full list photo, interpolated on a log scale in between.
 */
export function radiusRatio(s: number, width: number, levels: LevelDef[], t: Tokens) {
  const first = levels[0];
  const sMin = Math.log(first.kind === "grid" ? tileSize(width, first.cols, t) : t.listPhotoCompact);
  const sMax = Math.log(t.listPhoto);
  const k = Math.min(Math.max((Math.log(s) - sMin) / (sMax - sMin), 0), 1);
  return t.radiusMin + (t.radiusMax - t.radiusMin) * k;
}

export class Layout {
  readonly list: boolean;
  readonly compact: boolean;
  readonly cols: number;
  readonly tile: number;
  readonly pitchX: number;
  readonly pitchY: number;
  /** Left edge of the first column (grid: first tile; list: first row box). */
  readonly left: number;
  /** List only: width of a row box. */
  readonly rowW: number;
  readonly ratio: number;
  readonly tops: number[] = [];
  readonly starts: number[] = [];
  readonly height: number;

  constructor(
    readonly counts: number[],
    readonly width: number,
    def: LevelDef,
    levels: LevelDef[],
    readonly t: Tokens,
    padBottom: number,
  ) {
    this.list = def.kind === "list";
    this.compact = def.kind === "list" && def.compact;
    this.cols = def.kind === "list" ? 1 : def.cols;
    if (def.kind === "list") {
      // One column of rows, edge to edge up to max-w-list, centred.
      this.left = Math.max(0, (width - t.listMaxWidth) / 2);
      this.rowW = Math.min(width, t.listMaxWidth);
      this.pitchX = this.rowW;
      this.tile = def.compact ? t.listPhotoCompact : t.listPhoto;
      this.pitchY = this.tile + 2 * t.listGap;
    } else {
      this.tile = tileSize(width, def.cols, t);
      this.pitchX = this.tile * (1 + t.gapRatio);
      this.pitchY = this.pitchX;
      this.left = t.padX;
      this.rowW = this.tile;
    }
    this.ratio = radiusRatio(this.tile, width, levels, t);
    let y = 0;
    for (const n of counts) {
      this.tops.push(y);
      y += t.headerH;
      this.starts.push(y);
      y += Math.ceil(n / this.cols) * this.pitchY + (this.list ? 0 : t.padX);
    }
    this.height = y + padBottom;
  }

  /** Label x position. */
  get labelX() {
    return this.list ? this.left + this.t.listGap : this.left;
  }

  /** Row box of item k (list), or the tile itself (grid), in content coordinates. */
  box(s: number, k: number): [number, number] {
    const row = Math.floor(k / this.cols);
    return [this.left + (k % this.cols) * this.pitchX, this.starts[s] + row * this.pitchY];
  }

  /** Top-left of the face of item k in section s, in content coordinates. */
  pos(s: number, k: number): [number, number] {
    const [x, y] = this.box(s, k);
    return this.list ? [x + this.t.listGap, y + this.t.listGap] : [x, y];
  }

  /** Column under content x. */
  colAt(x: number) {
    return Math.min(Math.max(Math.floor((x - this.left) / this.pitchX), 0), this.cols - 1);
  }

  /** Visible item range [from, to) of section s between content y top and bottom. */
  range(s: number, top: number, bottom: number): [number, number] {
    const start = this.starts[s];
    const r0 = Math.max(0, Math.floor((top - start) / this.pitchY));
    const r1 = Math.ceil((bottom - start) / this.pitchY);
    return [Math.min(r0 * this.cols, this.counts[s]), Math.min(Math.max(r1, 0) * this.cols, this.counts[s])];
  }

  /** Section at content y. */
  sectionAt(y: number) {
    let s = 0;
    while (s + 1 < this.tops.length && this.tops[s + 1] <= y) s++;
    return s;
  }

  /** Face at content point (x, y), or the nearest item when `nearest` is set. */
  hit(x: number, y: number, nearest = false): [number, number] | null {
    if (!this.counts.length) return null;
    const s = this.sectionAt(y);
    if (!this.counts[s]) return null;
    const row = Math.floor((y - this.starts[s]) / this.pitchY);
    const col = Math.floor((x - this.left) / this.pitchX);
    if (!nearest && (row < 0 || col < 0 || col >= this.cols)) return null;
    const k = Math.max(0, row) * this.cols + Math.min(Math.max(col, 0), this.cols - 1);
    if (k >= this.counts[s]) return nearest ? [s, this.counts[s] - 1] : null;
    if (!nearest) {
      const [tx, ty] = this.pos(s, k);
      if (x < tx || x > tx + this.tile || y < ty || y > ty + this.tile) return null;
    }
    return [s, k];
  }
}

/** Face atlases (all photos packed in a grid), loaded once and shared by the intro and gallery. */
export type Atlas = { size: number; image: ImageBitmap | HTMLImageElement };
let atlasPromise: Promise<Atlas[]> | null = null;
let atlasCache: Atlas[] = [];

export function loadAtlases(): Promise<Atlas[]> {
  atlasPromise ??= Promise.all(
    ATLAS_SIZES.map(
      (size) =>
        new Promise<Atlas>((resolve, reject) => {
          const img = new Image();
          img.decoding = "async";
          img.onload = () => resolve({ size, image: img });
          img.onerror = reject;
          img.src = `${FACE_DIR}/atlas-${size}.webp`;
        }),
    ),
  ).then((list) => (atlasCache = list));
  return atlasPromise;
}

export function loadedAtlases() {
  return atlasCache;
}

/** URL of a single face, for DOM images (list rows, cards). */
export function faceUrl(face: number) {
  return `${FACE_DIR}/256/${face}.webp`;
}

/** CSS background that shows one face cropped from the large atlas (one request for many faces). */
export function faceBackground(face: number) {
  const rows = Math.ceil(FACE_COUNT / ATLAS_COLS);
  const col = face % ATLAS_COLS;
  const row = Math.floor(face / ATLAS_COLS);
  return {
    backgroundImage: `url(${FACE_DIR}/atlas-${ATLAS_SIZES[ATLAS_SIZES.length - 1]}.webp)`,
    backgroundSize: `${ATLAS_COLS * 100}% ${rows * 100}%`,
    backgroundPosition: `${(col / (ATLAS_COLS - 1)) * 100}% ${(row / (rows - 1)) * 100}%`,
  };
}

/** A face to draw. `s` and `ratio` override the frame-wide size and corner ratio for this face. */
export type Tile = { x: number; y: number; face: number; tone: number; alpha?: number; s?: number; ratio?: number };

/**
 * Draws faces with rounded corners: photos (or the grey tone until the atlas loads),
 * then one destination-in mask of all rounded rects. Draw into a dedicated (offscreen) canvas.
 */
export function drawFaces(
  ctx: CanvasRenderingContext2D,
  tiles: Tile[],
  size: number,
  ratio: number,
  t: Tokens,
  dpr: number,
) {
  if (!tiles.length) return;
  const atlases = loadedAtlases();
  const pick = (s: number) => atlases.find((a) => a.size >= s * dpr) ?? atlases[atlases.length - 1];
  const shared = pick(size);
  ctx.imageSmoothingQuality = "medium";
  for (const tile of tiles) {
    const a = tile.alpha ?? 1;
    if (a <= 0) continue;
    const s = tile.s ?? size;
    const atlas = tile.s ? pick(s) : shared;
    ctx.globalAlpha = a;
    if (atlas) {
      const sx = (tile.face % ATLAS_COLS) * atlas.size;
      const sy = Math.floor(tile.face / ATLAS_COLS) * atlas.size;
      ctx.drawImage(atlas.image, sx, sy, atlas.size, atlas.size, tile.x, tile.y, s, s);
    } else {
      ctx.fillStyle = t.tones[tile.tone];
      ctx.fillRect(tile.x, tile.y, s, s);
    }
  }
  ctx.globalAlpha = 1;
  const mask = new Path2D();
  let rounded = false;
  for (const tile of tiles) {
    const s = tile.s ?? size;
    const r = s * (tile.ratio ?? ratio);
    if (r >= 0.5) rounded = true;
    mask.roundRect(tile.x, tile.y, s, s, r);
  }
  if (!rounded) return;
  ctx.globalCompositeOperation = "destination-in";
  ctx.fill(mask);
  ctx.globalCompositeOperation = "source-over";
}

export function strokeTile(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, ratio: number, color: string) {
  const w = Math.max(1.5, size * 0.04);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - w / 2, size + w, size + w, size * ratio + w / 2);
  ctx.stroke();
}

/** Section label: bold title plus a muted count, optionally on a translucent band (pinned); `center` centres it across `width`. */
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  t: Tokens,
  x: number,
  y: number,
  width: number,
  title: string,
  detail: string,
  band: boolean,
  alpha = 1,
  center = false,
) {
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  if (band) {
    ctx.fillStyle = t.labelBg;
    ctx.fillRect(0, y, width, t.headerH);
  }
  const mid = y + t.headerH / 2;
  ctx.textBaseline = "middle";
  ctx.font = t.labelFont;
  const w = ctx.measureText(title).width;
  ctx.font = t.labelMutedFont;
  const dw = ctx.measureText(detail).width;
  const left = center ? (width - (w + t.padX + dw)) / 2 : x;
  ctx.font = t.labelFont;
  ctx.fillStyle = t.text;
  ctx.fillText(title, left, mid);
  ctx.font = t.labelMutedFont;
  ctx.fillStyle = t.textMuted;
  ctx.fillText(detail, left + w + t.padX, mid);
  ctx.globalAlpha = 1;
}

/** Cubic-bezier easing, same curve definition as CSS. */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const a = (a1: number, a2: number) => 1 - 3 * a2 + 3 * a1;
  const b = (a1: number, a2: number) => 3 * a2 - 6 * a1;
  const c = (a1: number) => 3 * a1;
  const calc = (t: number, a1: number, a2: number) => ((a(a1, a2) * t + b(a1, a2)) * t + c(a1)) * t;
  const slope = (t: number, a1: number, a2: number) => 3 * a(a1, a2) * t * t + 2 * b(a1, a2) * t + c(a1);
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const s = slope(t, x1, x2);
      if (s === 0) break;
      t -= (calc(t, x1, x2) - x) / s;
    }
    return calc(t, y1, y2);
  };
}

export const easeInOut = bezier(0.65, 0, 0.35, 1);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const k = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return k * k * (3 - 2 * k);
};
