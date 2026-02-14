import {
  getMeetingDetails,
  getMeetingList,
  MeetingItem,
} from "@/services/Meeting";
import { useQuery } from "@tanstack/react-query";

export const keys = {
  meetingList: "meetingList" as const,
  meetinDetails: "meetingDetails" as const,
};

export const defaultQueryOptions = {
  staleTime: 16 * 60 * 1000,
  refetchOnMount: false,
  gcTime: 30000,
  refetchOnReconnect: false,
  retry: 3,
};

export const useGetMeetingList = () => {
  return useQuery<MeetingItem[], Error>({
    queryKey: [keys.meetingList],
    queryFn: getMeetingList,
    ...defaultQueryOptions,
  });
};

export const useGetMeetingDetails = (meetingId: string) => {
  return useQuery<MeetingItem, Error>({
    queryKey: [keys.meetinDetails, meetingId],
    queryFn: () => getMeetingDetails(meetingId),
    ...defaultQueryOptions,
  });
};
