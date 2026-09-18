# OorjaMan product demo

Production dual-app (Customer + Technician) UAT film pipeline.

## Entry point

```bash
./scripts/product-demo/production/build-demo.sh --help
./scripts/product-demo/production/build-demo.sh --preflight
./scripts/product-demo/production/build-demo.sh --record
./scripts/product-demo/production/build-demo.sh --render
```

Details: [`production/README.md`](production/README.md)

## Layout

| Path | Role |
|------|------|
| `production/` | Preflight, record, VO, compose, QC |
| `phase2_automate.py` | UI helpers used by the recorder |
| `phase3_record.py` | Login / home bootstrap |
| `phase3_record_e2e.py` | Gallery seed + E2E helpers |
| `phase2_assign_booking.mjs` | UAT assign harness |
| `clean_uat_demo_bookings.mjs` | UAT booking cleanup |
| `audio/score.mp3` | Background music stem |
| `.env` / `.env.example` | ElevenLabs (and related) secrets |

## Outputs (gitignored)

- Final film: `production/rendered/Oorjaman-End-to-End-Product-Demo-4K.mp4`
- Raw takes / events / logs: `production/raw|events|logs/<run-id>/`
- Generated VO stems: `production/audio/_beats/`, `voiceover.wav`

Tracked: engine code, config, `voiceover-beats.json`, `audio/score.mp3`, evidence JPGs, phone-frame assets.
