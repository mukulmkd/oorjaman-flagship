# Future film — THE FUTURE OF OORJAMAN

Canonical concept: `SOURCE.md`. Vision film only — not the live apps.

```bash
cd scripts/future-film
./generate.sh
```

Writes `output/Oorjaman-Future-of-Energy.mp4` + `.srt` + `QA_REPORT.md`.

## Indian English voice (ElevenLabs) — do this before generating

The film pipeline can only pull **Samar** (Indian English narrator) through the **API**. Your current **free** plan allows premade voices (George, etc.) on the API, but **Voice Library voices return 402**. Adding Samar to My Voices is not enough.

1. Open [https://elevenlabs.io/app/subscription](https://elevenlabs.io/app/subscription) and upgrade to **Starter or Creator**.
2. Open [https://elevenlabs.io/app/voice-library](https://elevenlabs.io/app/voice-library). Search **Indian English** / **Samar Male Narrator**. Click **Add** if it is not already in My Voices.
   - This cut: **Arjun – Modern and friendly** — Voice ID `2muwBbTynA0XWNaXklBY`
   - Alternatives: Samar `4r6X4jLUbqUXa3cbMPX2`, Sanket `hg1icMxI2KADq9a81ecq`
3. In **Playground**, paste: `An Oorja-Man Energy Passport — transferable with the property.` Confirm it says **Oorja** then immediately **Man**.
4. Keep `scripts/future-film/.env` as:

```
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=sk_…   # already set; do not paste it in chat
ELEVENLABS_VOICE_ID=2muwBbTynA0XWNaXklBY
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

5. In this chat, reply **ElevenLabs paid plan is on** (do not paste the key). Then we generate picture + VO + Horizons mux.

Until that upgrade, a generate would fall back to macOS **Aman** (Indian English, lower quality) or US premade George.

---

## Where to put secrets and music (so the pipeline / agent can pick them up)

Do **not** paste the API key into chat.

| What | Exact path (this repo) | Git |
| --- | --- | --- |
| ElevenLabs key + voice | `scripts/future-film/.env` | ignored (copy from `.env.example`) |
| Background score | `scripts/future-film/audio/score.wav` (or `.mp3` / `.m4a`) | ignored |

After both files exist, say **“keys and music are in place”** in this chat. The agent will run `./voiceover.sh && ./music.sh && ./compose.sh` and will not ask you to paste the key.

---

## 1. ElevenLabs — website (account + key)

1. Open [https://elevenlabs.io](https://elevenlabs.io) and **Sign up** (Google or email). Confirm the account.
2. Open [https://elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys) (or: avatar, bottom-left → **API Keys**).
3. **Create key**. Name it `oorjaman-film`. Copy it once (`sk_…`). You will not see the full key again.
4. Starter/Creator is required for ~4 minutes of **Voice Library** TTS via API. Premade voices work on free; Indian library voices do not.
5. Pick the Indian English voice as in the section above. Do not use a cloned celebrity voice.

---

## 2. ElevenLabs — this project

1. In Terminal:

```bash
cd /Users/mukulkishore/Desktop/Projects/oorjaman-flagship/scripts/future-film
cp .env.example .env
```

2. Open `scripts/future-film/.env` in the editor. Fill **only** the key (keep the rest):

```
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=sk_paste_the_key_here
ELEVENLABS_VOICE_ID=2muwBbTynA0XWNaXklBY
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

3. Save the file. `.env` is gitignored. Never commit it.

4. After a **paid** plan is on, generate (picture must re-render — scene lengths changed):

```bash
cd /Users/mukulkishore/Desktop/Projects/oorjaman-flagship/scripts/future-film
rm -rf work/vo work/picture_silent.mp4
./generate.sh
```

Or wait and reply **ElevenLabs paid plan is on** in chat.

5. Confirm: `cat work/vo/provider.json` shows `"provider": "elevenlabs"`.

**401** = wrong key. **402** on a library voice = still on the free plan (Voice Library blocked on the API). If `OPENAI_API_KEY` is also in your shell, `TTS_PROVIDER=elevenlabs` in `.env` still wins for these scripts.

Brand pronunciation: TTS is given `Oorja-Man` so it says **Oorja** then immediately **Man** as one compound (**OorjaMan**). Subtitles and on-screen copy show `OorjaMan`.

---

## 3. Background music

Drop your own file at `scripts/future-film/audio/score.mp3` (or `.wav` / `.m4a`). `./music.sh` loops/trims it to the film length and does not call ElevenLabs Music.

If the track is Scott Buckley’s **Horizons** (CC BY 4.0), credit on publish:

`'Horizons' by Scott Buckley - released under CC-BY 4.0. www.scottbuckley.com.au`

ElevenLabs Music (paid) is optional if you have no drop-in file:

On the **Create API Key** screen, also set:

| Endpoint | Set to |
| --- | --- |
| **Music Generation** | **Write** |

Keep Text to Speech = Write, User/Voices/Models = Read.

If you already created the key **without** Music Generation, create a **new** key with that extra Write permission, then replace `ELEVENLABS_API_KEY` in `.env`. Add these lines if they are missing:

```
MUSIC_PROVIDER=elevenlabs
ELEVENLABS_MUSIC_MODEL=music_v2
```

Without a drop-in file, the first `./music.sh` may call ElevenLabs Music (paid) and save `audio/score.mp3`. Free-tier Music is 402.

---

## After the paid plan is on

Reply: **ElevenLabs paid plan is on.** Do not paste the key. The agent will render graphics (OorjaMan titles), Indian English VO, Horizons score, and mux.
