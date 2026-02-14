import { useLocalSearchParams, useNavigation } from "expo-router";
import React, { useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type MeetingItem = {
  id: string;
  audio_url: string | null;
  transcript: string | null;
  summary: string | null;
  created_at: string | null;
};

export default function Meeting() {
  const params = useLocalSearchParams<{ id?: string }>();
  const meetingId = (params?.id ?? "").toString();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: meetingId ? `Meeting ${meetingId}` : "Meeting",
    });
  }, [meetingId, navigation]);

  const [meeting, setMeeting] = useState<MeetingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (!meetingId) {
          throw new Error("No meeting id provided");
        }
        const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";
        if (backendUrl) {
          try {
            const resp = await fetch(`${backendUrl}/meeting/${meetingId}`);
            if (resp.ok) {
              const json = await resp.json();
              if (json?.item && isMounted) {
                setMeeting(json.item as MeetingItem);
                return;
              }
            }
          } catch (e) {
            // Ignore and fallback
            throw new Error(
              "Failed to load from backend, falling back to Supabase",
            );
          }
        }
      } catch (e: any) {
        if (isMounted) setError(e?.message ?? "Failed to load meeting");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [meetingId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading meeting…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Unable to load meeting</Text>
        <Text style={styles.muted}>{error}</Text>
      </View>
    );
  }

  if (!meeting) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>No meeting data available.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Meeting {meeting.id}</Text>
      {meeting.created_at ? (
        <Text style={styles.muted}>
          Created: {new Date(meeting.created_at).toLocaleString()}
        </Text>
      ) : null}

      {meeting.summary ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.body}>{meeting.summary}</Text>
        </View>
      ) : null}

      {meeting.transcript ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transcript</Text>
          <Text style={styles.mono}>{meeting.transcript}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // justifyContent: "center",
    backgroundColor: "#ecf0f1",
    padding: 10,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#ecf0f1",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
  },
  mono: {
    fontSize: 14,
    lineHeight: 20,
  },
  link: {
    color: "#2563eb",
  },
  muted: {
    color: "#6b7280",
    marginTop: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
});
