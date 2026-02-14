import { uploadRecordingToSupabase } from "@/utils/uploadRecordingToSupabase";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import React, { useEffect } from "react";
import { Alert, Button, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  const [elapsedMs, setElapsedMs] = React.useState(0);
  const startAtRef = React.useRef<number | null>(null);

  const record = async () => {
    await audioRecorder.prepareToRecordAsync();
    startAtRef.current = Date.now();
    setElapsedMs(0);
    audioRecorder.record();
  };

  const stopRecording = async () => {
    await audioRecorder.stop();
    startAtRef.current = null;
    setElapsedMs(0);
    if (audioRecorder.uri) {
      await uploadRecordingToSupabase(audioRecorder.uri);
    }
  };

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert("Permission to access microphone was denied");
      }

      setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
    })();
  }, []);

  useEffect(() => {
    if (recorderState.isRecording) {
      if (!startAtRef.current) startAtRef.current = Date.now();
      const id = setInterval(() => {
        const start = startAtRef.current ?? Date.now();
        setElapsedMs(Date.now() - start);
      }, 200);
      return () => clearInterval(id);
    } else {
      startAtRef.current = null;
      setElapsedMs(0);
    }
  }, [recorderState.isRecording]);

  const formatTime = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const mm = String(Math.floor(total / 60)).padStart(2, "0");
    const ss = String(total % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.timerRow}>
        <View
          style={[styles.dot, recorderState.isRecording && styles.dotActive]}
        />
        <Text style={styles.timerText}>{formatTime(elapsedMs)}</Text>
      </View>
      <Text style={styles.statusText}>
        {recorderState.isRecording ? "Recording…" : "Ready to record"}
      </Text>
      <View style={styles.buttons}>
        <Button
          title={
            recorderState.isRecording ? "Stop Recording" : "Start Recording"
          }
          onPress={recorderState.isRecording ? stopRecording : record}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#ecf0f1",
    padding: 16,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#9ca3af",
    marginRight: 8,
  },
  dotActive: {
    backgroundColor: "#ef4444",
  },
  timerText: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 1,
  },
  statusText: {
    textAlign: "center",
    color: "#6b7280",
    marginBottom: 16,
  },
  buttons: {
    paddingHorizontal: 32,
  },
});
