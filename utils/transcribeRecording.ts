import { processMeeting } from "@/services/Meeting";
import { getPushTokenAsync } from "./registerForPushNotifications";

export const transcribeRecording = async (audioUrl: string) => {
  try {
    const pushToken = await getPushTokenAsync();
    await processMeeting({
      audioUrl: audioUrl,
      pushToken: pushToken,
    });
  } catch (e) {
    console.error("Error calling backend /process-meeting:", e);
    throw e;
  }
};
