/* ============================================================
   NESTED NYC — Community board
   The shared feed: notes pinned by students AND by orgs — words +
   photos, optionally tagged with one of a student's projects — with
   a KIND on every note (update / win / looking for) so the board
   scans, orgs' upcoming events merged in as cards you can RSVP to,
   one club in the spotlight, and a rail of the people and asks
   worth a look. Org posts carry the org's name/logo, the verified
   tick, and a Follow pill; every note names the school it came from.
   The board is one list — no filter chips; saved posts live on /saved
   (SavedPosts, exported below).
   Presentational; all state and handlers arrive as props
   (useCommunity via the api bag). Cork-board vocabulary only.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { CAT, UNI, ETYPE, isProjectAdmin } from './data'
import { Av, Skeleton, ConfirmModal, formatEventDate } from './shared'
import { POST_BODY_MAX, POST_IMAGES_MAX } from '../services/communityService'
import { postTimeAgo } from './postAdapter'
import { JoinPill } from './clubJoin'

  const { useState, useRef, useEffect } = React;

  function firstPhoto(photos) {
    if (!Array.isArray(photos)) return null;
    for (const p of photos) {
      const url = typeof p === "string" ? p : (p && p.src);
      if (url) return url;
    }
    return null;
  }

  // What a note is for. Students pick Update / Win / Looking for; orgs pick
  // Update / Looking for / Event (Event doesn't post — it opens the event
  // form, and the event lands on the board as a card from the events table).
  const STUDENT_KINDS = [
    { id: "update", label: "Update", icon: "pencil" },
    { id: "win", label: "Win", icon: "sparkle" },
    { id: "ask", label: "Looking for", icon: "users" },
  ];
  const ORG_KINDS = [
    { id: "update", label: "Update", icon: "pencil" },
    { id: "ask", label: "Looking for", icon: "users" },
    { id: "event", label: "Event", icon: "calendar" },
  ];
  const PLACEHOLDER = {
    update: "What are you working on? A work-in-progress, a photo, what you shipped today…",
    win: "What did you ship, land, or finish? A photo helps.",
    ask: "Who or what are you looking for? Tag the project so people can jump straight in.",
    orgUpdate: "Post an update as %s — a recap, a photo from the last meetup, what's coming…",
    orgAsk: "Who does %s need — photographers, volunteers, new members? Say what and when.",
  };

  // Projects a student can tag in a note: the ones they lead (owner / co-lead)
  // and the ones they're on as crew. Mirrors the DB's can_tag_project().
  function taggableProjects(projects, profile, joined) {
    if (!profile) return [];
    const j = joined || new Set();
    return (projects || []).filter((p) => isProjectAdmin(p, profile) || j.has(p.id));
  }

  // The colored label that says why a note is on the board.
  function Kicker({ kind, hasProject, spot }) {
    let cls = null, label = null, icon = null;
    if (spot) { cls = "k-spot"; label = "Club spotlight"; icon = "sparkle"; }
    else if (kind === "win") { cls = "k-win"; label = "Win"; icon = "sparkle"; }
    else if (kind === "ask") { cls = "k-ask"; label = "Looking for"; icon = "users"; }
    else if (kind === "event") { cls = "k-event"; label = "Event"; icon = "calendar"; }
    else if (hasProject) { cls = "k-update"; label = "Project update"; icon = "pencil"; }
    if (!cls) return null;
    return React.createElement("span", { className: "com-kicker " + cls },
      React.createElement(Icon, { name: icon, size: 11, stroke: "currentColor" }), label);
  }

  // ── Composer: the blank note at the top of the board ──────────────
  function Composer({ identity, myProjects, posting, onCreatePost, asOrg, onCreateEvent, preset, onPresetConsumed, onStart }) {
    const [body, setBody] = useState("");
    const [kind, setKind] = useState("update");
    const [files, setFiles] = useState([]); // File objects, ≤4
    const [previews, setPreviews] = useState([]); // object URLs, same order
    const [projectId, setProjectId] = useState("");
    const fileRef = useRef(null);
    const inputRef = useRef(null);

    // Arriving from a flyer's "Post to the board": that project is already
    // tagged and the cursor is in the box. Consumed once.
    useEffect(() => {
      if (!preset || !preset.projectId) return;
      if (myProjects.some((p) => p.id === preset.projectId)) setProjectId(preset.projectId);
      if (preset.kind) setKind(preset.kind);
      if (inputRef.current) inputRef.current.focus();
      onPresetConsumed && onPresetConsumed();
    }, [preset && preset.projectId, preset && preset.nonce]);

    function addFiles(list) {
      const incoming = Array.from(list || []).filter((f) => f.type && f.type.indexOf("image/") === 0);
      if (!incoming.length) return;
      const room = POST_IMAGES_MAX - files.length;
      const take = incoming.slice(0, Math.max(0, room));
      setFiles((f) => [...f, ...take]);
      setPreviews((p) => [...p, ...take.map((f) => URL.createObjectURL(f))]);
    }
    function removeFile(i) {
      URL.revokeObjectURL(previews[i]);
      setFiles((f) => f.filter((_, j) => j !== i));
      setPreviews((p) => p.filter((_, j) => j !== i));
    }
    async function submit() {
      if (posting) return;
      const res = await onCreatePost({ body, files, projectId: projectId || null, kind });
      if (res && res.ok) {
        previews.forEach((u) => URL.revokeObjectURL(u));
        setBody(""); setFiles([]); setPreviews([]); setProjectId(""); setKind("update");
        if (fileRef.current) fileRef.current.value = "";
      }
    }
    function pickKind(k) {
      if (k === "event") { onCreateEvent && onCreateEvent(); return; }
      setKind(k);
    }
    const canPost = !posting && (body.trim().length > 0 || files.length > 0);
    const kinds = asOrg ? ORG_KINDS : STUDENT_KINDS;
    const placeholder = asOrg
      ? (kind === "ask" ? PLACEHOLDER.orgAsk : PLACEHOLDER.orgUpdate).replace("%s", identity.name)
      : PLACEHOLDER[kind];

    return (
      React.createElement("div", { className: "com-composer" },
        React.createElement("div", { className: "com-composer-row" },
          React.createElement(Av, { name: identity.name || "?", img: identity.img || null }),
          React.createElement("textarea", {
            ref: inputRef,
            className: "com-input", rows: 2,
            placeholder,
            value: body, maxLength: POST_BODY_MAX,
            onChange: (e) => setBody(e.target.value),
          })
        ),
        React.createElement("div", { className: "com-kinds", role: "group", "aria-label": "What kind of note" },
          kinds.map((k) => React.createElement("button", {
            key: k.id, type: "button",
            className: "com-kind" + (kind === k.id ? " on" : "") + (k.id === "event" ? " ev" : ""),
            "aria-pressed": k.id === "event" ? undefined : kind === k.id,
            onClick: () => pickKind(k.id),
          }, React.createElement(Icon, { name: k.icon, size: 13, stroke: "currentColor" }), k.label))
        ),
        previews.length > 0 && React.createElement("div", { className: "com-previews" },
          previews.map((src, i) => (
            React.createElement("div", { className: "com-preview", key: src },
              React.createElement("img", { src, alt: "" }),
              React.createElement("button", { className: "com-preview-x", onClick: () => removeFile(i), "aria-label": "Remove image" },
                React.createElement(Icon, { name: "x", size: 12 }))
            )
          ))
        ),
        React.createElement("div", { className: "com-composer-foot" },
          React.createElement("button", {
            className: "com-tool", type: "button",
            onClick: () => fileRef.current && fileRef.current.click(),
            disabled: files.length >= POST_IMAGES_MAX,
          }, React.createElement(Icon, { name: "image", size: 17 }), "Photos"),
          React.createElement("input", {
            ref: fileRef, type: "file", accept: "image/*", multiple: true,
            style: { display: "none" },
            onChange: (e) => { addFiles(e.target.files); e.target.value = ""; },
          }),
          // Tag a project you're on (lead, co-lead or crew). With none, the
          // control still shows — it just points at pinning a flyer first.
          !asOrg && (myProjects.length > 0
            ? React.createElement("select", {
                className: "com-project-select" + (projectId ? " on" : ""),
                value: projectId, "aria-label": "Tag a project",
                onChange: (e) => setProjectId(e.target.value),
              },
                React.createElement("option", { value: "" }, kind === "ask" ? "Which project?" : "Tag a project…"),
                myProjects.map((p) => React.createElement("option", { key: p.id, value: p.id }, p.title.split(" — ")[0]))
              )
            : React.createElement("button", { className: "com-tool com-tagchip", type: "button", onClick: onStart, title: "Pin a flyer first, then tag it in your posts" },
                React.createElement(Icon, { name: "board", size: 15 }), "Tag a project · pin one first")),
          asOrg && React.createElement("span", { className: "com-meta" }, "Posting as your org · students see the stamp"),
          React.createElement("button", { className: "btn btn-primary com-post-btn", disabled: !canPost, onClick: submit },
            React.createElement(Icon, { name: "send", size: 15, stroke: "var(--paper)" }),
            posting ? "Posting…" : "Post")
        )
      )
    );
  }

  // Follow / Following pill (students only; never on your own org's post).
  function FollowPill({ on, onClick, small }) {
    return React.createElement("button", {
      className: "com-follow" + (on ? " on" : ""),
      onClick, type: "button",
      "aria-pressed": on,
    },
      React.createElement(Icon, { name: on ? "check" : "plus", size: small ? 12 : 13, stroke: on ? "var(--paper)" : "currentColor" }),
      on ? "Following" : "Follow");
  }

  // ⋯ menu on a note: Edit / Copy link / Delete on mine, Copy link / Report on
  // everyone else's. `items` = [{ label, icon, onClick, disabled, danger }].
  function PostMenu({ items }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
      if (!open) return;
      const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
      const key = (e) => { if (e.key === "Escape") setOpen(false); };
      document.addEventListener("mousedown", close);
      document.addEventListener("keydown", key);
      return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); };
    }, [open]);
    return React.createElement("div", { className: "com-menu-wrap", ref },
      React.createElement("button", { className: "com-del", onClick: () => setOpen((o) => !o), "aria-label": "More options", "aria-haspopup": "menu", "aria-expanded": open, type: "button" },
        React.createElement(Icon, { name: "ellipsis", size: 16 })),
      open && React.createElement("div", { className: "com-menu", role: "menu" },
        items.map((it) => React.createElement("button", {
          key: it.label, role: "menuitem", type: "button", disabled: !!it.disabled,
          className: it.danger ? "danger" : "",
          onClick: () => { setOpen(false); it.onClick && it.onClick(); },
        }, React.createElement(Icon, { name: it.icon, size: 14 }), it.label)))
    );
  }

  // The permalink for a note — copied to the clipboard from the ⋯ menu.
  function postUrl(id) {
    return window.location.origin + "/community/" + encodeURIComponent(id);
  }
  async function copyPostLink(id, toast) {
    try {
      await navigator.clipboard.writeText(postUrl(id));
      toast && toast("Link copied", "check");
    } catch {
      toast && toast("Couldn't copy — the link is " + postUrl(id), "x");
    }
  }

  // The CTA on a "looking for" note — the door from the board into the
  // join-request flow (project tagged), a DM (no project), or the org page.
  function AskCta({ p, ask, viewerIsStudent, onRequestJoin, onOpenProject, onMessage, onOpenOrg }) {
    if (p.org) {
      return React.createElement("div", { className: "com-cta" },
        React.createElement("button", { className: "btn btn-primary btn-sm", onClick: () => p.org.slug && onOpenOrg && onOpenOrg(p.org.slug) },
          React.createElement(Icon, { name: "arrowRight", size: 14, stroke: "var(--paper)" }), "See the org"));
    }
    if (p.project) {
      // Joining a project is a student action (org seats have no join flow and
      // no project pages) — the tag alone stands for them.
      if (!viewerIsStudent || !onRequestJoin || !onOpenProject) return null;
      const state = ask ? ask.state : "missing";
      if (state === "admin") return null;
      if (state === "joined") return React.createElement("div", { className: "com-cta" },
        React.createElement("button", { className: "btn btn-primary btn-sm done", disabled: true },
          React.createElement(Icon, { name: "check", size: 14, stroke: "var(--paper)" }), "You're on the team"));
      if (state === "requested") return React.createElement("div", { className: "com-cta" },
        React.createElement("button", { className: "btn btn-ghost btn-sm", disabled: true },
          React.createElement(Icon, { name: "check", size: 14 }), "Requested"),
        React.createElement("span", { className: "com-meta" }, "The lead has your note."));
      if (state === "missing") return React.createElement("div", { className: "com-cta" },
        React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => onOpenProject(p.project.id) },
          React.createElement(Icon, { name: "arrowRight", size: 14 }), "See the flyer"));
      const roles = (ask.project.roles || []).filter((r) => r && r.open);
      return React.createElement("div", { className: "com-cta" },
        React.createElement("button", { className: "btn btn-primary btn-sm", onClick: () => onRequestJoin(ask.project) },
          React.createElement(Icon, { name: "heart", size: 14, stroke: "var(--paper)" }), "I'm interested"),
        roles.length > 0 && React.createElement("span", { className: "com-meta" },
          roles.length === 1 ? "Open role: " + roles[0].title : roles.length + " open roles"));
    }
    if (viewerIsStudent && p.authorHandle) {
      return React.createElement("div", { className: "com-cta" },
        React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => onMessage({ id: p.authorId, handle: p.authorHandle, name: p.author, avatar: p.authorAvatar || null }) },
          React.createElement(Icon, { name: "chat", size: 14 }), "Message " + p.author));
    }
    return null;
  }

  // ── One pinned note ───────────────────────────────────────────────
  function PostCard({
    p, mine, liked, savedOn, comments, profileId, viewerIsStudent, followed, membership, ask, reported,
    myProjects = [], asOrg, defaultOpen, toast, onJoin,
    onToggleLike, onToggleSave, onOpenProject, onOpenOrg, onOpenPerson, onToggleFollow, onOpenPost,
    onLoadComments, onAddComment, onDeleteComment, onAskDelete, onReport, onEditPost,
    onRequestJoin, onMessage,
  }) {
    const [open, setOpen] = useState(!!defaultOpen);
    const [text, setText] = useState("");
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(null); // { body, kind, projectId }
    const [saving, setSaving] = useState(false);
    const cat = p.project ? CAT[p.project.cat] : null;
    const uni = p.uni ? UNI[p.uni] : null;
    const org = p.org;

    // The permalink page opens with the thread expanded.
    useEffect(() => { if (defaultOpen) onLoadComments(p.id); }, [p.id]);

    function toggleComments() {
      const next = !open;
      setOpen(next);
      if (next) onLoadComments(p.id);
    }
    async function sendComment() {
      const res = await onAddComment(p.id, text);
      if (res && res.ok) setText("");
    }
    const openOrg = () => org && org.slug && onOpenOrg && onOpenOrg(org.slug);

    function startEdit() {
      setDraft({ body: p.body, kind: p.kind, projectId: p.project ? p.project.id : "" });
      setEditing(true);
    }
    async function saveEdit() {
      if (!draft || saving) return;
      if (!draft.body.trim() && !p.images.length) return;
      setSaving(true);
      const res = await onEditPost(p.id, { body: draft.body, kind: draft.kind, projectId: org ? null : (draft.projectId || null) });
      setSaving(false);
      if (res && res.ok) { setEditing(false); setDraft(null); }
    }
    const menuItems = mine
      ? [
          ...(onEditPost ? [{ label: "Edit", icon: "pencil", onClick: startEdit }] : []),
          { label: "Copy link", icon: "link", onClick: () => copyPostLink(p.id, toast) },
          { label: "Delete", icon: "trash", danger: true, onClick: () => onAskDelete(p.id) },
        ]
      : [
          { label: "Copy link", icon: "link", onClick: () => copyPostLink(p.id, toast) },
          { label: reported ? "Reported" : "Report post", icon: "flag", disabled: reported, onClick: () => onReport("post", p.id) },
        ];
    const editKinds = org ? ORG_KINDS.filter((k) => k.id !== "event") : STUDENT_KINDS;

    return (
      React.createElement("article", { className: "com-post" + (org ? " org" : "") + " kind-" + p.kind },
        // Org notes wear the campus cat-bar the flyers use, not a side stripe.
        org && React.createElement("div", { className: "cat-bar", style: { background: "var(--accent)" } }),
        React.createElement("header", { className: "com-post-head" },
          org
            ? React.createElement("button", { className: "com-avlink", onClick: openOrg, "aria-label": org.name, type: "button" },
                React.createElement(Av, { name: org.name, img: p.authorAvatar || null }))
            : React.createElement(Av, { name: p.author, img: p.authorAvatar || null }),
          React.createElement("div", { className: "com-who" },
            org
              ? React.createElement("span", { className: "nm" },
                  React.createElement("button", { className: "com-namebtn", onClick: openOrg, type: "button" }, org.name),
                  org.verified && React.createElement("span", { className: "com-org-tick", role: "img", "aria-label": "Verified org", title: "Verified .edu org" },
                    React.createElement(Icon, { name: "check", size: 10, stroke: "var(--paper)", width: 3 })))
              : React.createElement("span", { className: "nm" },
                  React.createElement("button", { className: "com-namebtn", onClick: () => p.authorHandle && onOpenPerson && onOpenPerson(p.authorHandle), type: "button" }, p.author),
                  p.isFirst && React.createElement("span", { className: "com-new-chip", title: "Their first post on the board" },
                    React.createElement(Icon, { name: "sparkle", size: 10, stroke: "currentColor" }), "New on the board")),
            React.createElement("span", { className: "com-meta" },
              uni && React.createElement("span", { className: "com-uni", title: uni.full }, uni.name),
              uni ? " · " : "",
              React.createElement("button", { className: "com-time", type: "button", title: "Open post", onClick: () => onOpenPost && onOpenPost(p.id) }, postTimeAgo(p.at)),
              p.editedAt ? " · edited" : "")
          ),
          org && !mine && viewerIsStudent && React.createElement("span", { className: "com-pills" },
            React.createElement(FollowPill, { on: followed, onClick: () => onToggleFollow(org.id) }),
            onJoin && React.createElement(JoinPill, { membership, onClick: () => onJoin(org) })),
          React.createElement(PostMenu, { items: menuItems })
        ),
        React.createElement(Kicker, { kind: editing && draft ? draft.kind : p.kind, hasProject: !!p.project }),
        editing && draft
          ? React.createElement("div", { className: "com-edit" },
              React.createElement("textarea", {
                className: "com-input", rows: 3, value: draft.body, maxLength: POST_BODY_MAX, autoFocus: true,
                onChange: (e) => setDraft((d) => ({ ...d, body: e.target.value })),
              }),
              React.createElement("div", { className: "com-kinds" },
                editKinds.map((k) => React.createElement("button", {
                  key: k.id, type: "button",
                  className: "com-kind" + (draft.kind === k.id ? " on" : ""),
                  onClick: () => setDraft((d) => ({ ...d, kind: k.id })),
                }, React.createElement(Icon, { name: k.icon, size: 13, stroke: "currentColor" }), k.label))),
              !org && myProjects.length > 0 && React.createElement("select", {
                className: "com-project-select", value: draft.projectId || "",
                onChange: (e) => setDraft((d) => ({ ...d, projectId: e.target.value })),
              },
                React.createElement("option", { value: "" }, "No project tag"),
                myProjects.map((pr) => React.createElement("option", { key: pr.id, value: pr.id }, pr.title.split(" — ")[0]))),
              React.createElement("div", { className: "com-edit-actions" },
                React.createElement("button", { className: "btn btn-ghost btn-sm", type: "button", onClick: () => { setEditing(false); setDraft(null); } }, "Cancel"),
                React.createElement("button", { className: "btn btn-primary btn-sm", type: "button", disabled: saving || (!draft.body.trim() && !p.images.length), onClick: saveEdit },
                  React.createElement(Icon, { name: "check", size: 14, stroke: "var(--paper)" }), saving ? "Saving…" : "Save"))
            )
          : p.body && React.createElement("p", { className: "com-body" }, p.body),
        p.images.length > 0 && React.createElement("div", { className: "com-imgs n" + Math.min(p.images.length, 4) },
          p.images.map((src, i) => React.createElement("img", {
            key: src, src, loading: "lazy",
            alt: i === 0 ? (p.body ? p.body.slice(0, 80) : "Photo from " + p.author) : "",
          }))
        ),
        // The project tag opens the flyer for students; the org seat has no flyer
        // pages, so there it's a plain label.
        p.project && React.createElement(onOpenProject ? "button" : "span", {
          className: "com-proj" + (onOpenProject ? "" : " static"),
          onClick: onOpenProject ? () => onOpenProject(p.project.id) : undefined,
          style: cat ? { color: cat.ink, background: cat.wash } : undefined,
        },
          cat && React.createElement(Icon, { name: CAT[p.project.cat].icon, size: 14, stroke: "currentColor" }),
          p.project.title.split(" — ")[0]
        ),
        p.kind === "ask" && !mine && React.createElement(AskCta, { p, ask, viewerIsStudent, onRequestJoin, onOpenProject, onMessage, onOpenOrg }),
        React.createElement("footer", { className: "com-actions" },
          React.createElement("button", { className: "com-act" + (liked ? " on" : ""), onClick: () => onToggleLike(p.id), "aria-pressed": liked, "aria-label": liked ? "Unlike" : "Like" },
            React.createElement(Icon, { name: "heart", size: 17 }), p.likes > 0 ? p.likes : ""),
          React.createElement("button", { className: "com-act", onClick: toggleComments, "aria-expanded": open, "aria-label": open ? "Hide comments" : "Comments" },
            React.createElement(Icon, { name: "chat", size: 17 }), p.commentCount > 0 ? p.commentCount : ""),
          React.createElement("button", { className: "com-act sv" + (savedOn ? " on" : ""), onClick: () => onToggleSave(p.id), style: { marginLeft: "auto" }, "aria-pressed": savedOn, "aria-label": savedOn ? "Remove from saved" : "Save" },
            React.createElement(Icon, { name: "bookmark", size: 17 }))
        ),
        open && React.createElement("div", { className: "com-comments" },
          comments && comments.loading && React.createElement("div", { className: "ev-skel line", style: { width: "55%" } }),
          comments && comments.list && comments.list.map((c) => (
            React.createElement("div", { className: "com-comment", key: c.id },
              React.createElement(Av, { name: c.author, img: c.authorAvatar || null }),
              React.createElement("div", { className: "com-comment-bubble" },
                React.createElement("b", null, c.author),
                React.createElement("span", null, c.body)
              ),
              (c.authorId === profileId || mine)
                ? React.createElement("button", { className: "com-del", onClick: () => onDeleteComment(p.id, c.id), "aria-label": "Delete comment" },
                    React.createElement(Icon, { name: "x", size: 12 }))
                : React.createElement("button", { className: "com-del com-flag", onClick: () => onReport("comment", c.id), "aria-label": "Report comment", title: "Report comment" },
                    React.createElement(Icon, { name: "flag", size: 12 }))
            )
          )),
          comments && comments.list && comments.list.length === 0 && React.createElement("div", { className: "com-meta", style: { padding: "6px 0" } }, "No comments yet."),
          React.createElement("div", { className: "com-comment-row" },
            React.createElement("input", {
              className: "com-comment-input", placeholder: "Add a comment…",
              value: text, maxLength: 1000,
              onChange: (e) => setText(e.target.value),
              onKeyDown: (e) => { if (e.key === "Enter" && text.trim()) sendComment(); },
            }),
            React.createElement("button", { className: "com-act", disabled: !text.trim(), onClick: sendComment },
              React.createElement(Icon, { name: "send", size: 16 }))
          )
        )
      )
    );
  }

  // ── An org's upcoming event, pinned as a card ─────────────────────
  // The going-count = the server's count, minus me if it already had me
  // (e.iWasGoing, from the query), plus me if I'm going now — exact whatever
  // order the RSVP set hydrates in.
  function EventCard({ e, going, viewerIsStudent, followed, onRsvp, onOpenEvent, onOpenOrg, onToggleFollow }) {
    const { mon, day, weekday } = formatEventDate(e.date);
    const ty = ETYPE[e.type] || ETYPE.talk;
    const org = e.org;
    const shown = Math.max(0, e.going - (e.iWasGoing ? 1 : 0) + (going ? 1 : 0));
    const asks = (e.questions || []).length;
    const openOrg = () => org && org.slug && onOpenOrg && onOpenOrg(org.slug);
    return (
      React.createElement("article", { className: "com-post com-event" + (org ? " org" : "") },
        // The date tile is the kicker here; the cat-bar carries the event type's color.
        React.createElement("div", { className: "cat-bar", style: { background: ty.color } }),
        React.createElement("header", { className: "com-post-head" },
          org
            ? React.createElement("button", { className: "com-avlink", onClick: openOrg, "aria-label": org.name, type: "button" },
                React.createElement(Av, { name: org.name, img: org.logo || null }))
            : React.createElement(Av, { name: e.orgName }),
          React.createElement("div", { className: "com-who" },
            React.createElement("span", { className: "nm" },
              org
                ? React.createElement("button", { className: "com-namebtn", onClick: openOrg, type: "button" }, org.name)
                : React.createElement("b", null, e.orgName),
              org && org.verified && React.createElement("span", { className: "com-org-tick", role: "img", "aria-label": "Verified org", title: "Verified .edu org" },
                React.createElement(Icon, { name: "check", size: 10, stroke: "var(--paper)", width: 3 }))),
            React.createElement("span", { className: "com-meta" },
              (e.uni && UNI[e.uni] ? UNI[e.uni].name + " · " : "") + "pinned an event " + postTimeAgo(e.at))
          ),
          org && viewerIsStudent && React.createElement(FollowPill, { on: followed, onClick: () => onToggleFollow(org.id) })
        ),
        React.createElement("div", { className: "com-ev" },
          React.createElement("button", { className: "com-ev-date", onClick: () => onOpenEvent(e.id), type: "button", "aria-label": "Open event" },
            React.createElement("span", { className: "mon" }, mon),
            React.createElement("span", { className: "day" }, day),
            React.createElement("span", { className: "wd" }, weekday.slice(0, 3))
          ),
          React.createElement("div", { className: "com-ev-main" },
            React.createElement("span", { className: "com-ev-type", style: { color: ty.ink, background: ty.wash } },
              React.createElement(Icon, { name: ty.icon, size: 12, stroke: "currentColor" }), ty.label),
            React.createElement("button", { className: "com-ev-title", onClick: () => onOpenEvent(e.id), type: "button" }, e.title),
            e.blurb && React.createElement("p", { className: "com-ev-blurb" }, e.blurb),
            React.createElement("div", { className: "com-ev-meta" },
              e.time && React.createElement("span", null, React.createElement(Icon, { name: "clock", size: 13 }), e.time),
              e.place && React.createElement("span", null, React.createElement(Icon, { name: "map", size: 13 }), e.place)
            )
          )
        ),
        React.createElement("footer", { className: "com-actions com-ev-foot" },
          React.createElement("span", { className: "com-meta" }, (shown === 1 ? "1 going" : shown + " going") + (asks && !going ? " · " + asks + (asks === 1 ? " question" : " questions") : "")),
          viewerIsStudent && React.createElement("button", {
            className: "rsvp com-rsvp" + (going ? " on" : ""),
            onClick: () => onRsvp(e), type: "button",
          }, going
            ? [React.createElement(Icon, { name: "check", size: 15, stroke: "var(--paper)", key: "i" }), "Going"]
            : [React.createElement(Icon, { name: "plus", size: 15, key: "i" }), "I'm going"]),
          React.createElement("button", { className: "com-act", onClick: () => onOpenEvent(e.id), style: { marginLeft: viewerIsStudent ? 0 : "auto" } },
            "Details", React.createElement(Icon, { name: "arrowRight", size: 14 }))
        )
      )
    );
  }

  // A rail row for a person: name → profile, Connect pill.
  function PersonRow({ u, connectedSet, onOpenPerson, onConnect, onDisconnect }) {
    const isOn = connectedSet.has(u.id);
    return React.createElement("div", { className: "com-rail-org" },
      React.createElement(Av, { name: u.name, img: u.avatar || null }),
      React.createElement("span", { className: "who" },
        React.createElement("button", { className: "com-namebtn", type: "button", onClick: () => u.handle && onOpenPerson && onOpenPerson(u.handle) }, u.name),
        React.createElement("small", null, [u.uni && UNI[u.uni] ? UNI[u.uni].name : null, u.major || u.building || null].filter(Boolean).join(" · ") || "NYC")
      ),
      React.createElement("button", {
        className: "com-follow" + (isOn ? " on" : ""), type: "button", "aria-pressed": isOn,
        onClick: () => (isOn ? onDisconnect && onDisconnect(u.id) : onConnect && onConnect(u.id)),
      },
        React.createElement(Icon, { name: isOn ? "check" : "plus", size: 12, stroke: isOn ? "var(--paper)" : "currentColor" }),
        isOn ? "Connected" : "Connect")
    );
  }

  // ── Your corner — the left column on wide screens ──────────────────
  // The viewer's own footholds on the board: projects they can post about
  // (one click → the composer pre-tagged), events they're going to, orgs they
  // follow. Nothing here duplicates the top nav or filters the feed.
  function YourCorner({ myProjects, going, followedOrgs, onPostAbout, onOpenProject, onOpenEvent, onOpenOrg, onStart }) {
    const nothing = !myProjects.length && !going.length && !followedOrgs.length;
    return (
      React.createElement("aside", { className: "com-left", "aria-label": "Your corner" },
        React.createElement("div", { className: "com-rail-card" },
          React.createElement("h4", null, "Your projects"),
          myProjects.length === 0
            ? React.createElement("p", null, "Pin a flyer and it shows up here with a one-tap way to post about it.")
            : myProjects.slice(0, 4).map((p) => {
                const cat = CAT[p.cat];
                return React.createElement("div", { key: p.id, className: "yc-proj" },
                  React.createElement("button", { className: "com-rail-proj", type: "button", onClick: () => onOpenProject && onOpenProject(p.id) },
                    React.createElement("span", { className: "dot", style: { background: p.flyerColor || (cat && cat.color) } }),
                    React.createElement("span", { className: "t" }, p.title.split(" — ")[0])),
                  React.createElement("button", { className: "yc-post", type: "button", title: "Post about " + p.title.split(" — ")[0], onClick: () => onPostAbout && onPostAbout(p.id) },
                    React.createElement(Icon, { name: "pencil", size: 12 }), "Post about it")
                );
              }),
          myProjects.length === 0 && React.createElement("button", { className: "btn btn-ghost btn-sm", style: { marginTop: 8 }, onClick: onStart },
            React.createElement(Icon, { name: "plus", size: 14 }), "Pin a project")
        ),
        going.length > 0 && React.createElement("div", { className: "com-rail-card" },
          React.createElement("h4", null, "Going"),
          going.slice(0, 3).map((e) => {
            const { mon, day } = formatEventDate(e.date);
            return React.createElement("button", { key: e.id, className: "yc-event", type: "button", onClick: () => onOpenEvent && onOpenEvent(e.id) },
              React.createElement("span", { className: "yc-date" }, React.createElement("b", null, day), React.createElement("small", null, mon)),
              React.createElement("span", { className: "who" },
                React.createElement("b", null, e.title),
                React.createElement("small", null, [e.orgName, e.time].filter(Boolean).join(" · "))));
          })
        ),
        followedOrgs.length > 0 && React.createElement("div", { className: "com-rail-card" },
          React.createElement("h4", null, "Following"),
          followedOrgs.slice(0, 5).map((o) => React.createElement("button", { key: o.id, className: "yc-org", type: "button", onClick: () => o.slug && onOpenOrg && onOpenOrg(o.slug) },
            React.createElement(Av, { name: o.name, img: o.logo || null }),
            React.createElement("span", { className: "who" }, React.createElement("b", null, o.name))))
        ),
        nothing && React.createElement("p", { className: "yc-hint" }, "Follow an org or RSVP to an event and they collect here.")
      )
    );
  }

  // ── The club in the spotlight — pinned above the feed ─────────────
  function SpotlightCard({ spot, followed, membership, viewerIsStudent, onToggleFollow, onJoin, onOpenOrg }) {
    const org = spot.org;
    const post = spot.post;
    const uniObj = org.uni && UNI[org.uni] ? UNI[org.uni] : null;
    const openOrg = () => org.slug && onOpenOrg && onOpenOrg(org.slug);
    return (
      React.createElement("article", { className: "com-spot" },
        React.createElement("div", { className: "cat-bar", style: { background: "var(--ink)" } }),
        React.createElement("div", { className: "com-spot-head" },
          React.createElement("button", { className: "com-avlink", onClick: openOrg, type: "button", "aria-label": org.name },
            React.createElement(Av, { name: org.name, img: org.logo || null })),
          React.createElement("div", { className: "com-who" },
            React.createElement("span", { className: "nm" },
              React.createElement("button", { className: "com-namebtn com-spot-name", onClick: openOrg, type: "button" }, org.name),
              org.verified && React.createElement("span", { className: "com-org-tick", role: "img", "aria-label": "Verified org", title: "Verified .edu org" },
                React.createElement(Icon, { name: "check", size: 10, stroke: "var(--paper)", width: 3 }))),
            React.createElement("span", { className: "com-meta" }, [uniObj && uniObj.name, org.location].filter(Boolean).join(" · ") || "NYC")
          ),
          viewerIsStudent && React.createElement("span", { className: "com-pills" },
            React.createElement(FollowPill, { on: followed, onClick: () => onToggleFollow(org.id) }),
            onJoin && org.type !== "university" && React.createElement(JoinPill, { membership, onClick: () => onJoin(org) }))
        ),
        React.createElement(Kicker, { spot: true }),
        org.bio && React.createElement("p", { className: "com-body" }, org.bio),
        post && React.createElement("div", { className: "com-spot-post" },
          post.images.length > 0 && React.createElement("img", { src: post.images[0], alt: "", loading: "lazy" }),
          React.createElement("div", { className: "com-spot-post-txt" },
            React.createElement("span", { className: "com-meta" }, "Latest on the board · " + postTimeAgo(post.at)),
            React.createElement("p", null, post.body.length > 180 ? post.body.slice(0, 177) + "…" : post.body)
          )
        ),
        React.createElement("div", { className: "com-cta" },
          React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: openOrg },
            React.createElement(Icon, { name: "arrowRight", size: 14 }), "See the org page"))
      )
    );
  }

  // Report sheet: what's wrong, in a sentence (optional).
  function ReportModal({ target, onCancel, onSubmit }) {
    const [reason, setReason] = useState("");
    const [sending, setSending] = useState(false);
    const what = target.type === "comment" ? "comment" : "post";
    async function submit() {
      if (sending) return;
      setSending(true);
      await onSubmit(reason);
      setSending(false);
    }
    return (
      React.createElement("div", { className: "scrim", onClick: onCancel },
        React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation() },
          React.createElement("div", { className: "cat-bar", style: { background: "var(--c-startup)" } }),
          React.createElement("button", { className: "modal-close", onClick: onCancel, "aria-label": "Close" }, React.createElement(Icon, { name: "x", size: 18 })),
          React.createElement("div", { className: "modal-inner" },
            React.createElement("h2", null, "Report this " + what),
            React.createElement("p", null, "Tell us what's wrong. The Nested team reads every report; the person you're reporting never sees who sent it."),
            React.createElement("textarea", {
              placeholder: "Harassment, spam, something that shouldn't be on a student board…",
              value: reason, maxLength: 500, autoFocus: true,
              onChange: (e) => setReason(e.target.value),
            }),
            React.createElement("div", { className: "modal-actions" },
              React.createElement("button", { className: "btn btn-ghost", onClick: onCancel }, "Cancel"),
              React.createElement("button", { className: "btn btn-primary", disabled: sending, onClick: submit },
                React.createElement(Icon, { name: "flag", size: 16, stroke: "var(--paper)" }),
                sending ? "Sending…" : "Send report")
            )
          )
        )
      )
    );
  }

  // ── The board ─────────────────────────────────────────────────────
  // `profile` = the signed-in student; `asOrg` = the org account when an
  // org owner is looking at (and posting to) the board. Exactly one is set.
  // A quiet-board note — derived from data the app already holds (a new
  // flyer, a newcomer at my school). Only rendered when the board is thin.
  function NoteRow({ note }) {
    return React.createElement("button", { className: "com-note", type: "button", onClick: note.onClick },
      React.createElement(Icon, { name: note.icon, size: 14, stroke: "currentColor" }),
      React.createElement("span", null, note.text),
      React.createElement("span", { className: "com-note-when" }, postTimeAgo(note.at)));
  }

  function Community({
    profile, asOrg, projects = [], people = [],
    feed, feedLoading, feedError, onRetry,
    feedHasMore, loadingMore, onLoadMore,
    follows, orgFollowerCount, memberships, onJoin, followedOrgs = [], onPostAbout,
    boardEvents = [], spotlight,
    postLikes, postSaves, postComments, posting,
    connected = [], onConnect, onDisconnect,
    joined, requested,
    rsvped, onRsvp, onOpenEvent, onCreateEvent,
    reported, onReport,
    onCreatePost, onDeletePost, onEditPost, onToggleLike, onToggleSave, onToggleFollow,
    onLoadComments, onAddComment, onDeleteComment,
    onRequestJoin, onMessage,
    onOpenProject, onOpenOrg, onOpenPerson, onOpenPost, onStart, toast,
    composerPreset, onPresetConsumed,
  }) {
    const [confirmId, setConfirmId] = useState(null);
    const [reportTarget, setReportTarget] = useState(null); // { type, id }
    const meId = profile ? profile.id : (asOrg ? asOrg.owner_user_id : null);
    const viewerIsStudent = !!profile && !asOrg;
    const myProjects = taggableProjects(projects, profile, joined);
    const followSet = follows || new Set();
    const reportedSet = reported || new Set();
    const rsvpSet = rsvped || new Set();
    const joinedSet = joined || new Set();
    const requestedSet = requested || new Set();
    const identity = asOrg
      ? { name: asOrg.name, img: asOrg.logo || null }
      : { name: (profile && profile.username) || "?", img: profile ? firstPhoto(profile.photos) : null };

    const list = feed;
    const listLoading = feedLoading;
    const hasMore = !!feedHasMore;

    // Orgs' upcoming events merge into the board. While older posts are
    // still unloaded, events older than the oldest loaded post wait too, so
    // paging never reorders what's on screen.
    let events = boardEvents;
    if (hasMore && list.length) {
      const oldest = list[list.length - 1].at;
      events = events.filter((e) => !e.at || e.at >= oldest);
    }
    let items = [
      ...list.map((p) => ({ key: "p:" + p.id, at: p.at, post: p })),
      ...events.map((e) => ({ key: "e:" + e.id, at: e.at, event: e })),
    ].sort((a, b) => (new Date(b.at || 0) - new Date(a.at || 0)) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const realCount = items.length;

    // Quiet-board notes: when fewer than ten notes landed this week, weave in
    // what the app already knows — new flyers and newcomers at my school — one
    // note per three cards. Derived, zero writes; gone the moment people post.
    const WEEK = 7 * 86400 * 1000;
    const nowMs = Date.now();
    const recentPosts = feed.filter((p) => nowMs - new Date(p.at).getTime() < WEEK).length;
    if (!feedLoading && recentPosts < 10) {
      const flyers = (!onOpenProject ? [] : projects)
        .filter((p) => p.createdAt && nowMs - new Date(p.createdAt).getTime() < WEEK)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 3)
        .map((p) => ({
          key: "n:f:" + p.id, at: p.createdAt, icon: "board",
          text: (p.lead && p.lead.name ? p.lead.name + " pinned a new flyer — " : "New flyer — ") + p.title.split(" — ")[0],
          onClick: () => onOpenProject(p.id),
        }));
      const myUni = profile ? profile.uni : null;
      const newcomers = people
        .filter((u) => u && u.id !== meId && u.createdAt && nowMs - u.createdAt < WEEK && myUni && u.uni === myUni)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 3)
        .map((u) => ({
          key: "n:u:" + u.id, at: new Date(u.createdAt).toISOString(), icon: "sparkle",
          text: u.name + " just joined from " + (UNI[u.uni] ? UNI[u.uni].name : "NYC") + " — say hi",
          onClick: () => u.handle && onOpenPerson && onOpenPerson(u.handle),
        }));
      const notes = [...flyers, ...newcomers].sort((a, b) => new Date(b.at) - new Date(a.at));
      if (notes.length) {
        const merged = [];
        let ni = 0;
        items.forEach((it, i) => {
          merged.push(it);
          if ((i + 1) % 3 === 0 && ni < notes.length) merged.push({ key: notes[ni].key, note: notes[ni++] });
        });
        while (ni < notes.length && merged.length < 6) merged.push({ key: notes[ni].key, note: notes[ni++] });
        items = merged;
      }
    }

    const empty = ["The board is empty", asOrg ? "Be the first — post an update above." : "Be the first — pin what you're working on today."];
    const showFeedError = !!feedError;

    // "I'm interested" needs the full project (open roles, lead) — the post
    // only embeds {id, title, cat}. Look it up in the loaded board; missing
    // (unpublished / not loaded) falls back to the flyer page.
    const projectsById = new Map(projects.map((p) => [p.id, p]));
    function askFor(p) {
      if (p.kind !== "ask" || !p.project) return null;
      const project = projectsById.get(p.project.id);
      if (!project) return { state: "missing", project: null };
      let state = "open";
      if (profile && isProjectAdmin(project, profile)) state = "admin";
      else if (joinedSet.has(project.id)) state = "joined";
      else if (requestedSet.has(project.id)) state = "requested";
      return { state, project };
    }

    // ── Right rail ───────────────────────────────────────────────────
    const connectedSet = new Set(connected || []);
    const personRowProps = { connectedSet, onOpenPerson, onConnect, onDisconnect };
    // Asks first: the latest "looking for" notes + flyers with open roles.
    // One ask per author (a chatty poster shouldn't fill the card), never my own.
    const asks = [];
    const askAuthors = new Set();
    for (const p of feed) {
      if (p.kind !== "ask" || p.authorId === meId) continue;
      const who = p.org ? "o:" + p.org.id : "u:" + p.authorId;
      if (askAuthors.has(who)) continue;
      askAuthors.add(who);
      asks.push(p);
      if (asks.length >= 3) break;
    }
    // Flyer rows only where a flyer can open (students).
    const openRoleProjects = !onOpenProject ? [] : projects
      .filter((p) => (p.roles || []).some((r) => r && r.open) && !(profile && isProjectAdmin(p, profile)))
      .slice(0, 3);
    // People: newest at my school, then the best matches — never me, never
    // already connected. Recent posters float up among the builders.
    const myUni = profile ? profile.uni : null;
    const others = people.filter((u) => u && u.id !== meId && !connectedSet.has(u.id));
    const newAtSchool = others
      .filter((u) => myUni && u.uni === myUni)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 4);
    const newIds = new Set(newAtSchool.map((u) => u.id));
    const posters = new Set(feed.filter((p) => !p.org && p.authorId).map((p) => p.authorId));
    const builders = others
      .filter((u) => !newIds.has(u.id))
      .sort((a, b) => (posters.has(b.id) ? 1 : 0) - (posters.has(a.id) ? 1 : 0))
      .slice(0, 3);
    // The most-viewed live projects — a reason to wander back to the big board.
    const trending = !onOpenProject ? [] : [...projects].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 3);
    // …and the orgs that have been posting, so following starts from the feed.
    const orgsOnBoard = [];
    const seen = new Set();
    for (const p of feed) {
      if (!p.org || seen.has(p.org.id)) continue;
      seen.add(p.org.id);
      orgsOnBoard.push({ ...p.org, img: p.authorAvatar || null, uni: p.uni ? UNI[p.uni] : null });
      if (orgsOnBoard.length >= 5) break;
    }
    const spotOrgId = spotlight && spotlight.org ? spotlight.org.id : null;

    return (
      React.createElement("div", { className: "community" },
        React.createElement("div", { className: "disco-head" },
          React.createElement("div", { className: "head-txt" },
            React.createElement("h1", null, "The ", React.createElement("em", null, "community")),
            React.createElement("p", { className: "sub" }, asOrg
              ? "Where NYC students hang out between events — post updates where they're already looking."
              : "What NYC students and their orgs are building right now — wins, works-in-progress, and the photos to prove it.")
          )
        ),
        React.createElement("div", { className: "com-cols" + (viewerIsStudent ? " three" : "") },
          viewerIsStudent && React.createElement(YourCorner, {
            myProjects,
            going: boardEvents.filter((e) => rsvpSet.has(e.id)).sort((a, b) => (a.date || "").localeCompare(b.date || "")),
            followedOrgs,
            onPostAbout: (id) => onPostAbout && onPostAbout(id),
            onOpenProject, onOpenEvent, onOpenOrg, onStart,
          }),
          React.createElement("div", { className: "com-main" },
            React.createElement(Composer, { identity, myProjects, posting, onCreatePost, asOrg: !!asOrg, onCreateEvent, preset: composerPreset, onPresetConsumed, onStart }),
            spotlight && spotlight.org && React.createElement(SpotlightCard, {
              spot: spotlight,
              followed: followSet.has(spotOrgId),
              membership: memberships ? memberships[spotOrgId] : undefined,
              onJoin,
              viewerIsStudent,
              onToggleFollow, onOpenOrg,
            }),
            listLoading && React.createElement(Skeleton, { count: 3 }),
            !listLoading && showFeedError && React.createElement("div", { className: "match-empty fade-up" },
              React.createElement("div", { className: "ill" }, React.createElement(Icon, { name: "refresh", size: 42, stroke: "var(--accent)" })),
              React.createElement("h3", null, "Couldn't load the board"),
              React.createElement("p", null, "Something went wrong reaching Nested. Check your connection and try again."),
              React.createElement("button", { className: "btn btn-primary", style: { marginTop: 22 }, onClick: onRetry },
                React.createElement(Icon, { name: "refresh", size: 16, stroke: "var(--paper)" }), "Try again")
            ),
            !listLoading && !showFeedError && realCount === 0 && React.createElement("div", { className: "match-empty fade-up" },
              React.createElement("h3", null, empty[0]),
              React.createElement("p", null, empty[1])
            ),
            !listLoading && items.map((it) => it.note
              ? React.createElement(NoteRow, { key: it.key, note: it.note })
              : it.event
              ? React.createElement(EventCard, {
                  key: it.key, e: it.event,
                  going: rsvpSet.has(it.event.id),
                  viewerIsStudent,
                  followed: !!(it.event.org && followSet.has(it.event.org.id)),
                  onRsvp, onOpenEvent, onOpenOrg, onToggleFollow,
                })
              : React.createElement(PostCard, {
                  key: it.key, p: it.post,
                  mine: !!(meId && it.post.authorId === meId),
                  liked: postLikes.has(it.post.id),
                  savedOn: postSaves.has(it.post.id),
                  comments: postComments[it.post.id],
                  profileId: meId,
                  viewerIsStudent,
                  followed: !!(it.post.org && followSet.has(it.post.org.id)),
                  membership: it.post.org && memberships ? memberships[it.post.org.id] : undefined,
                  onJoin,
                  ask: askFor(it.post),
                  reported: reportedSet.has("post:" + it.post.id),
                  myProjects, asOrg: !!asOrg, toast,
                  onToggleLike, onToggleSave, onOpenProject, onOpenOrg, onOpenPerson, onToggleFollow, onOpenPost,
                  onLoadComments, onAddComment, onDeleteComment,
                  onAskDelete: setConfirmId,
                  onReport: (type, id) => setReportTarget({ type, id }),
                  onEditPost,
                  onRequestJoin, onMessage,
                })
            ),
            !listLoading && hasMore && list.length > 0 && React.createElement("button", {
              className: "btn btn-ghost com-more", onClick: onLoadMore, disabled: loadingMore,
            }, loadingMore ? "Loading…" : "Load older")
          ),
          React.createElement("aside", { className: "com-rail" },
            asOrg && React.createElement("div", { className: "com-rail-card" },
              React.createElement("h4", null, "Posting as " + asOrg.name),
              React.createElement("p", null, "Every student on the board sees your posts with the org stamp. Followers get a nudge every time you post."),
              React.createElement("div", { className: "com-rail-stat" },
                React.createElement("span", null, React.createElement("b", null, orgFollowerCount == null ? "–" : orgFollowerCount), "followers"),
                React.createElement("span", null, React.createElement("b", null, feed.filter((p) => p.org && p.org.id === asOrg.id).length), "posts")
              )
            ),
            (asks.length > 0 || openRoleProjects.length > 0) && React.createElement("div", { className: "com-rail-card" },
              React.createElement("h4", null, "Looking for help"),
              asks.map((p) => React.createElement("button", { key: p.id, className: "com-rail-ask", type: "button", onClick: () => p.org ? (p.org.slug && onOpenOrg && onOpenOrg(p.org.slug)) : (p.authorHandle && onOpenPerson && onOpenPerson(p.authorHandle)) },
                React.createElement(Av, { name: p.org ? p.org.name : p.author, img: p.authorAvatar || null }),
                React.createElement("span", { className: "who" },
                  React.createElement("b", null, p.org ? p.org.name : p.author),
                  React.createElement("small", null, p.body.length > 64 ? p.body.slice(0, 61) + "…" : p.body)
                )
              )),
              openRoleProjects.map((p) => {
                const cat = CAT[p.cat];
                const role = (p.roles || []).find((r) => r && r.open);
                return React.createElement("button", { key: p.id, className: "com-rail-proj", onClick: () => onOpenProject(p.id) },
                  React.createElement("span", { className: "dot", style: { background: p.flyerColor || (cat && cat.color) } }),
                  React.createElement("span", { className: "t" }, p.title.split(" — ")[0]),
                  React.createElement("span", { className: "n" }, role ? role.title : "open role")
                );
              })
            ),
            viewerIsStudent && newAtSchool.length > 0 && React.createElement("div", { className: "com-rail-card com-rail-people" },
              React.createElement("h4", null, "New around " + (myUni && UNI[myUni] ? UNI[myUni].name : "campus")),
              newAtSchool.map((u) => React.createElement(PersonRow, { key: u.id, u, ...personRowProps }))
            ),
            viewerIsStudent && builders.length > 0 && React.createElement("div", { className: "com-rail-card com-rail-people" },
              React.createElement("h4", null, "Builders to check out"),
              builders.map((u) => React.createElement(PersonRow, { key: u.id, u, ...personRowProps }))
            ),
            viewerIsStudent && orgsOnBoard.length > 0 && React.createElement("div", { className: "com-rail-card com-rail-people" },
              React.createElement("h4", null, "Orgs on the board"),
              orgsOnBoard.map((o) => (
                React.createElement("div", { key: o.id, className: "com-rail-org" },
                  React.createElement(Av, { name: o.name, img: o.img }),
                  React.createElement("span", { className: "who" },
                    React.createElement("button", { className: "com-namebtn", type: "button", onClick: () => o.slug && onOpenOrg && onOpenOrg(o.slug) }, o.name),
                    React.createElement("small", null, o.uni ? o.uni.name : "NYC")
                  ),
                  React.createElement("span", { className: "com-pills" },
                    React.createElement(FollowPill, { on: followSet.has(o.id), onClick: () => onToggleFollow(o.id), small: true }),
                    onJoin && React.createElement(JoinPill, { membership: memberships ? memberships[o.id] : undefined, onClick: () => onJoin(o), small: true }))
                )
              ))
            ),
            trending.length > 0 && React.createElement("div", { className: "com-rail-card" },
              React.createElement("h4", null, "Hot on the board"),
              trending.map((p) => {
                const cat = CAT[p.cat];
                return React.createElement("button", { key: p.id, className: "com-rail-proj", onClick: () => onOpenProject(p.id) },
                  React.createElement("span", { className: "dot", style: { background: p.flyerColor || (cat && cat.color) } }),
                  React.createElement("span", { className: "t" }, p.title.split(" — ")[0]),
                  React.createElement("span", { className: "n" }, (p.views || 0) + " views")
                );
              })
            ),
            !asOrg && React.createElement("div", { className: "com-rail-card" },
              React.createElement("h4", null, "Working on something?"),
              React.createElement("p", null, "Photos of the actual work get more replies. Tag your project so people can find the flyer — or pin a new one."),
              React.createElement("button", { className: "btn btn-primary", style: { marginTop: 10 }, onClick: onStart },
                React.createElement(Icon, { name: "plus", size: 15, stroke: "var(--paper)" }), "Pin a project")
            )
          )
        ),
        confirmId && React.createElement(ConfirmModal, {
          accent: "var(--c-startup)",
          title: "Take this post down?",
          body: "It comes off the board for everyone. There's no undo.",
          ctaLabel: "Take it down",
          ctaIcon: "trash",
          danger: true,
          onCancel: () => setConfirmId(null),
          onConfirm: () => { onDeletePost(confirmId); setConfirmId(null); },
        }),
        reportTarget && React.createElement(ReportModal, {
          target: reportTarget,
          onCancel: () => setReportTarget(null),
          onSubmit: async (reason) => {
            const res = onReport ? await onReport(reportTarget.type, reportTarget.id, reason) : null;
            if (!res || res.ok !== false) setReportTarget(null);
          },
        })
      )
    );
  }

  // ── One note, on its own page (/community/:id) ────────────────────
  // The permalink the bell, the report email and "Copy link" point at.
  // Same PostCard as the board, thread open, no rail.
  function CommunityPost({
    profile, asOrg, projects = [], postId, detail,
    postLikes, postSaves, postComments, follows, joined, requested, reported, memberships, onJoin,
    onBack, onToggleLike, onToggleSave, onToggleFollow,
    onLoadComments, onAddComment, onDeleteComment, onDeletePost, onEditPost, onReport,
    onRequestJoin, onMessage, onOpenProject, onOpenOrg, onOpenPerson, onOpenPost, toast,
  }) {
    const [confirmId, setConfirmId] = useState(null);
    const [reportTarget, setReportTarget] = useState(null);
    const meId = profile ? profile.id : (asOrg ? asOrg.owner_user_id : null);
    const viewerIsStudent = !!profile && !asOrg;
    const followSet = follows || new Set();
    const reportedSet = reported || new Set();
    const myProjects = taggableProjects(projects, profile, joined);
    const p = detail && detail.id === postId ? detail.post : null;
    const loading = !detail || detail.id !== postId || detail.loading;
    const missing = detail && detail.id === postId && detail.missing;

    let ask = null;
    if (p && p.kind === "ask" && p.project) {
      const project = projects.find((x) => x.id === p.project.id);
      if (!project) ask = { state: "missing", project: null };
      else {
        let state = "open";
        if (profile && isProjectAdmin(project, profile)) state = "admin";
        else if (joined && joined.has(project.id)) state = "joined";
        else if (requested && requested.has(project.id)) state = "requested";
        ask = { state, project };
      }
    }

    return (
      React.createElement("div", { className: "community" },
        React.createElement("div", { className: "com-single" },
          React.createElement("button", { className: "btn btn-ghost btn-sm com-back", onClick: onBack },
            React.createElement(Icon, { name: "arrowLeft", size: 15 }), "Back to the board"),
          loading && !missing && React.createElement(Skeleton, { count: 1 }),
          missing && React.createElement("div", { className: "match-empty fade-up" },
            React.createElement("h3", null, "That note isn't on the board"),
            React.createElement("p", null, "It was taken down, or the link is wrong.")
          ),
          p && React.createElement(PostCard, {
            p,
            mine: !!(meId && p.authorId === meId),
            liked: postLikes.has(p.id),
            savedOn: postSaves.has(p.id),
            comments: postComments[p.id],
            profileId: meId,
            viewerIsStudent,
            followed: !!(p.org && followSet.has(p.org.id)),
            membership: p.org && memberships ? memberships[p.org.id] : undefined,
            onJoin,
            ask,
            reported: reportedSet.has("post:" + p.id),
            myProjects, asOrg: !!asOrg, defaultOpen: true, toast,
            onToggleLike, onToggleSave, onOpenProject, onOpenOrg, onOpenPerson, onToggleFollow, onOpenPost,
            onLoadComments, onAddComment, onDeleteComment,
            onAskDelete: setConfirmId,
            onReport: (type, id) => setReportTarget({ type, id }),
            onEditPost,
            onRequestJoin, onMessage,
          })
        ),
        confirmId && React.createElement(ConfirmModal, {
          accent: "var(--c-startup)",
          title: "Take this post down?",
          body: "It comes off the board for everyone. There's no undo.",
          ctaLabel: "Take it down",
          ctaIcon: "trash",
          danger: true,
          onCancel: () => setConfirmId(null),
          onConfirm: () => { onDeletePost(confirmId); setConfirmId(null); },
        }),
        reportTarget && React.createElement(ReportModal, {
          target: reportTarget,
          onCancel: () => setReportTarget(null),
          onSubmit: async (reason) => {
            const res = onReport ? await onReport(reportTarget.type, reportTarget.id, reason) : null;
            if (!res || res.ok !== false) setReportTarget(null);
          },
        })
      )
    );
  }

  // ── Saved posts (rendered inside the /saved page) ────────────────
  // The same PostCard as the board, fed from the cached saved list.
  function SavedPosts({
    profile, asOrg, projects = [], posts, loading,
    postLikes, postSaves, postComments, follows, joined, requested, reported, memberships, onJoin,
    onToggleLike, onToggleSave, onToggleFollow,
    onLoadComments, onAddComment, onDeleteComment, onDeletePost, onEditPost, onReport,
    onRequestJoin, onMessage, onOpenProject, onOpenOrg, onOpenPerson, onOpenPost, toast,
  }) {
    const [confirmId, setConfirmId] = useState(null);
    const [reportTarget, setReportTarget] = useState(null);
    const meId = profile ? profile.id : (asOrg ? asOrg.owner_user_id : null);
    const viewerIsStudent = !!profile && !asOrg;
    const followSet = follows || new Set();
    const reportedSet = reported || new Set();
    const myProjects = taggableProjects(projects, profile, joined);
    const list = posts || [];

    function askFor(p) {
      if (p.kind !== "ask" || !p.project) return null;
      const project = projects.find((x) => x.id === p.project.id);
      if (!project) return { state: "missing", project: null };
      let state = "open";
      if (profile && isProjectAdmin(project, profile)) state = "admin";
      else if (joined && joined.has(project.id)) state = "joined";
      else if (requested && requested.has(project.id)) state = "requested";
      return { state, project };
    }

    return (
      React.createElement("div", { className: "community com-saved" },
        loading && posts === null && React.createElement(Skeleton, { count: 2 }),
        !loading && list.length === 0 && React.createElement("div", { className: "match-empty fade-up" },
          React.createElement("div", { className: "ill" }, React.createElement(Icon, { name: "bookmark", size: 42, stroke: "var(--accent)" })),
          React.createElement("h3", null, "No saved posts yet"),
          React.createElement("p", null, "Tap the bookmark on any post on the board to keep it here.")
        ),
        list.map((p) => React.createElement(PostCard, {
          key: p.id, p,
          mine: !!(meId && p.authorId === meId),
          liked: postLikes.has(p.id),
          savedOn: postSaves.has(p.id),
          comments: postComments[p.id],
          profileId: meId,
          viewerIsStudent,
          followed: !!(p.org && followSet.has(p.org.id)),
          membership: p.org && memberships ? memberships[p.org.id] : undefined,
          onJoin,
          ask: askFor(p),
          reported: reportedSet.has("post:" + p.id),
          myProjects, asOrg: !!asOrg, toast,
          onToggleLike, onToggleSave, onOpenProject, onOpenOrg, onOpenPerson, onToggleFollow, onOpenPost,
          onLoadComments, onAddComment, onDeleteComment,
          onAskDelete: setConfirmId,
          onReport: (type, id) => setReportTarget({ type, id }),
          onEditPost,
          onRequestJoin, onMessage,
        })),
        confirmId && React.createElement(ConfirmModal, {
          accent: "var(--c-startup)",
          title: "Take this post down?",
          body: "It comes off the board for everyone. There's no undo.",
          ctaLabel: "Take it down",
          ctaIcon: "trash",
          danger: true,
          onCancel: () => setConfirmId(null),
          onConfirm: () => { onDeletePost(confirmId); setConfirmId(null); },
        }),
        reportTarget && React.createElement(ReportModal, {
          target: reportTarget,
          onCancel: () => setReportTarget(null),
          onSubmit: async (reason) => {
            const res = onReport ? await onReport(reportTarget.type, reportTarget.id, reason) : null;
            if (!res || res.ok !== false) setReportTarget(null);
          },
        })
      )
    );
  }

  export { Community, CommunityPost, SavedPosts };
  export default Community;
