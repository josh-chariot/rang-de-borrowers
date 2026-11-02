/**
 * Turns Lordicon "system-outline-18-location-pin-hover-pinch" (an outline pin that flips over and back)
 * into a morph-select style icon like the eye, calendar and heart: the pin fills while it flips.
 *   frames 0–60   the original flip; meanwhile (FILL_FROM–FILL_TO) the fill rises from the tip to the top
 *                 and the outline clears where the fill has reached. Filled = solid primary blue body,
 *                 the circle's line becomes a transparent ring, the centre dot stays blue
 *   frames 60–70  rests filled (MotionIcon ACTIVE_FRAME = 62)
 * The filled pin is built from the outline's own animated shapes and transform, so it flips and squashes
 * exactly like the outline.
 * Run:  node scripts/build-location-pin.mjs
 */
import fs from "node:fs";

const SRC = "../Main website/ASSETS/MOTION ICONS/system-outline-18-location-pin-hover-pinch.json";
const OUT = "public/icons/motion/location-pin-morph-select.json";
const FILL_FROM = 4;
const FILL_TO = 40;
const END = 70;

const j = JSON.parse(fs.readFileSync(SRC, "utf8"));
const comp = j.assets.find((a) => a.id === "comp_1");
const animated = comp.layers.find((l) => l.nm === "Vector");
const restOutline = comp.layers.find((l) => l.nm === "vector 2");
const clone = (x) => JSON.parse(JSON.stringify(x));

// Colour comes from the file's own primary fill (#0DAADE), so it stays in sync with the other icons.
const primary = restOutline.shapes[0].it.find((s) => s.ty === "fl").c.k;
const STROKE = 15; // outline stroke width in the source
const RING_R = 32.5; // radius of the source's circle (stroke centre)
const CENTRE = [0, -19.46]; // circle centre in the outline layer's shape space

// Animated outline geometry: the pin silhouette and the circle (both flip with the pin).
const pinKs = clone(animated.shapes[0].it[0].ks);
const circleKs = animated.shapes[0].it[1].ks;

/** The animated circle scaled about its centre (to get the ring's outer edge and the dot). */
const scaledCircle = (k) => {
  const ks = clone(circleKs);
  for (const key of ks.k) {
    if (!key.s) continue;
    for (const shape of key.s) {
      shape.v = shape.v.map(([x, y]) => [CENTRE[0] + (x - CENTRE[0]) * k, CENTRE[1] + (y - CENTRE[1]) * k]);
      shape.i = shape.i.map(([x, y]) => [x * k, y * k]);
      shape.o = shape.o.map(([x, y]) => [x * k, y * k]);
    }
  }
  return ks;
};

const tr = () => ({ ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 }, nm: "Transform" });
const fill = (rule) => ({ ty: "fl", c: { a: 0, k: primary }, o: { a: 0, k: 100 }, r: rule, bm: 0, nm: ".primary", cl: "primary" });
const easeXY = { i: { x: 0.4, y: 1 }, o: { x: 0.45, y: 0 } };

/**
 * A rectangle that sweeps up over the pin: as a track matte it reveals the fill from the bottom up
 * (alpha matte) and hides the outline in the same region (inverted alpha matte). Pin spans y ≈ 12…218.
 */
let nextInd = 20;
const sweep = () => ({
  ddd: 0,
  ind: nextInd++,
  ty: 4,
  nm: "sweep",
  td: 1,
  sr: 1,
  ks: {
    o: { a: 0, k: 100 },
    r: { a: 0, k: 0 },
    p: { a: 1, k: [{ ...easeXY, t: FILL_FROM, s: [120, 360, 0] }, { t: FILL_TO, s: [120, 130, 0] }] },
    a: { a: 0, k: [0, 0, 0] },
    s: { a: 0, k: [100, 100, 100] },
  },
  ao: 0,
  shapes: [
    {
      ty: "gr",
      nm: "rect",
      it: [{ ty: "rc", d: 1, s: { a: 0, k: [280, 280] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 0 }, nm: "rect" }, { ty: "fl", c: { a: 0, k: [1, 1, 1, 1] }, o: { a: 0, k: 100 }, r: 1, bm: 0, nm: "matte" }, tr()],
    },
  ],
  ip: 0,
  op: 300,
  st: 0,
  bm: 0,
});

// Filled pin: same transform as the animated outline (flip squash), its own shapes.
const filled = {
  ...clone(animated),
  ind: 10,
  nm: "filled",
  tt: 1,
  ip: 0,
  op: 300,
  shapes: [
    // Body with the ring cut out (even-odd: silhouette minus a circle at the ring's outer edge).
    { ty: "gr", nm: "body", it: [{ ind: 0, ty: "sh", ks: clone(pinKs), nm: "pin" }, { ind: 1, ty: "sh", ks: scaledCircle((RING_R + STROKE / 2) / RING_R), nm: "ring outer" }, fill(2), tr()] },
    // The outline's stroke width around the silhouette, so the filled pin is exactly as big as the outline.
    {
      ty: "gr",
      nm: "edge",
      it: [{ ind: 0, ty: "sh", ks: clone(pinKs), nm: "pin" }, { ty: "st", c: { a: 0, k: primary }, o: { a: 0, k: 100 }, w: { a: 0, k: STROKE }, lc: 2, lj: 2, bm: 0, nm: ".primary", cl: "primary" }, tr()],
    },
    // Centre dot, inside the ring.
    { ty: "gr", nm: "dot", it: [{ ind: 0, ty: "sh", ks: scaledCircle((RING_R - STROKE / 2) / RING_R), nm: "dot" }, fill(1), tr()] },
  ],
};

// Matte order in Lottie: the matte layer sits directly above the layer it applies to.
// Both outline layers (flipping, and at rest) show only where the fill hasn't reached yet.
for (const outline of [animated, restOutline]) {
  outline.tt = 2;
  comp.layers.splice(comp.layers.indexOf(outline), 0, sweep());
}
comp.layers.unshift(sweep(), filled);

j.op = END;
j.nm = "location-pin-morph-select";
j.layers.find((l) => l.refId === "comp_1").op = 300;
j.markers = [{ tm: 0, cm: "default:morph-select", dr: END }];

fs.writeFileSync(OUT, JSON.stringify(j));
console.log(`Wrote ${OUT}`);
