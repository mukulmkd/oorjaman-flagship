#!/usr/bin/env node
/**
 * Rasterize the sunburst SVG only.
 * Logo icons and lockups come from brand/source via `npm run brand:sync`.
 *
 * Run: node scripts/generate-brand-assets.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "..");
const svgDir = join(appRoot, "assets/brand/svg");
const brandDir = join(appRoot, "assets/brand");

mkdirSync(brandDir, { recursive: true });

function renderSvg(svgPath, width, height, fitToHeight = false) {
  const svg = readFileSync(svgPath, "utf8");
  const resvg = new Resvg(svg, {
    fitTo: fitToHeight
      ? { mode: "height", value: height }
      : { mode: "width", value: width },
    background: "transparent",
  });
  return resvg.render().asPng();
}

function writePng(outPath, png) {
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath}`);
}

const sunburstPng = renderSvg(join(svgDir, "sunburst.svg"), 512, 512, true);
writePng(join(brandDir, "sunburst.png"), sunburstPng);

const sharedBrandDir = join(appRoot, "../../packages/ui/assets/brand");
mkdirSync(sharedBrandDir, { recursive: true });
writePng(join(sharedBrandDir, "sunburst.png"), sunburstPng);
