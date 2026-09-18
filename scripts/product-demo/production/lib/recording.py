#!/usr/bin/env python3
"""Dual scrcpy continuous recording — finite start/stop."""
from __future__ import annotations

import subprocess
import time
from pathlib import Path

from .common import DemoError, write_json
from .paths import CFG


class DualRecorder:
    def __init__(self, run_id: str, raw_dir: Path, cust_serial: str, tech_serial: str):
        self.run_id = run_id
        self.raw_dir = raw_dir
        self.cust_serial = cust_serial
        self.tech_serial = tech_serial
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.customer_mp4 = raw_dir / "customer.mp4"
        self.technician_mp4 = raw_dir / "technician.mp4"
        self._pc: subprocess.Popen | None = None
        self._pt: subprocess.Popen | None = None
        self.started_wall: float | None = None
        self.ended_wall: float | None = None
        self.recording_started = False

    def start(self) -> None:
        for p in (self.customer_mp4, self.technician_mp4):
            if p.exists():
                p.unlink()
        common = [
            "--no-window",
            "--no-playback",
            "--max-size",
            "1080",
            "--video-bit-rate",
            "12M",
            "--max-fps",
            "30",
            "--no-audio",
        ]
        self._pc = subprocess.Popen(
            ["scrcpy", "-s", self.cust_serial, "--record", str(self.customer_mp4), *common],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        self._pt = subprocess.Popen(
            ["scrcpy", "-s", self.tech_serial, "--record", str(self.technician_mp4), *common],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        time.sleep(2.0)
        if self._pc.poll() is not None or self._pt.poll() is not None:
            raise DemoError("scrcpy failed to start recording")
        self.started_wall = time.time()
        self.recording_started = True
        write_json(
            self.raw_dir / "recording-start.json",
            {
                "run_id": self.run_id,
                "recording_started_wall": self.started_wall,
                "customer_serial": self.cust_serial,
                "technician_serial": self.tech_serial,
                "max_size": 1080,
                "fps_target": 30,
                "pipeline_label": CFG["pipeline_label"],
            },
        )

    def stop(self) -> dict:
        self.ended_wall = time.time()
        for p in (self._pc, self._pt):
            if p and p.poll() is None:
                p.terminate()
                try:
                    p.wait(timeout=14)
                except subprocess.TimeoutExpired:
                    p.kill()
        time.sleep(1.0)
        manifest = {
            "run_id": self.run_id,
            "customer_path": str(self.customer_mp4),
            "technician_path": str(self.technician_mp4),
            "recording_started_wall": self.started_wall,
            "recording_ended_wall": self.ended_wall,
            "customer_serial": self.cust_serial,
            "technician_serial": self.tech_serial,
            "customer_bytes": self.customer_mp4.stat().st_size if self.customer_mp4.exists() else 0,
            "technician_bytes": self.technician_mp4.stat().st_size if self.technician_mp4.exists() else 0,
            "fps_target": 30,
            "source_resolution_note": "scrcpy max-size 1080",
            "pipeline_label": CFG["pipeline_label"],
        }
        return manifest
