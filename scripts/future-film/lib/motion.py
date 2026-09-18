#!/usr/bin/env python3
"""Cinematic motion graphics for THE FUTURE OF OORJAMAN. Typography + network, no product UI."""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (
    ACCENT,
    BG,
    CANVAS,
    CARD,
    DANGER,
    ELEVATED,
    FONTS,
    FPS,
    H,
    INDIA_MAP,
    INK,
    INVERSE,
    LAYOUT_H,
    LAYOUT_W,
    LINE,
    LOGO,
    MAN,
    MUTED,
    OORJA,
    PRIMARY,
    PRIMARY_LIGHT,
    SCALE,
    TIMELINE,
    W,
    WORK,
)

SCENES_DIR = WORK / "scenes"


def clamp01(t: float) -> float:
    return max(0.0, min(1.0, t))


def ease_out(t: float) -> float:
    t = clamp01(t)
    return 1 - (1 - t) ** 3


def ease_in_out(t: float) -> float:
    t = clamp01(t)
    return 3 * t * t - 2 * t * t * t


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def mix(c0, c1, t: float):
    t = clamp01(t)
    return tuple(int(lerp(c0[i], c1[i], t)) for i in range(3))


def reveal_n(t: float, n: int, until: float) -> int:
    if n <= 0:
        return 0
    return min(n, int(math.ceil(ease_out(clamp01(t / max(until, 0.01))) * n)))


def ease_out_back(t: float, s: float = 1.12) -> float:
    t = clamp01(t)
    return 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2


def load_fonts():
    files = {
        "regular": FONTS / "PlusJakartaSans-Regular.ttf",
        "medium": FONTS / "PlusJakartaSans-Medium.ttf",
        "semibold": FONTS / "PlusJakartaSans-SemiBold.ttf",
        "bold": FONTS / "PlusJakartaSans-Bold.ttf",
    }
    missing = [p for p in files.values() if not p.exists()]
    if missing:
        raise FileNotFoundError(f"Plus Jakarta Sans missing: {missing}")

    def f(path: Path, size: int):
        return ImageFont.truetype(str(path), size=size)

    return {
        "d": f(files["bold"], int(72 * SCALE)),
        "h": f(files["bold"], int(42 * SCALE)),
        "h2": f(files["semibold"], int(32 * SCALE)),
        "b": f(files["semibold"], int(22 * SCALE)),
        "s": f(files["medium"], int(16 * SCALE)),
        "xs": f(files["medium"], int(13 * SCALE)),
        "kpi": f(files["bold"], int(84 * SCALE)),
    }


LOGO_CACHE: dict[int, Image.Image] = {}


def load_logo(size: int) -> Image.Image:
    size = max(8, int(size))
    if size in LOGO_CACHE:
        return LOGO_CACHE[size]
    im = Image.open(LOGO).convert("RGBA")
    im.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - im.width) // 2
    y = (size - im.height) // 2
    canvas.paste(im, (x, y), im)
    LOGO_CACHE[size] = canvas
    return canvas


class ScaledDraw:
    """Layout is 1920×1080; draw ops are scaled to the output canvas."""

    def __init__(self, draw: ImageDraw.ImageDraw, scale: float):
        self._d = draw
        self.s = scale

    def _pt(self, xy):
        return (xy[0] * self.s, xy[1] * self.s)

    def _box(self, box):
        return tuple(c * self.s for c in box)

    def _pts(self, xy):
        if not xy:
            return xy
        first = xy[0]
        if isinstance(first, (int, float)):
            return tuple(c * self.s for c in xy)
        return [self._pt(p) for p in xy]

    def _width(self, kw):
        if kw.get("width"):
            kw = dict(kw)
            kw["width"] = max(1, int(round(kw["width"] * self.s)))
        return kw

    def text(self, xy, text, **kw):
        self._d.text(self._pt(xy), text, **kw)

    def textlength(self, text, font=None):
        return self._d.textlength(text, font=font) / self.s

    def line(self, xy, **kw):
        self._d.line(self._pts(xy), **self._width(kw))

    def ellipse(self, box, **kw):
        self._d.ellipse(self._box(box), **self._width(kw))

    def rectangle(self, box, **kw):
        self._d.rectangle(self._box(box), **self._width(kw))

    def rounded_rectangle(self, box, radius=0, **kw):
        self._d.rounded_rectangle(self._box(box), radius * self.s, **self._width(kw))

    def polygon(self, xy, **kw):
        self._d.polygon(self._pts(xy), **self._width(kw))


class Frame:
    def __init__(self, fonts, logo_big, logo_sm):
        self.im = Image.new("RGB", (W, H), CANVAS)
        self.fonts = fonts
        self.logo_big = logo_big
        self.logo_sm = logo_sm
        self._bind_draw()

    def _bind_draw(self):
        self.d = ScaledDraw(ImageDraw.Draw(self.im, "RGBA"), SCALE)

    def array(self) -> np.ndarray:
        return np.asarray(self.im)

    def text(self, xy, s, font, fill=INK, anchor="lt"):
        self.d.text(xy, s, font=self.fonts[font], fill=fill, anchor=anchor)

    def wordmark(self, cx, cy, size="h", alpha=1.0):
        font = self.fonts[size]
        o = "Oorja"
        m = "Man"
        wo = self.d.textlength(o, font=font)
        wm = self.d.textlength(m, font=font)
        x0 = cx - (wo + wm) / 2
        a = int(255 * clamp01(alpha))
        self.d.text((x0, cy), o, font=font, fill=(*OORJA, a), anchor="lm")
        self.d.text((x0 + wo, cy), m, font=font, fill=(*MAN, a), anchor="lm")

    def super_vision(self, alpha=230):
        self.d.rounded_rectangle((64, 40, 640, 78), 8, fill=(*PRIMARY_LIGHT, alpha))
        self.text((84, 59), "FUTURE VISION  ·  NOT CURRENTLY OPERATIONAL", "xs", MUTED, "lm")

    def kicker(self, s, y=120):
        t = s.upper().replace("OORJAMAN", "OorjaMan")
        self.text((96, y), t, "xs", PRIMARY, "lt")

    def title(self, s, y=148):
        self.text((96, y), s, "h", INK, "lt")

    def rounded(self, box, r=16, fill=CARD, outline=LINE, width=1):
        self.d.rounded_rectangle(box, r, fill=fill, outline=outline, width=width)

    def paste_logo(self, xy, big=False, opacity=255):
        logo = load_logo(int((280 if big else 96) * SCALE))
        if opacity < 255:
            logo = logo.copy()
            a = logo.split()[-1].point(lambda p: int(p * opacity / 255))
            logo.putalpha(a)
        self.im.paste(logo, (int(xy[0] * SCALE), int(xy[1] * SCALE)), logo)

    def paste_logo_centered(self, cx, cy, size: int, opacity=255):
        logo = load_logo(int(size * SCALE))
        if opacity < 255:
            logo = logo.copy()
            a = logo.split()[-1].point(lambda p: int(p * opacity / 255))
            logo.putalpha(a)
        x = int(cx * SCALE - logo.width / 2)
        y = int(cy * SCALE - logo.height / 2)
        self.im.paste(logo, (x, y), logo)

    def paste_rgba(self, img: Image.Image, xy, opacity: float = 1.0):
        opacity = clamp01(opacity)
        if opacity <= 0:
            return
        sw, sh = max(1, int(round(img.width * SCALE))), max(1, int(round(img.height * SCALE)))
        layer = img.resize((sw, sh), Image.Resampling.LANCZOS) if (sw, sh) != img.size else img
        if opacity < 1:
            layer = layer.copy()
            a = layer.split()[-1].point(lambda p: int(p * opacity))
            layer.putalpha(a)
        self.im.paste(layer, (int(xy[0] * SCALE), int(xy[1] * SCALE)), layer)


def ensure_india_map() -> Path:
    if not INDIA_MAP.exists():
        import prepare_india_map

        prepare_india_map.main()
    return INDIA_MAP


_MAP_FIT: dict[int, Image.Image] = {}


def india_map_fitted(width: int) -> Image.Image:
    if width not in _MAP_FIT:
        src = Image.open(ensure_india_map()).convert("RGBA")
        w, h = src.size
        _MAP_FIT[width] = src.resize((width, int(width * h / w)), Image.Resampling.LANCZOS)
    return _MAP_FIT[width]


def draw_h_chain(fr: Frame, labels, xs, y, *, shown: int, half_w: float, half_h: float, core: str | None = None):
    """Horizontal process row: connectors stop at box edges, boxes paint on top."""
    n = min(int(shown), len(labels))
    gap = 10
    for i in range(1, n):
        x0, x1 = float(xs[i - 1]), float(xs[i])
        fr.d.line((x0 + half_w + gap, y, x1 - half_w - gap, y), fill=PRIMARY, width=2)
    for i in range(n):
        x = float(xs[i])
        lab = labels[i]
        is_core = core is not None and lab == core
        fr.rounded(
            (x - half_w, y - half_h, x + half_w, y + half_h),
            12,
            fill=PRIMARY if is_core else CARD,
            outline=PRIMARY,
        )
        fr.text((x, y), lab, "s", INVERSE if is_core else INK, "mm")


def draw_map_node(fr: Frame, x: float, y: float):
    fr.d.ellipse((x - 13, y - 13, x + 13, y + 13), fill=CARD, outline=PRIMARY, width=2)
    fr.d.ellipse((x - 5, y - 5, x + 5, y + 5), fill=PRIMARY)


def draw_map_chip(fr: Frame, nx: float, ny: float, text: str, dx: float, dy: float):
    font = fr.fonts["xs"]
    tw = fr.d.textlength(text, font=font)
    w, h = tw + 24, 28
    cx, cy = nx + dx, ny + dy
    fr.rounded((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), 8, fill=CARD, outline=LINE)
    fr.text((cx, cy), text, "xs", INK, "mm")


def particles_network(fr: Frame, t: float):
    """Opening: particles → network around the logo (light canvas)."""
    rng = np.random.default_rng(7)
    n = 72
    cx, cy = LAYOUT_W / 2, LAYOUT_H / 2 - 48
    targets = []
    for i in range(n):
        ang = i / n * math.tau
        rad = 188 + 28 * math.sin(i * 1.7)
        targets.append((cx + math.cos(ang) * rad, cy + math.sin(ang) * rad * 0.92))
    origins = [(float(rng.uniform(120, LAYOUT_W - 120)), float(rng.uniform(100, LAYOUT_H - 140))) for _ in range(n)]
    p = ease_in_out(min(1, t / 2.8))
    pts = [(lerp(o[0], tg[0], p), lerp(o[1], tg[1], p)) for o, tg in zip(origins, targets)]
    if t > 1.1:
        a = ease_out(min(1, (t - 1.1) / 1.6))
        col = (*PRIMARY, int(70 * a))
        for i in range(0, n, 3):
            j = (i + 7) % n
            fr.d.line([pts[i], pts[j]], fill=col, width=2)
        for i in range(0, n, 5):
            j = (i + 13) % n
            fr.d.line([pts[i], pts[j]], fill=col, width=1)
    for x, y in pts:
        fr.d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(*PRIMARY, 160))


def draw_logo_anim(fr: Frame, cx: float, cy: float, t: float, start: float, anim: float = 1.15, base: int = 300):
    """Splash-like fade + scale overshoot of the real Oorjaman O."""
    u = clamp01((t - start) / anim)
    if u <= 0:
        return
    sc = 0.76 + 0.24 * ease_out_back(u)
    op = int(255 * ease_out(min(1.0, u * 1.35)))
    fr.paste_logo_centered(cx, cy, int(base * sc), opacity=op)


def scene_opening(fr: Frame, t: float, dur: float):
    cx, cy = LAYOUT_W / 2, LAYOUT_H / 2 - 48
    particles_network(fr, t)
    draw_logo_anim(fr, cx, cy, t, start=2.2, anim=1.35, base=320)
    if t > 4.6:
        a = ease_out(clamp01((t - 4.6) / 0.7))
        fr.wordmark(LAYOUT_W / 2, LAYOUT_H / 2 + 210, "h", alpha=a)
    if t > 5.8:
        a = ease_out(clamp01((t - 5.8) / 0.65))
        fr.text((LAYOUT_W / 2, LAYOUT_H / 2 + 262), "THE FUTURE OF ENERGY", "b", mix(CANVAS, MUTED, a), "mm")
    if t > 7.0:
        fr.text((LAYOUT_W / 2, LAYOUT_H - 72), "VISION FILM  ·  NOT A PRODUCT DEMO", "xs", MUTED, "mm")


STAGES = [
    ("SOLAR\nMARKETPLACE", "TODAY", "Vendors · products · services"),
    ("SOLAR\nECOSYSTEM", "VISION", "Install · finance · AMC · care"),
    ("ENERGY\nPLATFORM", "VISION", "Solar · battery · EV · meters"),
    ("ENERGY\nINTELLIGENCE", "VISION", "Optimise millions of assets"),
    ("NATIONAL\nINFRASTRUCTURE", "VISION", "India's distributed-energy economy"),
]


def scene_evolution(fr: Frame, t: float, dur: float):
    fr.super_vision()
    fr.kicker("OorjaMan = energy infrastructure platform")
    fr.title("Five-stage evolution")
    n = len(STAGES)
    xs = np.linspace(160, LAYOUT_W - 160, n)
    active = min(n - 1, int(ease_out(t / (dur - 1.5)) * n))
    for i, ((label, kind, sub), x) in enumerate(zip(STAGES, xs)):
        on = i <= active
        y = 420
        col = PRIMARY if on else LINE
        fr.d.ellipse((x - 14, y - 14, x + 14, y + 14), outline=col, width=2)
        if on:
            fr.d.ellipse((x - 6, y - 6, x + 6, y + 6), fill=PRIMARY if kind == "TODAY" else ACCENT)
        if i < n - 1:
            x2 = xs[i + 1]
            fr.d.line((x + 18, y, x2 - 18, y), fill=PRIMARY if i < active else LINE, width=2)
        tag_col = PRIMARY if kind == "TODAY" else MUTED
        fr.text((x, y - 48), kind, "xs", tag_col, "mm")
        fr.text((x, y + 56), label, "s", INK if on else MUTED, "ma")
        if on:
            fr.text((x, y + 148), sub, "xs", MUTED, "ma")


PASSPORT_FIELDS = [
    "Solar capacity",
    "Generation history",
    "Electricity consumption",
    "Savings",
    "CO₂ avoided",
    "Panel / inverter",
    "Installation date",
    "Warranty",
    "AMC history",
    "Cleaning history",
    "Performance score",
    "Expected remaining life",
    "Financing",
    "Insurance",
    "Carbon impact",
    "Asset resale value",
]


def scene_passport(fr: Frame, t: float, dur: float):
    fr.super_vision()
    fr.kicker("Imagine")
    fr.title("OorjaMan Energy Passport")
    fr.rounded((96, 260, 700, 980), 20)
    fr.paste_logo((130, 292), big=False)
    fr.text((260, 328), "ROOFTOP ASSET", "xs", PRIMARY, "lt")
    fr.text((260, 366), "OM-PASSPORT  ·  VISION", "b", INK, "lt")
    fr.text((128, 460), "Permanent digital identity", "s", MUTED, "lt")
    fr.text((128, 500), "for every participating plant.", "s", MUTED, "lt")
    fr.text((128, 580), "Could transfer with the property.", "s", INK, "lt")
    fr.text((128, 680), "Over time, a database of India's", "xs", MUTED, "lt")
    fr.text((128, 708), "distributed energy assets.", "xs", MUTED, "lt")
    cols = 2
    shown = max(1, reveal_n(t - 0.3, len(PASSPORT_FIELDS), dur * 0.62))
    for i, field in enumerate(PASSPORT_FIELDS[:shown]):
        col = i % cols
        row = i // cols
        x = 740 + col * 560
        y = 260 + row * 88
        fr.rounded((x, y, x + 520, y + 72), 12, fill=CARD)
        fr.d.ellipse((x + 22, y + 26, x + 42, y + 46), outline=PRIMARY, width=2)
        fr.text((x + 58, y + 36), field, "s", INK, "lm")


SCORE_DIMS = [
    "Generation",
    "Efficiency",
    "Grid dependence",
    "Battery utilisation",
    "Equipment health",
    "Carbon reduction",
    "Consumption",
    "Maintenance",
]


SCORE_TYPES = ["Homes", "Apartments", "Hotels", "Schools", "Hospitals", "Industry", "Commercial"]


def scene_score(fr: Frame, t: float, dur: float):
    fr.super_vision()
    fr.kicker("A new category")
    fr.title("OorjaMan Energy Score")
    cx, cy, r = 360, 560, 186
    progress = ease_out(clamp01((t - 0.3) / 5.5)) * 0.872
    fr.d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=LINE, width=18)
    steps = max(2, int(120 * progress))
    pts = []
    for i in range(steps + 1):
        ang = -math.pi / 2 + i / 120 * math.tau * progress
        pts.append((cx + math.cos(ang) * r, cy + math.sin(ang) * r))
    if len(pts) > 1:
        fr.d.line(pts, fill=PRIMARY, width=18, joint="curve")
    val = int(872 * ease_out(clamp01((t - 0.2) / 5.0)))
    fr.text((cx, cy - 20), str(val), "kpi", INK, "mm")
    fr.text((cx, cy + 70), "/ 1000", "b", MUTED, "mm")
    shown = reveal_n(t, len(SCORE_DIMS), dur * 0.55)
    for i, dim in enumerate(SCORE_DIMS[:shown]):
        y = 250 + i * 70
        fr.rounded((640, y, 1280, y + 58), 12)
        bar_w = int(480 * (0.55 + 0.08 * (i % 4)) * ease_out(clamp01((t - i * 0.12) / 2)))
        fr.d.rounded_rectangle((660, y + 34, 660 + bar_w, y + 44), 4, fill=PRIMARY)
        fr.text((660, y + 16), dim, "xs", MUTED, "lt")
    if t > 5.5:
        fr.rounded((1360, 250, 1820, 430), 16, outline=PRIMARY)
        fr.text((1590, 300), "HOTEL  ·  VISION", "xs", PRIMARY, "mm")
        fr.text((1590, 360), "914 / 1000", "h", INK, "mm")
    types_n = reveal_n(t - 6.0, len(SCORE_TYPES), 4.0)
    for i, lab in enumerate(SCORE_TYPES[:types_n]):
        x = 1360
        y = 460 + i * 68
        fr.rounded((x, y, 1820, y + 56), 10)
        fr.text((x + 24, y + 28), lab, "s", INK, "lm")


INDEP = [
    "Solar",
    "Battery",
    "Smart Meter",
    "Energy Management",
    "EV Charger",
    "AMC",
    "Insurance",
    "Financing",
]


def scene_independence(fr: Frame, t: float, dur: float):
    fr.super_vision()
    fr.kicker("Beyond selling solar")
    fr.title("Energy independence")
    # house block
    hx, hy = 960, 430
    fr.rounded((hx - 120, hy, hx + 120, hy + 160), 8, fill=CARD, outline=PRIMARY)
    fr.d.polygon([(hx - 150, hy), (hx, hy - 90), (hx + 150, hy)], outline=PRIMARY, width=3)
    fr.text((hx, hy + 80), "PROPERTY", "xs", MUTED, "mm")
    n = len(INDEP)
    shown = reveal_n(t - 0.2, n, dur * 0.62)
    for i, label in enumerate(INDEP[:shown]):
        ang = -math.pi / 2 + i / n * math.tau
        x = hx + math.cos(ang) * 340
        y = hy + 40 + math.sin(ang) * 250
        fr.d.line((hx, hy + 40, x, y), fill=LINE, width=1)
        fr.rounded((x - 130, y - 28, x + 130, y + 28), 14, fill=CARD, outline=PRIMARY)
        fr.text((x, y), label, "s", INK, "mm")


VERIFY = [
    "OorjaMan verification",
    "Technical rating",
    "Customer rating",
    "Installation rating",
    "Complaint history",
    "Response-time rating",
    "Warranty performance",
]
VENDOR_WEIGHTS = [
    ("Installation quality", "25%"),
    ("Customer satisfaction", "20%"),
    ("Service response", "15%"),
    ("Generation performance", "20%"),
    ("Warranty compliance", "10%"),
    ("Documentation", "10%"),
]


def scene_trust(fr: Frame, t: float, dur: float):
    fr.super_vision()
    fr.kicker("Not another generic marketplace")
    fr.title("OorjaMan Verified")
    shown = reveal_n(t, len(VERIFY), dur * 0.5)
    for i, lab in enumerate(VERIFY[:shown]):
        y = 260 + i * 92
        fr.rounded((96, y, 900, y + 76), 12)
        fr.text((140, y + 38), lab, "b", INK, "lm")
    if t > 3.5:
        a = ease_out(clamp01((t - 3.5) / 0.8))
        fr.rounded((980, 260, 1820, 430), 16, fill=PRIMARY)
        fr.text((1400, 318), "VENDOR RATING", "xs", (255, 255, 255), "mm")
        fr.text((1400, 378), "4.8  /  5", "d", (255, 255, 255), "mm")
    wn = reveal_n(t - 5.0, len(VENDOR_WEIGHTS), 5.0)
    for i, (lab, w) in enumerate(VENDOR_WEIGHTS[:wn]):
        y = 470 + i * 80
        fr.rounded((980, y, 1820, y + 68), 12)
        fr.text((1020, y + 34), lab, "s", INK, "lm")
        fr.text((1760, y + 34), w, "b", PRIMARY, "rm")


FINANCE = [
    "Solar loans",
    "EMI",
    "Lease models",
    "Pay-as-you-save",
    "Commercial financing",
    "MSME financing",
    "Apartment financing",
    "Solar + battery",
]
FIN_FLOW = ["CUSTOMER", "OorjaMan", "BANK / NBFC", "VENDOR"]


def scene_finance(fr: Frame, t: float, dur: float):
    fr.super_vision()
    fr.kicker("OorjaMan Finance")
    fr.title("Capital inside the journey")
    shown_f = reveal_n(t, len(FIN_FLOW), dur * 0.4)
    xs = np.linspace(180, 1740, len(FIN_FLOW))
    y = 300
    draw_h_chain(fr, FIN_FLOW, xs, y, shown=shown_f, half_w=130, half_h=36, core="OorjaMan")
    shown = reveal_n(t - 2.0, len(FINANCE), dur * 0.5)
    for i, lab in enumerate(FINANCE[:shown]):
        col = i % 4
        row = i // 4
        x = 96 + col * 456
        y = 420 + row * 140
        fr.rounded((x, y, x + 420, y + 110), 14)
        fr.text((x + 28, y + 55), lab, "b", INK, "lm")
    if t > 7.5:
        fr.rounded((96, 720, 1824, 980), 16, outline=PRIMARY)
        fr.text((960, 800), "SOLAR AS A SERVICE", "xs", PRIMARY, "mm")
        fr.text((960, 860), "₹X / month for clean electricity", "h2", INK, "mm")
        fr.text((960, 920), "Vision  ·  investor or vendor may own the system", "s", MUTED, "mm")


ADVISOR = [
    "Consumption",
    "Solar size",
    "Generation",
    "Savings",
    "Payback",
    "Battery",
    "Financing",
    "Carbon",
    "Equipment",
]
FLOW = ["AI", "Assessment", "Recommendation", "Financing", "Vendor", "Installation", "Monitoring"]


def scene_advisor(fr: Frame, t: float, dur: float):
    fr.super_vision()
    fr.kicker("Artificial intelligence")
    fr.title("From a bill to an energy plan")
    fr.rounded((96, 280, 620, 860), 18)
    fr.text((140, 330), "ELECTRICITY BILL", "xs", PRIMARY, "lt")
    fr.text((140, 380), "Uploaded  ·  vision mock", "s", MUTED, "lt")
    for i in range(6):
        y = 440 + i * 56
        w = 280 + (i * 37) % 160
        fr.d.rounded_rectangle((140, y, 140 + w, y + 16), 4, fill=LINE)
    shown = reveal_n(t - 0.6, len(ADVISOR), dur * 0.55)
    for i, item in enumerate(ADVISOR[:shown]):
        y = 280 + i * 62
        fr.rounded((700, y, 1180, y + 52), 10)
        fr.text((728, y + 26), item, "s", INK, "lm")
        fr.text((1148, y + 26), "ANALYSED", "xs", PRIMARY, "rm")
    shown_f = reveal_n(t - 2.2, len(FLOW), dur * 0.55)
    x0 = 1280
    for i, step in enumerate(FLOW[: max(0, shown_f)]):
        y = 280 + i * 86
        fr.rounded((x0, y, 1820, y + 64), 12, outline=PRIMARY if i == shown_f - 1 else LINE)
        fr.text((x0 + 28, y + 32), f"{i + 1}   {step}", "s", INK, "lm")
        if i < shown_f - 1:
            fr.d.line((x0 + 80, y + 68, x0 + 80, y + 82), fill=PRIMARY, width=2)


def scene_monitoring(fr: Frame, t: float, dur: float):
    fr.super_vision()
    fr.kicker("Is this plant performing as it should?")
    fr.title("Intelligence + Energy Health Score")
    exp_a = ease_out(clamp01(t / 2.0))
    act_a = ease_out(clamp01((t - 1.0) / 2.0))
    fr.rounded((96, 260, 620, 520), 18)
    fr.text((130, 300), "EXPECTED", "xs", MUTED, "lt")
    fr.text((130, 380), f"{int(500 * exp_a)} kWh", "h", INK, "lt")
    fr.rounded((660, 260, 1184, 520), 18)
    fr.text((694, 300), "ACTUAL", "xs", MUTED, "lt")
    fr.text((694, 380), f"{int(390 * act_a)} kWh", "h", mix(INK, DANGER, act_a), "lt")
    health = ease_out(clamp01((t - 3.5) / 2.2))
    fr.rounded((1260, 260, 1824, 520), 18, outline=PRIMARY)
    fr.text((1542, 310), "PLANT HEALTH", "xs", PRIMARY, "mm")
    fr.text((1542, 390), f"{int(91 * max(health, 0.15))}/100", "d", mix(BG, INK, health), "mm")
    fr.text((1542, 470), "GREEN  ·  healthy", "s", PRIMARY, "mm")
    if t > 4.0:
        a = ease_out(clamp01((t - 4.0) / 0.7))
        fr.text((640, 580), "22% PERFORMANCE DEVIATION", "h2", mix(BG, DANGER, a), "mm")
    causes = ["Dust", "Shading", "Inverter issue", "Panel degradation", "Grid outage", "Cable issue"]
    shown = reveal_n(t - 5.5, len(causes), 4.0)
    for i, c in enumerate(causes[:shown]):
        col = i % 3
        row = i // 3
        x = 96 + col * 480
        y = 640 + row * 100
        fr.rounded((x, y, x + 440, y + 80), 12)
        fr.text((x + 28, y + 40), c, "s", INK, "lm")
    if t > 10.2:
        fr.rounded((660, 880, 1260, 980), 14, fill=PRIMARY)
        fr.text((960, 930), "SERVICE TICKET CREATED", "b", (255, 255, 255), "mm")


NET_FLOW = ["CUSTOMER", "TECHNICIAN", "JOB", "PAYMENT", "RATING", "AMC"]


CARE = [
    "AMC",
    "Cleaning",
    "Inspection",
    "Inverter servicing",
    "Thermography",
    "Warranty",
    "Replacement",
    "Emergency",
]
JOBS = [
    ("Solar inspection", "4.2 km"),
    ("Cleaning", "7.1 km"),
    ("Inverter fault", "9.5 km"),
]
ACADEMY = [
    "Installers",
    "Electricians",
    "Technicians",
    "Energy auditors",
    "EV / battery",
    "Drone inspection",
]


def scene_network(fr: Frame, t: float, dur: float):
    fr.super_vision()
    fr.kicker("OorjaMan Care  ·  technicians  ·  academy")
    fr.title("The service nation underneath")
    shown = reveal_n(t, len(CARE), dur * 0.4)
    for i, lab in enumerate(CARE[:shown]):
        col = i % 4
        row = i // 4
        x = 96 + col * 280
        y = 260 + row * 88
        fr.rounded((x, y, x + 256, y + 72), 12)
        fr.text((x + 20, y + 36), lab, "s", INK, "lm")
    shown_j = reveal_n(t - 3.0, len(JOBS), 4.0)
    for i, (job, dist) in enumerate(JOBS[:shown_j]):
        y = 460 + i * 100
        fr.rounded((1260, y, 1824, y + 84), 12, outline=PRIMARY)
        fr.text((1292, y + 28), job, "s", INK, "lt")
        fr.text((1292, y + 56), dist + "  ·  accept", "xs", PRIMARY, "lt")
    shown_a = reveal_n(t - 6.5, len(ACADEMY), 5.0)
    fr.text((96, 540), "OorjaMan ACADEMY  ·  CERTIFIED PROFESSIONAL", "xs", PRIMARY, "lt")
    for i, lab in enumerate(ACADEMY[:shown_a]):
        x = 96 + i * 190
        fr.rounded((x, 580, x + 176, 680), 12)
        fr.text((x + 88, 630), lab, "xs", INK, "mm")
    shown_f = reveal_n(t - 8.0, len(NET_FLOW), 4.5)
    xs = np.linspace(180, 1740, len(NET_FLOW))
    draw_h_chain(fr, NET_FLOW, xs, 820, shown=shown_f, half_w=100, half_h=36)
    fr.text((96, 1000), "Vision  ·  not a live technician dispatch map", "xs", MUTED, "lt")


MARKET = [
    ("Solar", "Generation"),
    ("Wind", "Generation"),
    ("Hybrid", "Generation"),
    ("Batteries", "Storage"),
    ("BESS", "Storage"),
    ("EV chargers", "Mobility"),
    ("Motors", "Efficiency"),
    ("Pumps", "Efficiency"),
    ("HVAC", "Efficiency"),
    ("Lighting", "Efficiency"),
    ("Installation", "Services"),
    ("AMC", "Services"),
    ("Cleaning", "Services"),
    ("Inspection", "Services"),
    ("Auditing", "Services"),
    ("Loans", "Finance"),
    ("Leasing", "Finance"),
    ("PPA", "Finance"),
    ("Smart meters", "Technology"),
    ("IoT", "Technology"),
    ("AI monitoring", "Technology"),
]


def scene_marketplace(fr: Frame, t: float, dur: float):
    fr.super_vision()
    fr.kicker("OorjaMan Energy Marketplace")
    fr.title("A full ecosystem — not only solar")
    shown = reveal_n(t, len(MARKET), dur * 0.7)
    for i, (label, group) in enumerate(MARKET[:shown]):
        col = i % 7
        row = i // 7
        x = 96 + col * 260
        y = 280 + row * 220
        fr.rounded((x, y, x + 236, y + 180), 14)
        fr.text((x + 20, y + 36), group.upper(), "xs", PRIMARY, "lt")
        fr.text((x + 20, y + 100), label, "b", INK, "lt")


def scene_segments(fr: Frame, t: float, dur: float):
    fr.super_vision()
    fr.kicker("Same OS, two enormous markets")
    fr.title("Apartments  ·  MSMEs")
    a = ease_out(clamp01(t / 1.2))
    fr.rounded((96, 260, 920, 980), 18)
    fr.text((140, 320), "APARTMENT ENERGY OS", "xs", PRIMARY, "lt")
    apt = [
        "Rooftop solar",
        "Common-area electricity",
        "EV charging",
        "Solar water heating",
        "Battery storage",
        "Energy monitoring",
        "AMC + cleaning",
    ]
    shown_a = reveal_n(t - 0.6, len(apt), 6.0)
    for i, lab in enumerate(apt[:shown_a]):
        fr.text((160, 400 + i * 70), "→   " + lab, "b", mix(BG, INK, a), "lt")
    fr.rounded((1000, 260, 1824, 980), 18)
    fr.text((1044, 320), "OorjaMan FOR MSMEs", "xs", PRIMARY, "lt")
    fr.text((1044, 400), "One dashboard", "h2", INK, "lt")
    fr.text((1044, 460), "Bill → solar → finance → install", "s", MUTED, "lt")
    fr.text((1044, 500), "→ monitor → AMC → efficiency", "s", MUTED, "lt")
    if t > 5.5:
        fr.rounded((1044, 620, 1780, 860), 14, outline=PRIMARY)
        fr.text((1412, 700), "VISION EXAMPLE", "xs", PRIMARY, "mm")
        fr.text((1412, 770), "₹18.6 lakh / year", "h", INK, "mm")
        fr.text((1412, 830), "potential electricity reduction", "s", MUTED, "mm")


def scene_carbon(fr: Frame, t: float, dur: float):
    fr.super_vision()
    fr.kicker("Carbon  ·  wallet  ·  property")
    fr.title("Intelligence beyond the rooftop")
    blocks = [
        ("CARBON INTELLIGENCE", ["1.84 GWh consumed", "61% renewable used", "1,240 t CO₂ avoided", "ESG reporting support"]),
        ("CARBON WALLET", ["OorjaMan Green Points", "Generation · EV · efficiency", "Redeem for AMC & offers", "Verified environmental record"]),
        ("GREEN PROPERTY", ["Energy profile per building", "Search: Score above 800", "Solar potential + carbon", "A property-energy layer"]),
    ]
    for i, (lab, body) in enumerate(blocks):
        x = 96 + i * 608
        a = ease_out(clamp01((t - i * 0.45) / 1.1))
        if a <= 0:
            continue
        fr.rounded((x, 280, x + 568, 920), 18)
        fr.text((x + 40, 360), lab, "xs", PRIMARY, "lt")
        for j, line in enumerate(body):
            fr.text((x + 40, 460 + j * 72), line, "b", mix(BG, INK, a), "lt")
    fr.text((96, 1000), "Corporate ESG + consumer points + property intelligence  ·  potential", "xs", MUTED, "lt")


# Fractions of the outline + chip offset in px from the node (away from crowded land).
CITIES = [
    ("North", 0.33, 0.29, 62, -42),
    ("West", 0.13, 0.52, -78, 4),
    ("Centre", 0.38, 0.50, 64, 36),
    ("South", 0.28, 0.68, -82, 12),
    ("East", 0.54, 0.44, 62, -10),
    ("Northeast", 0.82, 0.33, 8, -42),
    ("East Coast", 0.40, 0.78, 80, 18),
    ("Deep South", 0.30, 0.90, 90, 20),
]
# Hub-and-spoke plus a south/east chain — illustration, not coverage.
CITY_EDGES = [
    (2, 0),
    (2, 1),
    (2, 3),
    (2, 4),
    (0, 5),
    (4, 5),
    (3, 6),
    (6, 7),
    (1, 3),
]


def scene_india(fr: Frame, t: float, dur: float):
    fr.super_vision()
    fr.kicker("At scale — ambition, not coverage")
    fr.title("OorjaMan India Energy Intelligence Platform")
    mw = 640
    amap = india_map_fitted(mw)
    mh = amap.height
    ox, oy = 80, 242
    appear = ease_out(clamp01(t / 1.8))
    fr.paste_rgba(amap, (ox, oy), appear)
    pts = [(ox + fx * mw, oy + fy * mh) for _, fx, fy, _, _ in CITIES]
    nshow = int(ease_out(clamp01((t - 1.4) / 6.0)) * len(CITIES))
    link_a = ease_out(clamp01((t - 2.2) / 5.5))
    if appear > 0.2 and nshow:
        for a, b in CITY_EDGES:
            if a >= nshow or b >= nshow:
                continue
            x0, y0 = pts[a]
            x1, y1 = pts[b]
            x1 = lerp(x0, x1, link_a)
            y1 = lerp(y0, y1, link_a)
            fr.d.line((x0, y0, x1, y1), fill=(*PRIMARY, 150), width=2)
    for i, (_name, _fx, _fy, _dx, _dy) in enumerate(CITIES[:nshow]):
        draw_map_node(fr, *pts[i])
    for i, (name, _fx, _fy, dx, dy) in enumerate(CITIES[:nshow]):
        draw_map_chip(fr, pts[i][0], pts[i][1], name, dx, dy)
    labels = ["Solar", "Generation", "Storage", "EV infrastructure", "Energy efficiency", "Energy potential"]
    for i, lab in enumerate(labels):
        if t < 3.5 + i * 0.4:
            continue
        y = 300 + i * 90
        fr.rounded((1120, y, 1780, y + 72), 12)
        fr.text((1160, y + 36), lab, "b", INK, "lm")
    fr.text((96, 1000), "Political outline for illustration  ·  future vision  ·  not national-scale operations today", "xs", MUTED, "lt")


PLATFORM = [
    "MANUFACTURERS",
    "OorjaMan",
    "FINANCIERS",
    "VENDORS",
    "TECHNICIANS",
    "CUSTOMERS",
    "ENERGY DATA",
]


APIS = [
    "Solar asset performance API",
    "Equipment health API",
    "Failure-data API",
    "Renewable deployment API",
    "Energy-score API",
]


def scene_platform(fr: Frame, t: float, dur: float):
    fr.super_vision()
    fr.kicker("Don't manufacture everything")
    fr.title("The layer that connects everyone")
    shown = reveal_n(t, len(PLATFORM), dur * 0.5)
    cx = 560
    box_h, step = 72, 96
    y0 = 250
    for i in range(1, shown):
        top = y0 + i * step
        fr.d.line((cx, top - (step - box_h) + 8, cx, top - 8), fill=PRIMARY, width=2)
    for i, label in enumerate(PLATFORM[: max(0, shown)]):
        y = y0 + i * step
        is_core = label == "OorjaMan"
        fr.rounded((cx - 260, y, cx + 260, y + box_h), 14, fill=PRIMARY if is_core else CARD, outline=PRIMARY)
        fr.text((cx, y + box_h / 2), label, "b", INVERSE if is_core else INK, "mm")
    if t > 5.0:
        fr.text((1180, 270), "OorjaMan API", "xs", PRIMARY, "lt")
        shown_a = reveal_n(t - 5.2, len(APIS), 6.0)
        for i, lab in enumerate(APIS[:shown_a]):
            y = 320 + i * 110
            fr.rounded((1180, y, 1824, y + 88), 12)
            fr.text((1220, y + 44), lab, "s", INK, "lm")
        fr.text((1180, 920), "Banks · insurers · OEMs · government · property", "xs", MUTED, "lt")


JOURNEY = [
    "CUSTOMER",
    "ELECTRICITY BILL",
    "OorjaMan AI"
    "ENERGY ASSESSMENT",
    "SOLAR RECOMMENDATION",
    "FINANCING",
    "VENDOR",
    "INSTALLATION",
    "MONITORING",
    "AMC",
    "CLEANING",
    "INSURANCE",
    "BATTERY",
    "EV CHARGER",
    "ENERGY EFFICIENCY",
    "CARBON REPORTING",
    "ASSET RESALE",
]


def scene_journey(fr: Frame, t: float, dur: float):
    fr.super_vision()
    fr.kicker("Own the journey")
    fr.title("Every step can create value")
    shown = reveal_n(t, len(JOURNEY), dur * 0.68)
    for i, label in enumerate(JOURNEY[: max(0, shown)]):
        col = i % 3
        row = i // 3
        x = 120 + col * 580
        y = 280 + row * 120
        fr.rounded((x, y, x + 540, y + 88), 12, outline=PRIMARY if i == 0 or "OorjaMan" in label else LINE)
        fr.text((x + 28, y + 44), f"{i + 1:02d}    {label}", "s", INK, "lm")


ECONOMY = [
    "Transaction fees",
    "Vendor subscriptions",
    "Customer subscriptions",
    "Financing",
    "AMC",
    "Cleaning",
    "Equipment",
    "Insurance",
    "Energy management",
    "Enterprise SaaS",
    "ESG",
    "Certification / training",
    "Advertising",
    "Data / API",
    "Energy optimisation",
]


def scene_economy(fr: Frame, t: float, dur: float):
    fr.super_vision()
    fr.kicker("Potential — not current revenue")
    fr.title("Potential platform economy")
    shown = reveal_n(t, len(ECONOMY), dur * 0.62)
    for i, label in enumerate(ECONOMY[: max(0, shown)]):
        col = i % 2
        row = i // 2
        x = 140 + col * 880
        y = 280 + row * 88
        fr.rounded((x, y, x + 820, y + 70), 12)
        fr.d.rectangle((x, y, x + 8, y + 70), fill=PRIMARY)
        fr.text((x + 36, y + 35), label, "b", INK, "lm")


def scene_final(fr: Frame, t: float, dur: float):
    p = ease_in_out(clamp01(t / 5.2))
    rng = np.random.default_rng(3)
    n = 64
    pts = []
    cx, cy = LAYOUT_W / 2, LAYOUT_H / 2 - 48
    for i in range(n):
        ang = i / n * math.tau
        rad = lerp(400, 170, p)
        x = cx + math.cos(ang) * rad
        y = cy + math.sin(ang) * rad * 0.78
        jitter = (1 - p) * 36
        x += float(rng.normal(0, jitter))
        y += float(rng.normal(0, jitter))
        pts.append((x, y))
        fr.d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=mix(LINE, PRIMARY, p))
    for i in range(0, n, 2):
        j = (i + 9) % n
        fr.d.line([pts[i], pts[j]], fill=(*PRIMARY, int(50 + 70 * p)), width=2)
    draw_logo_anim(fr, cx, cy, t, start=4.0, anim=1.25, base=300)
    if t > 6.0:
        a = ease_out(clamp01((t - 6.0) / 0.75))
        fr.wordmark(LAYOUT_W / 2, LAYOUT_H / 2 + 210, "h", alpha=a)
        fr.text((LAYOUT_W / 2, LAYOUT_H / 2 + 268), "CONNECTING THE ENERGY ECOSYSTEM", "b", mix(CANVAS, MUTED, a), "mm")
    if t > 10:
        fade = ease_out(clamp01((t - 10) / 3.5))
        overlay = Image.new("RGB", (W, H), BG)
        fr.im = Image.blend(fr.im, overlay, fade)
        fr._bind_draw()


SCENES = {
    "00_opening": scene_opening,
    "01_evolution": scene_evolution,
    "02_passport": scene_passport,
    "03_score": scene_score,
    "04_independence": scene_independence,
    "05_trust": scene_trust,
    "06_finance": scene_finance,
    "07_advisor": scene_advisor,
    "08_health": scene_monitoring,
    "09_care": scene_network,
    "10_marketplace": scene_marketplace,
    "11_segments": scene_segments,
    "12_carbon": scene_carbon,
    "13_india": scene_india,
    "14_platform": scene_platform,
    "15_journey": scene_journey,
    "16_economy": scene_economy,
    "17_final": scene_final,
}


def encode_scene(sid: str, fn, duration: float, fonts, logo_big, logo_sm) -> Path:
    out = SCENES_DIR / f"{sid}.mp4"
    frames = int(round(duration * FPS))
    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        f"{W}x{H}",
        "-r",
        str(FPS),
        "-i",
        "-",
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-profile:v",
        "high",
        "-level:v",
        "5.1",
        "-preset",
        "slow",
        "-crf",
        "14",
        "-maxrate",
        "40M",
        "-bufsize",
        "80M",
        "-x264-params",
        "aq-mode=3:aq-strength=0.8:deadzone-inter=0:deadzone-intra=0:deblock=-2:-1:ref=4:me=umh:subme=8",
        "-g",
        "30",
        "-colorspace",
        "bt709",
        "-color_primaries",
        "bt709",
        "-color_trc",
        "bt709",
        "-color_range",
        "pc",
        "-tag:v",
        "avc1",
        str(out),
    ]
    import subprocess

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    assert proc.stdin is not None
    for i in range(frames):
        t = i / FPS
        fr = Frame(fonts, logo_big, logo_sm)
        fn(fr, t, duration)
        proc.stdin.write(fr.im.tobytes())
        if i % 30 == 0:
            print(f"  {sid} {i}/{frames}", flush=True)
    proc.stdin.close()
    rc = proc.wait()
    if rc != 0:
        raise RuntimeError(f"ffmpeg failed for {sid} ({rc})")
    return out


def main() -> None:
    SCENES_DIR.mkdir(parents=True, exist_ok=True)
    ensure_india_map()
    fonts = load_fonts()
    logo_big = load_logo(280)
    logo_sm = load_logo(96)
    for scene in TIMELINE["scenes"]:
        sid = scene["id"]
        fn = SCENES[sid]
        print("Render", sid)
        encode_scene(sid, fn, float(scene["duration"]), fonts, logo_big, logo_sm)
    lst = SCENES_DIR / "concat.txt"
    lines = []
    for s in TIMELINE["scenes"]:
        p = SCENES_DIR / f"{s['id']}.mp4"
        lines.append(f"file '{p}'")
    lst.write_text("\n".join(lines) + "\n")
    silent = WORK / "picture_silent.mp4"
    import subprocess

    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(lst),
            "-c",
            "copy",
            str(silent),
        ]
    )
    print("Picture:", silent)


if __name__ == "__main__":
    main()
