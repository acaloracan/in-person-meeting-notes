import os
import json
import base64
from dotenv import load_dotenv, find_dotenv
import tempfile
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client
import requests
from postgrest.exceptions import APIError as PostgrestAPIError
from urllib.parse import urlparse
import re

try:
    from openai import OpenAI
except Exception:
    OpenAI = None  # type: ignore

# Load environment variables from the project root .env and backend/.env if present
load_dotenv(find_dotenv(), override=False)
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=False)

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

app = FastAPI()
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
openai_client = OpenAI(api_key=OPENAI_API_KEY) if (OPENAI_API_KEY and OpenAI) else None


def _is_service_role(jwt: str) -> bool:
    try:
        parts = jwt.split(".")
        if len(parts) < 2:
            return False
        payload_b64 = parts[1]
        # Pad base64
        padding = "=" * (-len(payload_b64) % 4)
        payload_json = base64.urlsafe_b64decode(payload_b64 + padding).decode("utf-8")
        payload = json.loads(payload_json)
        return payload.get("role") == "service_role"
    except Exception:
        return False


class ProcessMeetingPayload(BaseModel):
    audio_url: str
    meeting_id: str
    push_token: Optional[str] = None


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/meetings")
def list_meetings(limit: int = 50):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not configured")
    try:
        resp = supabase.table("MeetingNotes").select("id,audio_url,transcript,summary,created_at").order("created_at", desc=True).limit(limit).execute()
        data = getattr(resp, "data", []) or []
        return {"items": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list meetings: {e}")


@app.get("/meeting/{meeting_id}")
def get_meeting(meeting_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not configured")
    try:
        resp = (
            supabase
            .table("MeetingNotes")
            .select("id,audio_url,transcript,summary,created_at")
            .eq("id", meeting_id)
            .limit(1)
            .execute()
        )
        data = getattr(resp, "data", []) or []
        item = data[0] if isinstance(data, list) and len(data) > 0 else None
        if not item:
            raise HTTPException(status_code=404, detail="Meeting not found")
        return {"item": item}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch meeting: {e}")


@app.post("/process-meeting")
def process_meeting(payload: ProcessMeetingPayload):
    # Validate Supabase configuration slightly; we'll attempt the insert and surface RLS errors if any
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not configured; set SUPABASE_URL and SUPABASE_SERVICE_KEY in backend/.env.")

    def parse_supabase_public_url(url: str):
        try:
            u = urlparse(url)
            if "supabase.co" in u.netloc and "/storage/v1/object/public/" in u.path:
                remainder = u.path.split("/storage/v1/object/public/", 1)[1]
                parts = remainder.split("/", 1)
                if len(parts) == 2:
                    bucket, object_path = parts[0], parts[1]
                    return bucket, object_path
        except Exception:
            return None
        return None

    def download_audio(url: str):
        # Support data URLs: data:audio/<type>;base64,<data>
        if url.startswith("data:"):
            try:
                header, b64 = url.split(",", 1)
                ct_match = re.search(r"data:([^;]+)", header)
                ct = ct_match.group(1) if ct_match else ""
                return base64.b64decode(b64), ct
            except Exception:
                return b"", ""
        # Use Supabase Storage API for public URLs when possible
        supa_parsed = parse_supabase_public_url(url)
        if supa_parsed and supabase:
            bucket, object_path = supa_parsed
            try:
                file_bytes = supabase.storage.from_(bucket).download(object_path)
                # Infer content-type from extension
                ext = os.path.splitext(object_path)[1].lower()
                ct_guess = {
                    ".m4a": "audio/mp4",
                    ".mp4": "audio/mp4",
                    ".mp3": "audio/mpeg",
                    ".wav": "audio/wav",
                    ".ogg": "audio/ogg",
                    ".webm": "audio/webm",
                    ".flac": "audio/flac",
                }.get(ext, "")
                if file_bytes:
                    return file_bytes, ct_guess
            except Exception:
                # Fall through to HTTP fetch
                pass
        headers = {
            "Accept": "*/*",
            "User-Agent": "inperson-meeting-notes/1.0",
        }
        try:
            resp = requests.get(url, timeout=30, allow_redirects=True, headers=headers)
            resp.raise_for_status()
            return resp.content, resp.headers.get("Content-Type", "")
        except Exception:
            # Try HEAD to inspect content-type then GET again
            try:
                head = requests.head(url, timeout=15, allow_redirects=True, headers=headers)
                ct = head.headers.get("Content-Type", "")
                # Supabase public objects can benefit from ?download=1
                if "supabase.co/storage" in url and "download=1" not in url:
                    url2 = url + ("&download=1" if "?" in url else "?download=1")
                    resp2 = requests.get(url2, timeout=30, allow_redirects=True, headers=headers)
                    resp2.raise_for_status()
                    return resp2.content, resp2.headers.get("Content-Type", ct)
                # Final attempt
                resp3 = requests.get(url, timeout=30, allow_redirects=True, headers=headers)
                resp3.raise_for_status()
                return resp3.content, resp3.headers.get("Content-Type", ct)
            except Exception:
                return b"", ""

    audio_bytes, content_type = download_audio(payload.audio_url)
    if not audio_bytes:
        # Fail fast: avoid meaningless processing
        raise HTTPException(status_code=400, detail="Audio URL did not return any bytes. Provide a direct audio file URL or a Supabase storage public URL.")

    # Infer extension from URL or Content-Type for Whisper formatting
    def infer_ext(url: str, ct: str) -> str:
        path = urlparse(url).path
        # Strip query params and get extension
        _, ext = os.path.splitext(path)
        ext = (ext or "").lower()
        if ext in {".flac", ".m4a", ".mp3", ".mp4", ".mpeg", ".mpga", ".oga", ".ogg", ".wav", ".webm"}:
            return ext
        # Map content types to extensions
        ct_map = {
            "audio/flac": ".flac",
            "audio/mp4": ".m4a",
            "audio/mpeg": ".mp3",
            "audio/mp3": ".mp3",
            "audio/wav": ".wav",
            "audio/ogg": ".ogg",
            "audio/webm": ".webm",
        }
        for k, v in ct_map.items():
            if ct.startswith(k):
                return v
        return ".mp3"  # default fallback
    audio_ext = infer_ext(payload.audio_url, content_type)

    # 2) Transcribe (OpenAI Whisper if available, else mock)
    transcript = None
    if openai_client and audio_bytes and (content_type.startswith("audio/") or audio_ext in {".flac", ".m4a", ".mp3", ".mp4", ".mpeg", ".mpga", ".oga", ".ogg", ".wav", ".webm"}):
        try:
            with tempfile.NamedTemporaryFile(suffix=audio_ext, delete=True) as tmp:
                tmp.write(audio_bytes)
                tmp.flush()
                with open(tmp.name, "rb") as f:
                    tr = openai_client.audio.transcriptions.create(
                        model="whisper-1",
                        file=f,
                    )
                    transcript = tr.text
        except Exception as e:
            transcript = f"Transcription failed: {e}"
    if not transcript:
        transcript = f"[mock transcript] {len(audio_bytes)} bytes processed."

    # 3) Summarize (OpenAI if available, else heuristic)
    summary = None
    if openai_client:
        try:
            resp = openai_client.responses.create(
                model="gpt-4o-mini",
                input=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that writes concise meeting summaries with key decisions and action items.",
                    },
                    {"role": "user", "content": f"Summarize the following transcript in 5-7 bullet points:\n\n{transcript}"},
                ],
            )
            summary = resp.output_text
        except Exception as e:
            summary = f"Summary failed: {e}"
    if not summary:
        # Simple heuristic fallback
        summary = transcript[:500] + ("…" if len(transcript) > 500 else "")

    # 4) Update DB (service role bypasses RLS)
    meeting_table = "MeetingNotes"
    meeting_id = payload.meeting_id
    data = {
        "audio_url": payload.audio_url,
        "transcript": transcript,
        "summary": summary,
    }
    try:
        # Always insert; let DB generate UUID. Ignore client-provided meeting_id if present.
        inserted = supabase.table(meeting_table).insert(data).execute()
        try:
            meeting_id = inserted.data[0]["id"]
        except Exception:
            meeting_id = payload.meeting_id or ""
    except PostgrestAPIError as e:
        msg = str(e).lower()
        code = getattr(e, "code", None)
        if code == "42501" or "row-level security" in msg:
            raise HTTPException(status_code=500, detail="Supabase RLS blocked insert. Use SUPABASE_SERVICE_KEY (service role) or relax policies on MeetingNotes.")
        raise HTTPException(status_code=500, detail=f"Supabase insert failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase insert failed: {e}")

    # 5) Send push notification (Expo)
    deep_link = f"inpersonmeetingnotes://meeting/{meeting_id}"
    messages = []
    if payload.push_token:
        messages.append({
            "to": payload.push_token,
            "title": "Transcript ready",
            "body": "Tap to view the meeting",
            "data": {"url": deep_link},
        })

    if messages:
        requests.post(EXPO_PUSH_URL, json=messages, timeout=10)

    return {"ok": True, "meeting_id": meeting_id}
