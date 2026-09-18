# Oorjaman Production Product Demo Engine

Automated camera around the **real** Customer + Technician UAT apps.

Pipeline label: `4K_DEVICE_FRAMED_FROM_SCRCPY`  
Source: 1920×1080 (scrcpy) → Final: **3840×2160** @ 30fps H.264

## Master command

```bash
./scripts/product-demo/production/build-demo.sh --help
./scripts/product-demo/production/build-demo.sh --preflight
./scripts/product-demo/production/build-demo.sh --record
./scripts/product-demo/production/build-demo.sh --render
./scripts/product-demo/production/build-demo.sh --replace-voice path/to/voice.wav
```

## Hard rules

| Phase | Retries |
|-------|---------|
| Preflight | ≤ 3 |
| Production recording | **0** business-action retries |

On recording failure: stop, preserve under `failed-runs/<run-id>/`, exit non-zero. Never render a failed run.

## Layout

- Customer = LEFT, Technician = RIGHT
- Continuous dual recording (pre-roll → journey → post-roll)
- Events in `events/<run-id>/events.jsonl`
- Same `run-id` required for customer + technician footage

## Audio

- Narration: ElevenLabs (see `../.env.example`) + event-synced beats in `audio/`
- Music: `../audio/score.mp3`

## Output

`rendered/Oorjaman-End-to-End-Product-Demo-4K.mp4`  
QC: `rendered/Oorjaman-End-to-End-Product-Demo-4K-QC.md`

## Product code

This engine does **not** modify Customer/Technician app business logic.
