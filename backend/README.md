Backend (FastAPI)

Endpoints

- GET `/health` — simple health check.
- GET `/meetings` — list recent meetings from Supabase.
- GET `/meeting/{id}` — fetch a single meeting by id.
- POST `/process-meeting` — JSON body: `{ "audio_url": string, "meeting_id"?: string, "push_token"?: string }`. Steps: Download → Transcribe (OpenAI Whisper if available, else mock) → Summarize → Insert into Supabase → Send Expo push notification with deep link.

Setup

1. Create a Python venv and install requirements

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

2. Environment variables

- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_KEY` — your Supabase service role key (required for inserts bypassing RLS)
- `OPENAI_API_KEY` — optional; enables real transcription and summary

You can place these in `backend/.env` (copy from `backend/.env.example` if provided) or use a project root `.env`. The app automatically loads both.

3. Run the server

```bash
# For simulator or local browser
uvicorn backend.app:app --reload --port 8000

# For a physical device on the same Wi‑Fi
uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000
```

Note: Binding directly to a specific IP (e.g., `--host 192.168.1.30`) can fail if the address changes. Prefer `--host 0.0.0.0` and point the client to your Mac's IP.

Data

- Supabase table `MeetingNotes`: `id` (uuid), `audio_url` (text), `transcript` (text), `summary` (text), `created_at` (timestamp). Additional fields like `status` are optional.

Notifications

- Uses Expo push API (`https://exp.host/--/api/v2/push/send`). The app scheme is `inpersonmeetingnotes`, so notifications deep link to `inpersonmeetingnotes://meeting/{id}`.

Client configuration

- Set `EXPO_PUBLIC_BACKEND_URL` so the app can reach the backend:
  - iOS Simulator: `http://127.0.0.1:8000`
  - Android Emulator: `http://10.0.2.2:8000`
  - Physical device: `http://<your-mac-ip>:8000`

Find your local IP (macOS):

```bash
ipconfig getifaddr en0
# Or list and choose the LAN IP
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Quick Tests

```bash
# Health
curl http://localhost:8000/health

# List meetings
curl http://localhost:8000/meetings

# Process meeting (example)
curl -X POST http://localhost:8000/process-meeting \
  -H "Content-Type: application/json" \
  -d '{"audio_url":"https://example.com/test.mp3","meeting_id":"demo-1"}'
```
