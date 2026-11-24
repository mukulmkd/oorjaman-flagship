# Stress tooling (UAT only)

| Path | Tool |
| --- | --- |
| [`k6/`](k6/) | API concurrency against OorjaMan UAT Supabase |
| [`maestro/`](maestro/) | Device flow loops on Customer / Partner UAT builds |

How to run, pass bars, and safety rules: [project-docs/MOBILE-STRESS.md](../project-docs/MOBILE-STRESS.md).

Copy [`.env.example`](.env.example) → `.env.local` if you want stress-specific emails/tokens (gitignored via root `.env.*` rules).
