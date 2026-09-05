/* ============================================================
   NESTED NYC — Notification adapter (Supabase ⇄ bell shape)
   Pure transform for `notifications` rows (migration 20260831000000).
   The actor is a snapshot (name/handle/avatar) written by the DB
   triggers; personLabel keeps the @handle-first precedence.
   ============================================================ */
import { personLabel } from "./data";

export const NOTIF_KINDS = ["post_like", "post_comment", "comment_reply", "mention", "org_follow", "org_join_request", "org_join_accepted", "org_join_rejected"];

export function fromDbNotification(row) {
  if (!row || !row.id) return null;
  return {
    id: row.id,
    kind: NOTIF_KINDS.includes(row.kind) ? row.kind : "post_like",
    actor: {
      id: row.actor_id || null,
      name: personLabel({ username: row.actor_handle, firstName: row.actor_name }, "Someone"),
      handle: row.actor_handle || "",
      avatar: row.actor_avatar || "",
    },
    postId: row.post_id || null,
    commentId: row.comment_id || null,
    orgId: row.org_id || null,
    snippet: row.snippet || "",
    read: !!row.read_at,
    at: row.created_at,
  };
}

// Likes on the same post collapse into one row ("@maya and 2 others liked
// your post"): newest row wins the slot, `others` counts the rest, and the
// row reads as unread if any of them is. Everything else passes through.
export function groupActivity(list) {
  const out = [];
  const likeSlot = new Map(); // postId → index in out
  for (const n of list || []) {
    if (n.kind === "post_like" && n.postId) {
      const i = likeSlot.get(n.postId);
      if (i === undefined) {
        likeSlot.set(n.postId, out.length);
        out.push({ ...n, others: 0, ids: [n.id] });
      } else {
        const g = out[i];
        out[i] = { ...g, others: g.others + 1, read: g.read && n.read, ids: [...g.ids, n.id] };
      }
    } else {
      out.push({ ...n, others: 0, ids: [n.id] });
    }
  }
  return out;
}

// The one-line sentence the bell shows for a notification.
export function notificationText(n) {
  const who = n.actor.name + (n.others ? (n.others === 1 ? " and 1 other" : " and " + n.others + " others") : "");
  switch (n.kind) {
    case "post_like":    return who + " liked your post";
    case "post_comment": return who + " commented on your post";
    case "comment_reply": return who + " replied to your comment";
    case "mention":      return who + " mentioned you";
    case "org_follow":   return who + " followed " + (n.snippet || "your org");
    case "org_join_request":  return who + " applied to join " + (n.snippet || "your org");
    case "org_join_accepted": return (n.snippet || who) + " accepted you — you're a member";
    case "org_join_rejected": return (n.snippet || who) + " passed on your application this time";
    default:             return who;
  }
}
