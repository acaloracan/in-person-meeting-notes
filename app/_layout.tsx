import { keys } from "@/queries/MeetingQueries";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import "react-native-reanimated";

export const unstable_settings = {
  anchor: "(tabs)",
};

// Show a simple alert when a notification arrives in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const queryClient = new QueryClient();

export default function RootLayout() {
  const router = useRouter();

  React.useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("[Push] Received:", notification.request.content);
        queryClient.invalidateQueries({ queryKey: [keys.meetingList] });
      },
    );

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        try {
          const data = response?.notification?.request?.content?.data as any;
          const url: string | undefined = data?.url;
          if (url) {
            // Try to route via expo-router if it's our scheme
            const match = url.match(/\/meeting\/(.+)$/i);
            const id = match?.[1];
            if (id) {
              router.push(`/meeting/${id}`);
              return;
            }
            // Fallback: open the deep link directly
            await Linking.openURL(url);
          }
        } catch (e) {
          console.warn("[Push] Failed to handle notification response:", e);
        }
      },
    );

    // Handle cold-start when app opened from a notification
    (async () => {
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last) {
        const data = last?.notification?.request?.content?.data as any;
        const url: string | undefined = data?.url;
        if (url) {
          const match = url.match(/\/meeting\/(.+)$/i);
          const id = match?.[1];
          if (id) {
            router.replace(`/meeting/${id}`);
          } else {
            await Linking.openURL(url);
          }
        }
      }
    })();

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
