import { useGetMeetingList } from "@/queries/MeetingQueries";
import { Link } from "expo-router";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type MeetingNote = {
  id: string;
  audio_url?: string | null;
  transcript?: string | null;
  summary?: string | null;
  created_at?: string | null;
};

export default function Meetings() {
  const {
    data: items,
    isFetching: loading,
    isRefetching: refreshing,
    refetch,
  } = useGetMeetingList();

  const onRefresh = useCallback(async () => {
    refetch();
  }, [refetch]);

  const renderItem = ({ item }: { item: MeetingNote }) => {
    const title =
      item.summary?.trim() ||
      item.transcript?.slice(0, 80) ||
      item.audio_url ||
      item.id;
    return (
      <Link
        href={{ pathname: "/meeting/[id]", params: { id: item.id } }}
        asChild
      >
        <TouchableOpacity style={styles.card}>
          <Text style={styles.title}>{`Meeting # ${item.id}`}</Text>
          <Text numberOfLines={2}>{title}</Text>
          {item.created_at ? (
            <Text style={styles.meta}>
              {new Date(item.created_at).toLocaleString()}
            </Text>
          ) : null}
        </TouchableOpacity>
      </Link>
    );
  };

  if (loading && !items?.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.meta}>Loading meetings…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.container}>
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={() => (
            <View style={styles.center}>
              <Text style={styles.meta}>No meetings yet.</Text>
            </View>
          )}
          contentContainerStyle={
            items?.length === 0 ? styles.flexGrow : undefined
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#ecf0f1",
    padding: 10,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecf0f1",
  },
  error: {
    color: "#B00020",
    marginBottom: 8,
  },
  card: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  meta: {
    color: "#666",
    marginTop: 4,
  },
  separator: {
    height: 1,
    backgroundColor: "#eee",
  },
  flexGrow: {
    flexGrow: 1,
  },
});
