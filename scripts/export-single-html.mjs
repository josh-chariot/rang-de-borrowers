/**
 * Packs the /borrowers page into one self-contained HTML file: rang-de-borrowers.html.
 * Run:  node scripts/export-single-html.mjs
 *
 * Steps: static export (EXPORT=1 next build -> .next-export/), then inline every script and stylesheet, and
 * embed every asset in public/ as a data URI. A small loader at the top of the page serves those
 * assets to fetch(), <img> and CSS backgrounds, so the file works when opened directly (file://).
 * Google Fonts (Inter) still load from the web.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// With a custom distDir, Next writes the static export into that folder.
const OUT = ".next-export";
const TARGET = "rang-de-borrowers.html";

execSync("npx next build", { stdio: "inherit", shell: true, env: { ...process.env, EXPORT: "1" } });

const MIME = { ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".json": "application/json" };

/** Every file under public/ as { "/path": dataURI }. */
const assets = {};
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else {
      const type = MIME[path.extname(name).toLowerCase()];
      if (!type) continue;
      // Skip the original borrower photos; the page only uses the generated crops.
      const rel = "/" + path.relative("public", full).split(path.sep).join("/");
      if (/^\/borrowers\/[^/]+\.webp$/i.test(rel)) continue;
      assets[rel] = `data:${type};base64,${fs.readFileSync(full).toString("base64")}`;
    }
  }
};
walk("public");

let html = fs.readFileSync(path.join(OUT, "borrowers.html"), "utf8");
const read = (url) => fs.readFileSync(path.join(OUT, url.split("?")[0]), "utf8");
const safe = (js) => js.replace(/<\/script/gi, "<\\/script");

// Stylesheets: inlined, and also embedded so React's re-inserted <link> resolves without a server.
html = html.replace(/<link[^>]+href="(\/_next\/[^"]+\.css)"[^>]*>/g, (_, href) => {
  assets[href] = `data:text/css;base64,${Buffer.from(read(href)).toString("base64")}`;
  return `<style>${read(href)}</style>`;
});
// Drop preloads; scripts are inlined below.
html = html.replace(/<link[^>]+rel="preload"[^>]*>/g, "");
// Every JS chunk, inlined up front so dynamic imports find their chunks already registered.
const chunkDir = path.join(OUT, "_next/static/chunks");
const allChunks = [];
const walkJs = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walkJs(full);
    else if (name.endsWith(".js")) allChunks.push("/" + path.relative(OUT, full).split(path.sep).join("/"));
  }
};
walkJs(chunkDir);
// Leave out the pages-router runtime (this is an app-router page) and the legacy polyfills.
const unused = /\/chunks\/(pages\/|main-(?!app)|framework-|polyfills-)/;
for (let i = allChunks.length - 1; i >= 0; i--) if (unused.test(allChunks[i])) allChunks.splice(i, 1);
const referenced = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);
html = html.replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/g, "");
const runtime = referenced.filter((s) => /webpack/.test(s));
const ordered = [...allChunks.filter((s) => !referenced.includes(s)), ...referenced.filter((s) => !runtime.includes(s)), ...runtime];
const inlineScripts = ordered.map((src) => `<script>${safe(read(src))}</script>`).join("\n");

// Static asset references in the markup.
for (const [p, uri] of Object.entries(assets)) html = html.split(`"${p}"`).join(`"${uri}"`);

const loader = `<script>
(() => {
  const A = ${JSON.stringify(assets)};
  const map = (u) => { if (typeof u !== "string") return u; const k = u.replace(/^https?:\\/\\/[^/]+/, "").split("?")[0]; return A[k] || u; };
  const f = window.fetch;
  window.fetch = (u, o) => { const m = map(typeof u === "string" ? u : u && u.url); return f(m && m.startsWith("data:") ? m : u, o); };
  const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  Object.defineProperty(HTMLImageElement.prototype, "src", { get() { return src.get.call(this); }, set(v) { src.set.call(this, map(v)); } });
  const setAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (n, v) { return setAttr.call(this, n, n === "src" || n === "href" ? map(v) : v); };
  const fixCss = (v) => typeof v === "string" ? v.replace(/url\\(([^)]+)\\)/g, (m, u) => "url(" + map(u.replace(/["']/g, "")) + ")") : v;
  // Backgrounds in the markup (hero mosaics) are repointed once, at one embedded copy of the atlas.
  document.addEventListener("DOMContentLoaded", () => {
    for (const el of document.querySelectorAll('[style*="url("]')) {
      el.style.setProperty("background-image", fixCss(el.style.getPropertyValue("background-image")));
    }
  });
})();
</script>`;

// Function replacers: the minified code contains "$'"-style sequences that string replacements would expand.
html = html.replace("<head>", () => `<head>${loader}`).replace("</body>", () => `${inlineScripts}</body>`);
fs.writeFileSync(TARGET, html);
console.log(`Wrote ${TARGET} (${(fs.statSync(TARGET).size / 1024 / 1024).toFixed(1)} MB)`);
