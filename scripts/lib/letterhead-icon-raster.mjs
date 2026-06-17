import sharp from "sharp";
import { LETTERHEAD_ICON_RASTER_PX, letterheadIconSvg } from "../../packages/utils/src/brand-print/letterhead-icons.mjs";

/** @returns {Promise<{ phone: Buffer; email: Buffer; globe: Buffer }>} */
export async function rasterizeLetterheadIcons() {
  const px = LETTERHEAD_ICON_RASTER_PX;
  const kinds = /** @type {const} */ (["phone", "email", "globe"]);
  const out = /** @type {{ phone: Buffer; email: Buffer; globe: Buffer }} */ ({});
  for (const kind of kinds) {
    out[kind] = await sharp(Buffer.from(letterheadIconSvg(kind))).resize(px, px).png().toBuffer();
  }
  return out;
}
