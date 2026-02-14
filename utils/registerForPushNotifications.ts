import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

let cachedToken: string | null = null;

export async function getPushTokenAsync(): Promise<string | null> {
  try {
    const isDev = process.env.NODE_ENV !== "production";
    if (!Device.isDevice) {
      console.log("Push notifications require a physical device.");
      return null;
    }

    // Android: ensure we have a default channel matching Manifest meta-data
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("recording", {
        name: "Recording",
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      if (isDev)
        console.log("[Push] Android notification channel 'recording' ensured.");
    }

    // Request permissions (Android 13+ requires POST_NOTIFICATIONS)
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (isDev)
      console.log(
        `[Push] Permission status -> existing: ${existingStatus}, final: ${finalStatus}`,
      );
    if (finalStatus !== "granted") {
      console.warn("Notification permission not granted");
      return null;
    }

    if (cachedToken) return cachedToken;

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? "";

    // Only pass projectId if it's a valid UUID; otherwise omit it.
    const isValidUuid =
      typeof projectId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        projectId,
      );
    if (isDev)
      console.log(
        `[Push] Resolved projectId: ${projectId ?? "<undefined>"} (valid: ${isValidUuid})`,
      );

    const options = isValidUuid ? { projectId } : undefined;

    const pushTokenString = (
      await Notifications.getExpoPushTokenAsync(options as any)
    ).data;

    if (isDev)
      console.log(
        `[Push] Expo push token: ${pushTokenString ? pushTokenString : "<null>"}`,
      );

    cachedToken = pushTokenString ?? null;
    return cachedToken;
  } catch (e) {
    console.warn("Failed to register for push notifications:", e);
    return null;
  }
}
