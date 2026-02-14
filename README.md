## Run Locally

Follow these steps to run the mobile app and optional backend locally.

1. Install dependencies

```bash
npm install
```

2. Configure environment variables

- Required for app:
  - `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
  - `EXPO_PUBLIC_SUPABASE_KEY` — Supabase anon key (client)
  - `EXPO_PUBLIC_ANON_KEY` — alias for anon key (if used)
  - `EXPO_PUBLIC_BACKEND_URL` — FastAPI base URL (see step 3)
  - `SUPABASE_EMAIL` — service account email (backend-only)
  - `SUPABASE_PASSWORD` — service account password (backend-only)

3. Start the backend (FastAPI)

The backend provides transcription, summarization, DB updates, and push notifications.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

# Required backend env vars (service role is needed for inserts bypassing RLS):
export SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
export SUPABASE_KEY="YOUR_SERVICE_ROLE_KEY"
# Optional: OpenAI API key for real transcription/summary
export OPENAI_API_KEY="sk-..."

uvicorn backend.app:app --reload --host <your-ip-address> --port 8000
```

- For iOS simulator/web: set `EXPO_PUBLIC_BACKEND_URL` to `http://localhost:8000`.
- For a physical device: set it to `http://<your-mac-ip>:8000`.

4. Start the app

```bash
npx expo start
```

In the output, you'll find options to open the app in a:

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go)

## Architecture Decisions (Overview)

- **Cross-platform via Expo:** Uses Expo Router for file-based navigation under [app](app). Keeps one codebase for iOS/Android/web and leverages Expo config plugins found in [plugins](plugins).
- **Auth + Storage via Supabase:** The client in [lib/supabase.ts](lib/supabase.ts) reads `EXPO_PUBLIC_*` envs and persists sessions using `expo-sqlite`-backed `localStorage`. Audio files are uploaded to the `recordings` bucket; public URLs are generated client-side.
- **Recording and Upload Flow:** The helper in [utils/uploadRecordingToSupabase.ts](utils/uploadRecordingToSupabase.ts) reads the recorded file, infers content type, uploads to Supabase Storage, then triggers backend transcription via the public URL.
- **Backend Processing:** The FastAPI app in [backend/app.py](backend/app.py) downloads audio (supports Supabase public URLs and HTTP), transcribes (OpenAI Whisper if `OPENAI_API_KEY` is set; otherwise a mock), summarizes (OpenAI or heuristic), inserts into `MeetingNotes`, and posts an Expo push notification with a deep link.
- **Push Notifications:** Registration handled in [utils/registerForPushNotifications.ts](utils/registerForPushNotifications.ts). Uses an Android notification channel and Expo push tokens. Backend posts to Expo’s push API.
- **Data Fetching (React Query):** A `QueryClientProvider` is set up in [app/\_layout.tsx](app/_layout.tsx), with hooks in [queries/MeetingQueries.ts](queries/MeetingQueries.ts) providing caching, retries, and controlled refetch (`staleTime`, `gcTime`). Push notifications invalidate the meeting list to refresh when new transcripts are ready.
- **HTTP Client (Axios):** The service layer in [services/Meeting.ts](services/Meeting.ts) uses Axios for calling backend endpoints (`/meetings`, `/meeting/{id}`, `/process-meeting`) with auth headers and the `EXPO_PUBLIC_BACKEND_URL` base.
- **Deep Linking:** Push notifications include a link like `inpersonmeetingnotes://meeting/{id}` resolving to [app/meeting/[id].tsx](app/meeting/%5Bid%5D.tsx).
- **Configuration:** Public client envs are `EXPO_PUBLIC_*`; backend uses `SUPABASE_KEY` (service role) only on the server. This separation prevents service keys from ever shipping to the client.

## What I'd Improve With More Time

- **Offline-first queue:** Cache recordings and uploads locally; retry on connectivity changes with exponential backoff.
- **Background processing:** Move transcription to a job queue (e.g., Celery/Redis) and stream progress to the client; add server-side retries.
- **Security & RLS:** Harden Supabase policies for `MeetingNotes` and `recordings`, ensure least-privilege access; add signed URLs for download where appropriate.
- **DX & Testing:** Add unit/integration tests for upload/transcribe flow, mock Supabase and backend; set up CI with EAS, lint/type checks, and preview builds.
- **Observability:** Add structured logging and error reporting (Sentry), track upload/transcription states.
- **UX polish:** Progress indicators for upload/transcription, transcript editing, better empty/error states, and accessibility improvements.
