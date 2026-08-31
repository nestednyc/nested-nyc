/* ============================================================
   useNotifications — the persisted activity feed behind the bell:
   likes, comments, @mentions and (for org owners) new followers.
   Loads once per signed-in identity, stays live over a Realtime
   channel on my own rows, and marks itself read when the bell
   panel / notifications page is seen. The two legacy kinds
   (incoming connections, join requests) stay derived in usePeople /
   useProjects — this hook never touches them.

   Domain-hook pattern: NestedApp injects `uid` (profile.id, or the
   org owner's uid) + toast; resetNotifications() is this domain's
   slice of signOut's wipe.
   ============================================================ */
import React from 'react'
import { supabase, isSupabaseConfigured, authService } from '../../lib/supabase'
import { notificationService } from '../../services/notificationService'
import { fromDbNotification, notificationText } from '../notificationAdapter'

const { useState, useEffect, useRef } = React;

export function useNotifications({ uid, toast }) {
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const loadedFor = useRef(null);

  async function loadActivity() {
    if (!uid || !isSupabaseConfigured()) return;
    setActivityLoading(true);
    const { data, error } = await notificationService.list();
    setActivityLoading(false);
    if (error) { toast("Couldn't load notifications — try again", "x"); return; }
    setActivity(data.map(fromDbNotification).filter(Boolean));
  }

  // First load per identity + a live channel on my own rows. RLS hides every
  // row unless the socket carries the JWT (same recipe as tm-self / dm-self).
  useEffect(() => {
    if (!uid || !isSupabaseConfigured() || !supabase) return;
    if (loadedFor.current !== uid) { loadedFor.current = uid; loadActivity(); }
    let channel;
    let cancelled = false;
    (async () => {
      const { data } = await authService.getSession();
      if (cancelled) return;
      const token = data && data.session && data.session.access_token;
      if (token) await supabase.realtime.setAuth(token);
      if (cancelled) return;
      channel = supabase
        .channel("notif-self-" + uid)
        .on("postgres_changes", {
          event: "*", schema: "public", table: "notifications",
          filter: "user_id=eq." + uid,
        }, (payload) => {
          if (payload.eventType === "DELETE") {
            // A post / comment came down and its notifications cascaded away
            // (REPLICA IDENTITY FULL carries user_id so the filter matches).
            const gone = payload.old && payload.old.id;
            if (gone) setActivity((list) => list.filter((x) => x.id !== gone));
            return;
          }
          if (payload.eventType !== "INSERT") return;
          const n = fromDbNotification(payload.new);
          if (!n) return;
          setActivity((list) => (list.some((x) => x.id === n.id) ? list : [n, ...list]));
          // Likes are quiet; anything that needs a reply pings.
          if (n.kind !== "post_like") toast(notificationText(n), "bell");
        })
        .subscribe();
    })();
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, [uid]);

  const unreadActivity = activity.reduce((n, a) => n + (a.read ? 0 : 1), 0);

  // Seen = read. Optimistic; the server flip is best-effort (a failure just
  // leaves the dot for next time).
  async function markActivityRead() {
    if (!unreadActivity) return;
    setActivity((list) => list.map((a) => (a.read ? a : { ...a, read: true })));
    if (!isSupabaseConfigured()) return;
    await notificationService.markAllRead();
  }

  function resetNotifications() {
    setActivity([]);
    setActivityLoading(false);
    loadedFor.current = null;
  }

  return { activity, activityLoading, unreadActivity, loadActivity, markActivityRead, resetNotifications };
}
