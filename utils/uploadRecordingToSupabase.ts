import { supabase } from "@/lib/supabase";
import { toByteArray } from "base64-js";
import * as FileSystem from "expo-file-system/legacy";
import { getSupabaseSession } from "./getSupabaseSession";
import { transcribeRecording } from "./transcribeRecording";

export const uploadRecordingToSupabase = async (recordingUri: string) => {
  // Read the recorded file as base64 and convert to bytes
  const base64 = await FileSystem.readAsStringAsync(recordingUri, {
    encoding: "base64",
  });
  const bytes = toByteArray(base64);

  // Infer extension and content type from URI
  const extMatch = recordingUri.match(/\.([a-z0-9]+)$/i);
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : ".m4a";
  const contentTypeMap: Record<string, string> = {
    ".m4a": "audio/mp4",
    ".mp4": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".aac": "audio/aac",
    ".3gp": "audio/3gpp",
    ".caf": "audio/x-caf",
  };
  const contentType = contentTypeMap[ext] ?? "application/octet-stream";

  // Use Uint8Array directly; Supabase accepts ArrayBufferView
  const fileBody = bytes;

  const sessionData = await getSupabaseSession();

  const fileName = `${sessionData.session?.user.id}/${Date.now()}${ext}`;

  const { error } = await supabase.storage
    .from("recordings")
    .upload(fileName, fileBody, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error("Error uploading recording:", error);
    return null;
  }

  const publicUrl = supabase.storage.from("recordings").getPublicUrl(fileName)
    .data.publicUrl;

  transcribeRecording(publicUrl);

  return publicUrl;
};
