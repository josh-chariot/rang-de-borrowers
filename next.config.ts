import type { NextConfig } from "next";

// EXPORT=1 builds a static copy into `.next-export/` (used by scripts/export-single-html.mjs) without touching
// the `.next` folder the dev server uses.
const exporting = process.env.EXPORT === "1";

const nextConfig: NextConfig = exporting ? { output: "export", distDir: ".next-export" } : {};

export default nextConfig;
