#!/usr/bin/env python3
"""Event timeline writer — wall + monotonic clocks."""
from __future__ import annotations

import time
from pathlib import Path

from .common import append_jsonl, write_json


class EventLog:
    def __init__(self, run_id: str, events_dir: Path):
        self.run_id = run_id
        self.events_dir = events_dir
        self.events_dir.mkdir(parents=True, exist_ok=True)
        self.path = events_dir / "events.jsonl"
        self._t0 = time.monotonic()
        self._n = 0
        if self.path.exists():
            self.path.unlink()

    def emit(
        self,
        *,
        actor: str,
        state_before: str,
        action: str,
        state_after: str,
        customer_visible_state: str = "",
        technician_visible_state: str = "",
        overlay: str | None = None,
        extra: dict | None = None,
    ) -> dict:
        self._n += 1
        row = {
            "event_id": f"e{self._n:04d}",
            "run_id": self.run_id,
            "timestamp_monotonic": round(time.monotonic() - self._t0, 3),
            "timestamp_wall": time.time(),
            "actor": actor,
            "state_before": state_before,
            "action": action,
            "state_after": state_after,
            "customer_visible_state": customer_visible_state,
            "technician_visible_state": technician_visible_state,
            "overlay": overlay,
        }
        if extra:
            row["extra"] = extra
        append_jsonl(self.path, row)
        print(f"  EVENT {row['event_id']} {actor} {state_before}->{state_after}", flush=True)
        return row

    def write_manifest(self, data: dict) -> None:
        write_json(self.events_dir / "manifest.json", data)
