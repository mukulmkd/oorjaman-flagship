#!/usr/bin/env python3
"""Finite helpers — no infinite loops; every wait has timeout."""
from __future__ import annotations

import json
import subprocess
import time
from datetime import datetime
from pathlib import Path
from typing import Callable


class DemoError(RuntimeError):
    """Fatal production-demo error."""


def now_run_id() -> str:
    return "run-" + datetime.now().strftime("%Y%m%d-%H%M%S")


def sh(cmd: list[str], *, check: bool = True, timeout: float | None = 120) -> subprocess.CompletedProcess:
    print("+", " ".join(str(c) for c in cmd)[:220], flush=True)
    try:
        p = subprocess.run(cmd, check=False, text=True, capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired as e:
        raise DemoError(f"Command timed out after {timeout}s: {' '.join(str(c) for c in cmd)[:160]}") from e
    if check and p.returncode != 0:
        err = (p.stderr or p.stdout or "").strip()
        raise DemoError(f"Command failed ({p.returncode}): {' '.join(str(c) for c in cmd)[:160]}\n{err[:1500]}")
    return p


def wait_until(
    predicate: Callable[[], bool],
    *,
    timeout: float,
    label: str,
    interval: float = 0.5,
    max_iters: int | None = None,
) -> bool:
    """Poll until predicate is true. Finite. No retries of business actions."""
    deadline = time.time() + timeout
    iters = 0
    limit = max_iters if max_iters is not None else int(timeout / interval) + 5
    while time.time() < deadline and iters < limit:
        if predicate():
            print(f"  wait OK: {label}", flush=True)
            return True
        time.sleep(interval)
        iters += 1
    print(f"  wait FAIL: {label} (timeout={timeout}s)", flush=True)
    return False


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n")


def append_jsonl(path: Path, row: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as f:
        f.write(json.dumps(row) + "\n")
