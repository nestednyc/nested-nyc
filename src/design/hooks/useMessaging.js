/* ============================================================
   useMessaging — the entire DM domain: inbox + blocks, the open
   thread (load / paginate / optimistic send / retry / discard),
   the three realtime channels (dm-self ping, dm-readsync,
   dm-receipts), and block / delete-conversation.

   Domain-hook pattern: NestedApp stays the composition root — it
   injects the cross-domain deps (profile, people, route+setRoute,
   the messageThreadHandle URL param, toast, requireAuth) and wires
   the returns into the same screens/props as before. Hooks never
   import each other; anything cross-domain arrives as an argument.

   Two deliberate seams stay in the root:
   - Initial hydration: the signed-in Promise.all barrier loads the
     inbox + block list alongside every other surface — that's why
     setInbox / setBlocked are exposed.
   - resetMessaging() is signOut's wipe of this domain. It must stay
     complete: the open thread holds DECRYPTED message bodies and the
     stash holds unsent draft text + files, none of which may survive
     an account switch on a shared machine.
   ============================================================ */
import React from 'react'
import { isSupabaseConfigured, authService, supabase } from '../../lib/supabase'
import { messageService, newId } from '../../services/messageService'
import { profileService } from '../../services/profileService'
import { toPerson } from '../peopleAdapter'
import { enrichConversations, upsertMessage, mergeThread, bumpInboxRow } from '../messageAdapter'

const { useState, useEffect, useRef } = React;

export function useMessaging({
  profile, people,
  route, setRoute,
  messageThreadHandle, setMessageThreadHandle,
  toast, requireAuth,
}) {
  const [inbox, setInbox] = useState([]);
  // Peers I've blocked (id Set), hydrated from messageService.getMyBlocks().
  // Block is DM-only — it gates new DMs both ways but keeps the connection +
  // profile; the thread/profile read this to render Block vs Unblock.
  const [blocked, setBlocked] = useState(new Set());
  // Open DM thread: messages for the active peer (chronological), its load
  // status, and the peer's display identity (name/avatar/handle).
  const [thread, setThread] = useState([]);
  const [threadStatus, setThreadStatus] = useState("loading");
  const [threadPeer, setThreadPeer] = useState(null);
  // Load-older pagination: whether an older page may exist + an in-flight flag.
  const [threadHasMore, setThreadHasMore] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  // The per-conversation Realtime broadcast channel for live read receipts (and
  // a natural home for typing later). { ch, peerId } — see the dm-receipts effect.
  const dmReceiptRef = useRef(null);
  // Failed/unsent optimistic messages stashed per peerId so a thread switch
  // doesn't lose the user's typed text + picked files (re-merged on reopen).
  const pendingByPeerRef = useRef(new Map());
  // Self-scoped read-sync broadcast channel (dm-readsync:<myId>) so reading a
  // thread in one tab clears its unread badge in this user's other tabs live.
  const readSyncRef = useRef(null);
  // Latest auto-retry fn (a ref so the realtime effect's resync can call it with
  // fresh state) — re-sends transient-failed sends in the open thread on reconnect.
  const autoRetryRef = useRef(null);
  // Ids the user Removed while a send/retry might still be in flight — the deliver
  // success path checks this so a racing success can't resurrect a discarded bubble.
  const discardedRef = useRef(new Set());
  const [confirmBlock, setConfirmBlock] = useState(null); // {id, handle, name} pending block, or null
  const [confirmDelete, setConfirmDelete] = useState(null); // {id, handle, name} pending delete-conversation, or null
  // Which peer's DM thread is open right now (or null). The realtime handler +
  // resync below subscribe once per session, so they read the open peer from
  // this ref rather than re-binding the channel. Driven imperatively by the
  // thread-fetch effect (not a [route, threadPeer] sync effect) so it never
  // lags the open conversation — a one-tick lag would let a ping splice the
  // previous peer's messages into the new thread.
  const openPeerIdRef = useRef(null);

  // ─── REALTIME: direct messages ──────────────────────────────────────────
  // A self-scoped channel for DMs. The INSERT row's body is ciphertext
  // (Option B — encrypted at rest), so realtime is only a PING: we never read
  // the payload body, we refetch through the decrypting RPC, which is the
  // source of truth. If the sender's thread is open we merge the message in;
  // otherwise we refresh the inbox (unread badge + decrypted preview). On a
  // reconnect (a repeat SUBSCRIBED after a drop) or tab refocus we resync both,
  // so anything missed while the socket was down isn't lost. Self-sends never
  // echo here (the filter is recipient_id=me), and the refetches dedup by id,
  // so there are no duplicate bubbles. No-op in mock mode.
  useEffect(() => {
    if (!profile || !profile.id || !isSupabaseConfigured() || !supabase) return;
    let channel;
    let readChannel = null;
    let cancelled = false;
    let subscribedOnce = false;
    // Coalesce bursts: while a refetch is in flight, mark it dirty and fire
    // exactly once more on completion — N rapid pings collapse to ≤2 RPCs per
    // stream, and the last (freshest) fetch always wins.
    let inboxInFlight = false, inboxDirty = false;
    let threadInFlight = false, threadDirty = false;

    async function refetchInbox() {
      if (inboxInFlight) { inboxDirty = true; return; }
      inboxInFlight = true;
      try {
        const { data } = await messageService.getInbox();
        if (cancelled || !data) return;
        const open = openPeerIdRef.current;   // never resurrect the badge on the thread you're reading
        setInbox(open ? data.map((r) => (r.peerId === open ? { ...r, unreadCount: 0 } : r)) : data);
      } finally {
        inboxInFlight = false;
        if (inboxDirty && !cancelled) { inboxDirty = false; refetchInbox(); }
      }
    }

    async function refetchOpenThread() {
      const pid = openPeerIdRef.current;
      if (!pid) return;
      if (threadInFlight) { threadDirty = true; return; }
      threadInFlight = true;
      try {
        const { data } = await messageService.getThread(pid);
        if (cancelled || !data) return;
        if (openPeerIdRef.current !== pid) return;   // switched threads mid-fetch → drop this result
        setThread((cur) => mergeThread(cur, data.slice().reverse()));
        pruneDeliveredFromStash(pid, data);   // an id now delivered is no longer "failed" — drop any stale stash copy so it can't resurrect
        messageService.markThreadRead(pid);
        signalRead(pid, data[0] && data[0].createdAt);   // live "Seen" to the sender (server time)
        signalReadSync(pid);   // clear this peer's unread in my other tabs
        const newest = data[0];   // get_thread is newest-first
        if (newest) setInbox((rows) => bumpInboxRow(rows, pid,
          { lastBody: newest.body, lastAt: newest.createdAt, lastFromMe: newest.fromMe, read: true, lastHasAttachment: !!(newest.attachments && newest.attachments.length) }));
      } finally {
        threadInFlight = false;
        // Re-fire for whichever thread is open now (not the stale pid): a ping
        // that landed mid-fetch — possibly after a peer switch — must still be
        // serviced. refetchOpenThread re-reads the peer and re-guards post-await.
        if (threadDirty && !cancelled && openPeerIdRef.current) { threadDirty = false; refetchOpenThread(); }
      }
    }

    async function resync() { await refetchInbox(); await refetchOpenThread(); if (autoRetryRef.current) autoRetryRef.current(); }
    function onVisible() { if (document.visibilityState === "visible") resync(); }

    (async () => {
      const { data } = await authService.getSession();
      if (cancelled) return;
      const token = data && data.session && data.session.access_token;
      if (token) await supabase.realtime.setAuth(token);
      if (cancelled) return;
      channel = supabase
        .channel("dm-self-" + profile.id)
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "messages",
          filter: "recipient_id=eq." + profile.id,
        }, (payload) => {
          const senderId = payload.new && payload.new.sender_id;   // body_enc is ciphertext — never read it
          if (senderId && senderId === openPeerIdRef.current) refetchOpenThread();
          else refetchInbox();
        })
        .subscribe((status) => {
          // A repeat SUBSCRIBED = the socket dropped and rejoined → resync to
          // pull anything missed. Errors/timeouts: let the client auto-rejoin.
          if (status === "SUBSCRIBED") { if (subscribedOnce) resync(); subscribedOnce = true; }
        });
      // Cross-tab read-sync: when THIS user reads a thread in another tab, that
      // tab broadcasts here so we clear the same peer's unread badge live.
      readChannel = supabase.channel("dm-readsync:" + profile.id, { config: { broadcast: { self: false } } });
      readChannel.on("broadcast", { event: "read" }, ({ payload }) => {
        const pid = payload && payload.peerId;
        if (pid) setInbox((rows) => rows.map((r) => (r.peerId === pid ? { ...r, unreadCount: 0 } : r)));
      });
      readChannel.subscribe();
      readSyncRef.current = readChannel;
    })();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", resync);   // browser regained connectivity → pull missed messages + auto-retry transient-failed sends
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", resync);
      if (channel) supabase.removeChannel(channel);
      if (readChannel) supabase.removeChannel(readChannel);
      readSyncRef.current = null;
    };
  }, [profile && profile.id]);

  // Load the open thread on /messages/:username: resolve the handle to a peer
  // (in-memory People list first, else fetch by username), fetch the
  // conversation (get_thread is newest-first → reverse to chronological), then
  // mark it read and clear this peer's unread from the inbox badge.
  useEffect(() => {
    openPeerIdRef.current = null;   // no thread open until one resolves below (also clears on nav away)
    if (route !== "messageThread" || !messageThreadHandle || !profile || !profile.id) return;
    if (!isSupabaseConfigured()) { setThreadStatus("error"); return; }
    const wanted = messageThreadHandle.toLowerCase();
    let cancelled = false;
    (async () => {
      setThreadStatus("loading");
      setThread([]);   // drop the previous peer's bubbles before merging this one's (URL/popstate path doesn't clear)
      setThreadHasMore(false);   // reset pagination for the new peer
      let peer = (threadPeer && threadPeer.handle && threadPeer.handle.toLowerCase() === wanted) ? threadPeer : null;
      if (!peer) {
        const found = people.find((p) => p.handle && p.handle.toLowerCase() === wanted);
        if (found) peer = { id: found.id, handle: found.handle, name: found.name, avatar: found.avatar };
      }
      if (!peer) {
        const { data } = await profileService.getByUsername(messageThreadHandle);
        if (cancelled) return;
        if (data) { const p = toPerson(data); peer = { id: p.id, handle: p.handle, name: p.name, avatar: p.avatar }; }
      }
      if (cancelled) return;
      if (!peer || !peer.id) { setThreadStatus("missing"); return; }
      setThreadPeer(peer);
      openPeerIdRef.current = peer.id;   // realtime pings for this peer now refetch into the open thread
      const { data: msgs, error } = await messageService.getThread(peer.id);
      if (cancelled) return;
      if (error) { setThreadStatus("error"); return; }
      setThread((cur) => mergeThread(cur, (msgs || []).slice().reverse()));   // merge, not replace — a ping mid-load isn't clobbered
      pruneDeliveredFromStash(peer.id, msgs);   // drop stash entries already delivered so they can't re-overwrite a confirmed bubble as "failed"
      // Restore any genuinely failed/unsent bubbles stashed for this peer (a failed
      // send before a thread switch) so the user can still see + retry them.
      const stashed = pendingByPeerRef.current.get(peer.id);
      if (stashed && stashed.length) setThread((cur) => mergeThread(cur, stashed));
      setThreadStatus("ready");
      setThreadHasMore((msgs || []).length >= 50);   // a full page back → there may be older messages
      messageService.markThreadRead(peer.id);
      signalRead(peer.id, (msgs && msgs[0]) ? msgs[0].createdAt : null);   // tell the peer their messages are now seen (server time)
      signalReadSync(peer.id);   // clear this peer's unread in my other tabs
      setInbox((rows) => rows.map((r) => (r.peerId === peer.id ? { ...r, unreadCount: 0 } : r)));
    })();
    return () => { cancelled = true; };
  }, [route, messageThreadHandle, profile && profile.id]);

  // ─── Live read receipts (broadcast) ─────────────────────────────────────
  // A per-conversation broadcast channel carries an ephemeral "I've read up to
  // <t>" ping so the SENDER's bubbles flip to "Seen" instantly — without
  // streaming DB UPDATEs (the messages publication stays INSERT-only). The
  // persistent read_at remains the source of truth for unread counts; this is
  // purely live UI. Keyed to the sorted id-pair so both participants share one
  // channel. Modular: delete this block and "Seen" simply falls back to
  // updating on the next thread refetch — nothing else breaks.
  useEffect(() => {
    if (route !== "messageThread" || !threadPeer || !threadPeer.id || !profile || !profile.id || !isSupabaseConfigured() || !supabase) return;
    const peerId = threadPeer.id;
    const pair = [profile.id, peerId].slice().sort().join(":");
    const ch = supabase.channel("dm-receipts:" + pair, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "read" }, ({ payload }) => {
      if (!payload || payload.by !== peerId) return;
      const at = payload.at;
      setThread((t) => t.map((m) => (m.fromMe && !m.readAt && (!at || m.createdAt <= at)) ? { ...m, readAt: at || new Date().toISOString() } : m));
    });
    ch.subscribe();
    dmReceiptRef.current = { ch, peerId };
    return () => { dmReceiptRef.current = null; supabase.removeChannel(ch); };
  }, [route, threadPeer && threadPeer.id, profile && profile.id]);

  // Block is DM-only: the server gate stops new DMs both ways, but the
  // connection + profile stay and unblock fully restores messaging. Optimistic
  // Set update with revert-on-failure (mirrors onConnect). Block runs behind a
  // confirm; unblock is non-destructive, so it's immediate.
  function requestBlock(peer) {
    if (!profile) return requireAuth("Sign in to manage messages");
    if (!peer || !peer.id) return;
    setConfirmBlock({ id: peer.id, handle: peer.handle, name: peer.name });
  }
  async function blockPeerNow() {
    const peer = confirmBlock;
    setConfirmBlock(null);
    if (!peer || !peer.id) return;
    setBlocked((s) => new Set(s).add(peer.id));
    toast("Blocked" + (peer.handle ? " @" + peer.handle : ""), "block");
    if (!isSupabaseConfigured()) return;
    const { error } = await messageService.blockUser(peer.id);
    if (error) {
      setBlocked((s) => { const n = new Set(s); n.delete(peer.id); return n; });
      toast("Couldn't block — " + (error.message || "try again"), "x");
    }
  }
  async function unblockPeer(peer) {
    if (!peer || !peer.id) return;
    setBlocked((s) => { const n = new Set(s); n.delete(peer.id); return n; });
    toast("Unblocked" + (peer.handle ? " @" + peer.handle : ""), "check");
    if (!isSupabaseConfigured()) return;
    const { error } = await messageService.unblockUser(peer.id);
    if (error) {
      setBlocked((s) => new Set(s).add(peer.id));
      toast("Couldn't unblock — " + (error.message || "try again"), "x");
    }
  }
  // Delete conversation (S8) is delete-FOR-ME: the server sets a per-user clear
  // watermark, so the thread leaves my inbox/thread while the peer keeps their
  // copy, and it reappears if they message me again. Behind a confirm (it hides
  // history); optimistic inbox removal + leave the thread, revert on failure.
  function requestDeleteConversation(peer) {
    if (!profile) return requireAuth("Sign in to manage messages");
    if (!peer || !peer.id) return;
    setConfirmDelete({ id: peer.id, handle: peer.handle, name: peer.name });
  }
  async function deleteConversationNow() {
    const peer = confirmDelete;
    setConfirmDelete(null);
    if (!peer || !peer.id) return;
    const prevInbox = inbox;   // snapshot for revert-on-failure
    setInbox((rows) => rows.filter((r) => r.peerId !== peer.id));
    if (route === "messageThread") { setThread([]); setRoute("messages"); window.scrollTo({ top: 0 }); }
    pendingByPeerRef.current.delete(peer.id);   // drop any failed/unsent bubbles for this peer so they can't resurrect on reopen
    toast("Conversation deleted", "check");
    if (!isSupabaseConfigured()) return;
    const { error } = await messageService.deleteConversation(peer.id);
    if (error) {
      setInbox(prevInbox);
      toast("Couldn't delete — " + (error.message || "try again"), "x");
    }
  }

  // Open a 1:1 thread. `target` is an inbox conversation ({peerId,handle,…}) or
  // a person ({id,handle,…}); both normally carry a handle (peers are
  // connections → in the People list). The handle drives the URL; the thread
  // effect resolves it to the peer id for get_thread. The rare no-handle case
  // (peer absent from People) resolves via getPublicProfile first.
  function openThread(target) {
    if (!profile) return requireAuth("Sign in to message");
    if (!target) return;
    const pid = target.id || target.peerId;
    if (!pid) return;
    const go = (peer) => {
      setThreadPeer(peer);
      setMessageThreadHandle(peer.handle);
      setThread([]);
      setThreadStatus("loading");
      setRoute("messageThread");
      window.scrollTo({ top: 0 });
    };
    if (target.handle) {
      go({ id: pid, handle: target.handle, name: target.name || "Student", avatar: target.avatar || null });
      return;
    }
    if (!isSupabaseConfigured()) { toast("Couldn't open that conversation", "x"); return; }
    profileService.getPublicProfile(pid).then(({ data }) => {
      if (!data || !data.username) { toast("Couldn't open that conversation", "x"); return; }
      const p = toPerson(data);
      go({ id: p.id, handle: p.handle, name: p.name, avatar: p.avatar });
    });
  }

  // Optimistic send: append a pending bubble immediately (client-supplied id),
  // then reconcile it with the stored row on confirm (same id) or drop it on
  // failure. Also refresh this peer's inbox row so the list stays correct
  // without a refetch (live sync is S6).
  function sendThreadMessage(body, files = []) {
    const peer = threadPeer;
    const text = (body || "").trim();
    const list = Array.isArray(files) ? files : [];
    if (!peer || !peer.id || (!text && !list.length)) return;
    deliverThreadMessage(newId(), peer, text, list);
  }
  // Re-send a failed message with the SAME id (idempotent server-side). Reuses
  // the original File objects AND any attachments that already uploaded on the
  // first attempt (m._metas) so the retry doesn't re-upload them.
  function retryThreadMessage(m) {
    if (!m || !m.id || !threadPeer) return;
    setThread((t) => t.map((x) => (x.id === m.id ? { ...x, failed: false, pending: true } : x)));
    // Mark the stash entry in-flight (_autoRetried) so a concurrent reconnect
    // auto-retry can't ALSO re-send the same id while this manual retry is pending.
    // If this attempt re-fails, fail() rebuilds the entry with _autoRetried:false,
    // re-arming one automatic retry on the next reconnect.
    const inflight = (pendingByPeerRef.current.get(threadPeer.id) || []).map((x) => (x.id === m.id ? { ...x, _autoRetried: true } : x));
    pendingByPeerRef.current.set(threadPeer.id, inflight);
    deliverThreadMessage(m.id, threadPeer, m.body || "", m._files || [], m._metas || null);
  }
  // Remove a FAILED (optimistic, never-persisted) message from the thread + the
  // per-peer stash. Guarded to failed bubbles ONLY — a delivered message can never
  // be removed here, and its bubble never renders the Remove control.
  function discardFailedMessage(m) {
    if (!m || !m.id || !m.failed) return;
    discardedRef.current.add(m.id);   // if a send/retry for this id is mid-flight, its success must not resurrect the bubble
    (m.attachments || []).forEach((a) => { if (a && a.url && a.url.startsWith("blob:")) { try { URL.revokeObjectURL(a.url); } catch (e) {} } });
    setThread((t) => t.filter((x) => x.id !== m.id));
    const peerId = threadPeer && threadPeer.id;
    if (peerId) {
      const arr = (pendingByPeerRef.current.get(peerId) || []).filter((x) => x.id !== m.id);
      if (arr.length) pendingByPeerRef.current.set(peerId, arr); else pendingByPeerRef.current.delete(peerId);
    }
  }
  // A message whose id now appears as a CONFIRMED (delivered) server row is no
  // longer "failed" — drop any stale per-peer stash entry for it so a false-failure
  // (committed server-side, but the HTTP response was lost) can't resurrect a
  // delivered message as a "Failed to send" bubble on the next thread reopen.
  function pruneDeliveredFromStash(peerId, serverRows) {
    if (!peerId) return;
    const arr = pendingByPeerRef.current.get(peerId);
    if (!arr || !arr.length) return;
    const delivered = new Set((serverRows || []).map((r) => r && r.id));
    const next = arr.filter((x) => !delivered.has(x.id));
    if (next.length === arr.length) return;
    if (next.length) pendingByPeerRef.current.set(peerId, next); else pendingByPeerRef.current.delete(peerId);
  }
  // Auto-retry on reconnect/refocus (called from the realtime resync): re-send the
  // OPEN thread's TRANSIENT-failed bubbles ONCE. The idempotent id + reused
  // _files/_metas mean a re-send can't duplicate; _autoRetried gates it to a single
  // attempt so a flapping network can't loop. Permanent failures (rate-limit /
  // blocked / validation) are skipped — they stay as manual Retry.
  function autoRetryFailed() {
    const peer = threadPeer;
    if (!peer || !peer.id || openPeerIdRef.current !== peer.id) return;
    const targets = (pendingByPeerRef.current.get(peer.id) || []).filter((m) => m.failed && m._autoRetryable && !m._autoRetried && !discardedRef.current.has(m.id));
    for (const m of targets) {
      const arr = (pendingByPeerRef.current.get(peer.id) || []).map((x) => (x.id === m.id ? { ...x, _autoRetried: true } : x));
      pendingByPeerRef.current.set(peer.id, arr);
      setThread((t) => t.map((x) => (x.id === m.id ? { ...x, failed: false, pending: true, _autoRetried: true } : x)));
      deliverThreadMessage(m.id, peer, m.body || "", m._files || [], m._metas || null, { autoRetried: true });
    }
  }
  autoRetryRef.current = autoRetryFailed;   // keep the ref on the latest closure so resync sees fresh thread state
  // Shared send pipeline (first attempt + retry): optimistic pending bubble →
  // upload any attachments to Storage → send_message → reconcile or mark failed.
  // A failed send is STASHED per peer (pendingByPeerRef) so its text + files
  // survive a thread switch and re-merge on reopen. `preMetas` (retry only) are
  // attachment rows that already uploaded, so we skip re-uploading them.
  async function deliverThreadMessage(id, peer, text, files, preMetas, opts) {
    const at = new Date().toISOString();
    const fileList = files || [];
    const optimisticAtts = fileList.map((f) => ({
      name: f.name, mime: f.type, size: f.size,
      url: (f.type || "").startsWith("image/") ? URL.createObjectURL(f) : null,
    }));
    const blobUrls = optimisticAtts.map((a) => a.url).filter((u) => u && u.startsWith("blob:"));
    // A retry mints fresh preview blob URLs; free the PRIOR attempt's stashed ones
    // for this id so each retry doesn't leak an object URL.
    const prior = (pendingByPeerRef.current.get(peer.id) || []).find((x) => x.id === id);
    if (prior) (prior.attachments || []).forEach((a) => { if (a && a.url && a.url.startsWith("blob:")) { try { URL.revokeObjectURL(a.url); } catch (e) {} } });
    const optimisticRow = { id, peerId: peer.id, fromMe: true, body: text, createdAt: at, readAt: null, pending: true, failed: false, attachments: optimisticAtts, _files: fileList };
    setThread((t) => upsertMessage(t, optimisticRow));
    if (!isSupabaseConfigured()) return;

    // Mark failed, keep the bubble (its preview blob URL stays alive for retry),
    // and stash it under this peer so a thread switch doesn't lose it. keepMetas
    // is passed ONLY when every attachment already uploaded (the SEND failed) so
    // a retry can skip re-uploading; an upload failure forces a full re-upload.
    // keepMetas: passed only on a SEND failure (all uploads done) so a retry can
    // skip re-uploading. err drives auto-retry classification: a TRANSIENT failure
    // (network / no SQLSTATE / PT500 server fault) is eligible for one automatic
    // retry on reconnect; PERMANENT ones (PT401/403/422/429 — auth, blocked,
    // validation, rate-limit) stay manual-only.
    const fail = (keepMetas, err) => {
      const autoRetryable = !err || !err.code || err.code === "PT500";
      const failedRow = { ...optimisticRow, pending: false, failed: true, _metas: keepMetas, _autoRetryable: autoRetryable, _autoRetried: !!(opts && opts.autoRetried) };
      setThread((t) => t.map((m) => (m.id === id ? failedRow : m)));
      const map = pendingByPeerRef.current;
      const arr = (map.get(peer.id) || []).filter((x) => x.id !== id);
      arr.push(failedRow);
      map.set(peer.id, arr);
    };

    // Upload attachments first (own-folder Storage write), unless a retry already
    // carries them. A per-file index keeps same-named files from colliding.
    let metas = Array.isArray(preMetas) ? preMetas : [];
    if (!metas.length && fileList.length) {
      for (let i = 0; i < fileList.length; i++) {
        const { data: meta, error: upErr } = await messageService.uploadAttachment(fileList[i], id, i);
        if (upErr) { fail(undefined, upErr); toast(upErr.message || "Couldn't upload that file", "x"); return; }
        metas.push(meta);
      }
    }

    const { data, error } = await messageService.sendMessage(peer.id, text, id, metas);
    if (error) { fail(metas, error); toast(error.message || "Couldn't send message", "x"); return; }
    // Success: drop the per-peer stash entry and free the optimistic blob URLs.
    const map = pendingByPeerRef.current;
    const left = (map.get(peer.id) || []).filter((x) => x.id !== id);
    if (left.length) map.set(peer.id, left); else map.delete(peer.id);
    blobUrls.forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) {} });
    // The user tapped Remove on this bubble while the send was mid-flight: honor it
    // (don't resurrect the bubble locally) even though it reached the server.
    if (discardedRef.current.has(id)) { discardedRef.current.delete(id); return; }
    // Only reconcile the OPEN thread's bubbles if we're still on this peer — a
    // mid-send peer switch (setThread([]) ran for the new peer) must not splice
    // this confirmed message into another conversation. The inbox bump is keyed
    // by peer.id, so it stays correct regardless of what's open.
    if (openPeerIdRef.current === peer.id) {
      setThread((t) => upsertMessage(t, { ...data, pending: false, failed: false }));
    }
    setInbox((rows) => bumpInboxRow(rows, peer.id, { lastBody: text, lastAt: data.createdAt, lastFromMe: true, read: true, lastHasAttachment: metas.length > 0 }));
  }
  // Fetch an older page of the open thread (keyset on the oldest confirmed
  // message) and prepend it. hasMore stays true while a full page comes back.
  async function loadEarlierThread() {
    if (loadingEarlier || !threadPeer || !threadPeer.id) return;
    const oldest = thread.find((m) => !m.pending && !m.failed);
    if (!oldest) return;
    setLoadingEarlier(true);
    const { data, error } = await messageService.getThread(threadPeer.id, oldest.createdAt, 50);
    setLoadingEarlier(false);
    if (error) { toast("Couldn't load earlier messages", "x"); return; }
    const older = (data || []).slice().reverse();   // newest-first → chronological
    if (openPeerIdRef.current === threadPeer.id) setThread((cur) => mergeThread(cur, older));
    setThreadHasMore((data || []).length >= 50);
  }
  // Live read-receipt signal — tell the open peer "I've read up to now" so their
  // sent bubbles flip to "Seen" instantly (the dm-receipts broadcast channel).
  function signalRead(peerId, at) {
    const c = dmReceiptRef.current;
    if (c && c.peerId === peerId && c.ch && profile) {
      // `at` is the newest SERVER created_at the reader has loaded (not a client
      // wall clock) so the sender's createdAt<=at gate compares server-time to
      // server-time — clock skew can't suppress the Seen flip. Null → flip all.
      c.ch.send({ type: "broadcast", event: "read", payload: { by: profile.id, at: at || null } });
    }
  }
  // Tell THIS user's OTHER tabs a thread was just read so their unread badge for
  // that peer clears live (the dm-self stream is INSERT-only — a read in one tab
  // is otherwise invisible to siblings until the next hydration/focus).
  function signalReadSync(peerId) {
    const ch = readSyncRef.current;
    if (ch && peerId) { try { ch.send({ type: "broadcast", event: "read", payload: { peerId } }); } catch (e) {} }
  }

  // signOut's wipe of this domain — the exact resets the old inline signOut
  // performed. Must clear the open thread (decrypted bodies) and the failed-send
  // stash (unsent draft text + files) so nothing survives an account switch.
  function resetMessaging() {
    setInbox([]);
    setThread([]);
    setThreadPeer(null);
    setBlocked(new Set());
    pendingByPeerRef.current = new Map();
    discardedRef.current = new Set();
  }

  // Inbox rows joined with the People list for each peer's display identity
  // (see enrichConversations in messageAdapter). unreadMessages drives the
  // header chat dot + mobile badge.
  const conversations = enrichConversations(inbox, people);
  const unreadMessages = inbox.reduce((n, r) => n + (r.unreadCount || 0), 0);

  return {
    // block list + the inbox setter (exposed for the root hydration barrier);
    // raw inbox stays internal — consumers read the derived conversations
    setInbox, blocked, setBlocked, conversations, unreadMessages,
    // open thread
    thread, threadStatus, threadPeer, threadHasMore, loadingEarlier,
    // pending confirms (block / delete-conversation modals)
    confirmBlock, setConfirmBlock, confirmDelete, setConfirmDelete,
    // actions
    openThread, sendThreadMessage, retryThreadMessage, discardFailedMessage,
    loadEarlierThread, requestBlock, blockPeerNow, unblockPeer,
    requestDeleteConversation, deleteConversationNow, resetMessaging,
  };
}
