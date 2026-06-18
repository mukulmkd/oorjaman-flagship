import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationAudience, NotificationEventRow } from "@oorjaman/api";
import {
  countUnreadInAppNotifications,
  listInAppNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  parseInAppNotificationPayload,
  queryKeys,
  subscribeInAppNotifications,
  unsubscribeNotificationChannel,
} from "@oorjaman/api";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@oorjaman/api";
import {
  isNotificationSoundMuted,
  playNotificationChime,
  setNotificationSoundMuted,
} from "./notification-sound";

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < 60) return "Just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export type NotificationCenterItem = {
  id: string;
  eventType: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  readAt: string | null;
  relativeTime: string;
};

function toItem(row: NotificationEventRow): NotificationCenterItem {
  const parsed = parseInAppNotificationPayload(row.payload);
  return {
    id: row.id,
    eventType: row.event_type,
    title: parsed?.title ?? row.event_type,
    body: parsed?.body ?? "",
    href: parsed?.href ?? null,
    createdAt: row.created_at,
    readAt: row.read_at,
    relativeTime: formatRelativeTime(row.created_at),
  };
}

export function useNotificationCenter(
  supabase: SupabaseClient<Database> | null,
  audience: NotificationAudience,
  vendorId?: string | null,
) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(() => isNotificationSoundMuted(audience));
  const seenIdsRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

  const inboxKey = queryKeys.bookings.notificationInbox(audience);
  const unreadKey = queryKeys.bookings.notificationUnreadCount(audience);

  const inboxQuery = useQuery({
    queryKey: inboxKey,
    enabled: Boolean(supabase),
    queryFn: async () => {
      if (!supabase) return [];
      const rows = await listInAppNotifications(supabase, { audience, limit: 50 });
      return rows.map(toItem);
    },
    staleTime: 60_000,
    refetchInterval: open ? false : 120_000,
  });

  const unreadQuery = useQuery({
    queryKey: unreadKey,
    enabled: Boolean(supabase),
    queryFn: async () => {
      if (!supabase) return 0;
      return countUnreadInAppNotifications(supabase, audience);
    },
    staleTime: 45_000,
    refetchInterval: 90_000,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: inboxKey });
    void queryClient.invalidateQueries({ queryKey: unreadKey });
  }, [queryClient, inboxKey, unreadKey]);

  const onRealtimeInsert = useCallback(
    (row: NotificationEventRow) => {
      if (seenIdsRef.current.has(row.id)) return;
      seenIdsRef.current.add(row.id);
      if (primedRef.current && !soundMuted && !row.read_at) {
        playNotificationChime();
      }
      invalidate();
    },
    [invalidate, soundMuted],
  );

  useEffect(() => {
    if (!supabase) return;
    const rows = inboxQuery.data ?? [];
    for (const r of rows) seenIdsRef.current.add(r.id);
    if (inboxQuery.isSuccess && !primedRef.current) {
      primedRef.current = true;
    }
  }, [supabase, inboxQuery.data, inboxQuery.isSuccess]);

  useEffect(() => {
    if (!supabase) return;
    const channel = subscribeInAppNotifications(supabase, {
      audience,
      vendorId: audience === "vendor" ? vendorId : null,
      onInsert: onRealtimeInsert,
    });
    return () => unsubscribeNotificationChannel(supabase, channel);
  }, [supabase, audience, vendorId, onRealtimeInsert]);

  const markRead = useCallback(
    async (id: string) => {
      if (!supabase) return;
      await markNotificationRead(supabase, id);
      invalidate();
    },
    [supabase, invalidate],
  );

  const markAllRead = useCallback(async () => {
    if (!supabase) return;
    await markAllNotificationsRead(supabase, audience);
    invalidate();
  }, [supabase, audience, invalidate]);

  const toggleSound = useCallback(() => {
    setSoundMuted((prev) => {
      const next = !prev;
      setNotificationSoundMuted(audience, next);
      return next;
    });
  }, [audience]);

  return {
    open,
    setOpen,
    items: inboxQuery.data ?? [],
    unreadCount: unreadQuery.data ?? 0,
    loading: inboxQuery.isLoading,
    soundMuted,
    toggleSound,
    markRead,
    markAllRead,
    refresh: invalidate,
  };
}
