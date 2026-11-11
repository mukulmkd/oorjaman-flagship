# Cursor Cloud Agents + EAS

Use this so Cloud Agents (including the **iPhone app**) can run `eas-cli` without interactive `eas login`.

## 1. Create an Expo access token

1. Sign in at [expo.dev](https://expo.dev) as the **oorjaman** org account (or an account with access to Customer + Partner projects).
2. Open [Access tokens](https://expo.dev/settings/access-tokens) (Account settings → Access tokens).
3. Create a token (name e.g. `cursor-cloud-agents`).
4. Copy it once — treat it like a password.

Prefer a **robot user** token with the least privileges that can still build/update/submit if you use robot accounts; otherwise a personal access token on the org admin is fine for a small team.

## 2. Add the secret in Cursor

1. Open the **oorjaman-flagship** Cloud Agent environment (Dashboard → Cloud Agents → Environments).
2. Under **Secrets**, add:

| Name | Value |
| --- | --- |
| `EXPO_TOKEN` | *(paste the Expo access token)* |

3. Save. Do **not** commit the token to git.

`EXPO_TOKEN` is the standard env var EAS CLI reads for non-interactive auth ([Expo programmatic access](https://docs.expo.dev/accounts/programmatic-access/)).

## 3. Repo install for agents

`.cursor/environment.json` runs `npm ci` on environment Builds so agents have workspace deps. After changing that file, let Cursor refresh/rebuild the environment (or wait for stale-build refresh).

## 4. Verify from phone or web

Start a Cloud Agent on **`develop`** with a read-only check:

```text
Do not change code. From the repo root, run:
  npx eas-cli whoami
Then for Partner only:
  cd apps/technician-app && npx eas-cli project:info --non-interactive
Report the logged-in account and project ids. No builds.
```

You should see the Expo account / org that owns the token, and Partner project id `a89deab7-9f4e-4411-a533-061002c8b049`.

## 5. What agents may run (guardrails)

Always follow `.cursor/rules/release-build-workflow.mdc` and `release-versioning.mdc`.

| Allowed after confirm | Avoid from phone unless explicitly asked |
| --- | --- |
| `eas update` (OTA) with clear app + channel + message | Production store **submit** without human confirm |
| `eas build --non-interactive --no-wait` when you asked for a build | Interactive Apple login flows |
| `eas build:list` / `submit:list` / `whoami` | Bumping semver “for neatness” |

Example OTA prompt (after token works):

```text
Partner production OTA only. Do not bump version.
cd apps/technician-app && npx expo-doctor
then:
EAS_BUILD_NO_EXPO_GO_WARNING=true npx eas-cli update --channel production --message "…" --non-interactive
Report the update group URL. No iOS/Android store build.
```

## 6. Limits

- Cloud Agents still need `--non-interactive` for EAS.
- App Store Connect Apple ID password prompts won’t work well; use existing EAS credentials / ASC API key already on Expo (Partner submit already uses EAS-stored ASC key).
- Cloudflare / Expo bot blocks that hit some sandboxes are unrelated; Cloud Agent VMs use `EXPO_TOKEN` over the network like CI.
