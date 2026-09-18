#!/usr/bin/env python3
"""Shared paths and config for the production demo engine."""
from __future__ import annotations

import json
from pathlib import Path

PROD = Path(__file__).resolve().parents[1]
DEMO = PROD.parent
ROOT = DEMO.parents[1]


def load_defaults() -> dict:
    return json.loads((PROD / "config" / "defaults.json").read_text())


def load_scenario() -> dict:
    return json.loads((PROD / "scenario.json").read_text())


def load_state_machine() -> dict:
    return json.loads((PROD / "state-machine.json").read_text())


CFG = load_defaults()


def resolve(rel: str) -> Path:
    p = Path(rel)
    return p if p.is_absolute() else ROOT / p


def python_bin() -> Path:
    return resolve(CFG["python_venv"])


def music_path() -> Path:
    for rel in CFG["music_candidates"]:
        p = resolve(rel)
        if p.exists() and p.stat().st_size > 1000:
            return p
    raise FileNotFoundError("No music stem found in music_candidates")


def logo_path() -> Path:
    return resolve(CFG["logo"])


def lockup_path() -> Path:
    return resolve(CFG.get("lockup") or "brand/source/logo-lockup-tagline.png")


def fonts_dir() -> Path:
    return resolve(CFG["fonts_dir"])


def run_dirs(run_id: str) -> dict[str, Path]:
    return {
        "raw": PROD / "raw" / run_id,
        "events": PROD / "events" / run_id,
        "logs": PROD / "logs" / run_id,
        "failed": PROD / "failed-runs" / run_id,
        "rendered": PROD / "rendered",
        "audio": PROD / "audio",
    }
