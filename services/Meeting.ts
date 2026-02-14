import { getSupabaseSession } from "@/utils/getSupabaseSession";
import axios from "axios";

export const getMeetingList = async () => {
  try {
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";

    const { data } = await axios.get(`${backendUrl}/meetings`);

    return data.items;
  } catch (error) {
    throw error;
  }
};

export const getMeetingDetails = async (meetingId: string) => {
  try {
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";
    const { data } = await axios.get(`${backendUrl}/meetings/${meetingId}`, {});
    return data;
  } catch (error) {
    throw error;
  }
};

export type MeetingItem = {
  id: string;
  title: string | null;
  audio_url: string | null;
  transcript: string | null;
  summary: string | null;
  created_at: string | null;
};

export type ProcessMeetingPayload = {
  audioUrl: string;
  pushToken: string | null;
};

export const processMeeting = async ({
  audioUrl,
  pushToken,
}: ProcessMeetingPayload) => {
  try {
    const sessionData = await getSupabaseSession();
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionData.session?.access_token}`,
    };
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";

    const { data } = await axios.post(
      `${backendUrl}/process-meeting`,
      {
        audio_url: audioUrl,
        meeting_id: Date.now().toString(),
        push_token: pushToken ?? null,
      },
      { headers },
    );

    return data;
  } catch (error) {
    throw error;
  }
};
