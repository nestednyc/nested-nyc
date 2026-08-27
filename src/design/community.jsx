/* ============================================================
   NESTED NYC — Community board
   The shared feed: notes pinned by students — words + photos,
   optionally tagged with one of their projects. Presentational;
   all state and handlers arrive as props (useCommunity via the
   api bag). Cork-board vocabulary only.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { CAT, UNI, isProjectAdmin } from './data'
import { Av, Skeleton, ConfirmModal } from './shared'
import { POST_BODY_MAX, POST_IMAGES_MAX } from '../services/communityService'
import { postTimeAgo } from './postAdapter'

  const { useState, useRef } = React;

  // ── Composer: the blank note at the top of the board ──────────────
  function Composer({ profile, myProjects, posting, onCreatePost }) {
    const [body, setBody] = useState("");
    const [files, setFiles] = useState([]); // File objects, ≤4
    const [previews, setPreviews] = useState([]); // object URLs, same order
    const [projectId, setProjectId] = useState("");
    const fileRef = useRef(null);

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
      const res = await onCreatePost({ body, files, projectId: projectId || null });
      if (res && res.ok) {
        previews.forEach((u) => URL.revokeObjectURL(u));
        setBody(""); setFiles([]); setPreviews([]); setProjectId("");
        if (fileRef.current) fileRef.current.value = "";
      }
    }
    const canPost = !posting && (body.trim().length > 0 || files.length > 0);

    return (
      React.createElement("div", { className: "com-composer" },
        React.createElement("div", { className: "com-composer-row" },
          React.createElement(Av, { name: (profile && profile.username) || "?", img: profile && Array.isArray(profile.photos) ? (typeof profile.photos[0] === "string" ? profile.photos[0] : (profile.photos[0] && profile.photos[0].src)) : null }),
          React.createElement("textarea", {
            className: "com-input", rows: 2,
            placeholder: "Pin something to the board — a win, a work-in-progress, a photo…",
            value: body, maxLength: POST_BODY_MAX,
            onChange: (e) => setBody(e.target.value),
          })
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
          myProjects.length > 0 && React.createElement("select", {
            className: "com-project-select",
            value: projectId,
            onChange: (e) => setProjectId(e.target.value),
          },
            React.createElement("option", { value: "" }, "No project tag"),
            myProjects.map((p) => React.createElement("option", { key: p.id, value: p.id }, p.title.split(" — ")[0]))
          ),
          React.createElement("button", { className: "btn btn-primary com-post-btn", disabled: !canPost, onClick: submit },
            React.createElement(Icon, { name: "send", size: 15, stroke: "var(--paper)" }),
            posting ? "Pinning…" : "Pin it")
        )
      )
    );
  }

  // ── One pinned note ───────────────────────────────────────────────
  function PostCard({ p, mine, liked, savedOn, comments, onToggleLike, onToggleSave, onOpenProject, onLoadComments, onAddComment, onDeleteComment, onAskDelete, profileId }) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");
    const cat = p.project ? CAT[p.project.cat] : null;
    const uni = p.uni ? UNI[p.uni] : null;

    function toggleComments() {
      const next = !open;
      setOpen(next);
      if (next) onLoadComments(p.id);
    }
    async function sendComment() {
      const res = await onAddComment(p.id, text);
      if (res && res.ok) setText("");
    }

    return (
      React.createElement("article", { className: "com-post" },
        React.createElement("header", { className: "com-post-head" },
          React.createElement(Av, { name: p.author, img: p.authorAvatar || null }),
          React.createElement("div", { className: "com-who" },
            React.createElement("b", null, p.author),
            React.createElement("span", { className: "com-meta" },
              (uni ? uni.name + " · " : "") + postTimeAgo(p.at))
          ),
          mine && React.createElement("button", { className: "com-del", onClick: () => onAskDelete(p.id), "aria-label": "Delete post" },
            React.createElement(Icon, { name: "trash", size: 15 }))
        ),
        p.body && React.createElement("p", { className: "com-body" }, p.body),
        p.images.length > 0 && React.createElement("div", { className: "com-imgs n" + Math.min(p.images.length, 4) },
          p.images.map((src) => React.createElement("img", { key: src, src, alt: "", loading: "lazy" }))
        ),
        p.project && React.createElement("button", { className: "com-proj", onClick: () => onOpenProject(p.project.id), style: cat ? { color: cat.ink, background: cat.wash } : undefined },
          cat && React.createElement(Icon, { name: CAT[p.project.cat].icon, size: 14, stroke: "currentColor" }),
          p.project.title.split(" — ")[0]
        ),
        React.createElement("footer", { className: "com-actions" },
          React.createElement("button", { className: "com-act" + (liked ? " on" : ""), onClick: () => onToggleLike(p.id) },
            React.createElement(Icon, { name: "heart", size: 17 }), p.likes > 0 ? p.likes : ""),
          React.createElement("button", { className: "com-act", onClick: toggleComments },
            React.createElement(Icon, { name: "chat", size: 17 }), p.commentCount > 0 ? p.commentCount : ""),
          React.createElement("button", { className: "com-act sv" + (savedOn ? " on" : ""), onClick: () => onToggleSave(p.id), style: { marginLeft: "auto" } },
            React.createElement(Icon, { name: "bookmark", size: 17 }))
        ),
        open && React.createElement("div", { className: "com-comments" },
          comments && comments.loading && React.createElement("div", { className: "com-meta", style: { padding: "6px 0" } }, "loading…"),
          comments && comments.list && comments.list.map((c) => (
            React.createElement("div", { className: "com-comment", key: c.id },
              React.createElement(Av, { name: c.author, img: c.authorAvatar || null }),
              React.createElement("div", { className: "com-comment-bubble" },
                React.createElement("b", null, c.author),
                React.createElement("span", null, c.body)
              ),
              (c.authorId === profileId || mine) && React.createElement("button", { className: "com-del", onClick: () => onDeleteComment(p.id, c.id), "aria-label": "Delete comment" },
                React.createElement(Icon, { name: "x", size: 12 }))
            )
          )),
          comments && comments.list && comments.list.length === 0 && React.createElement("div", { className: "com-meta", style: { padding: "6px 0" } }, "No comments yet — say something nice."),
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

  // ── The board ─────────────────────────────────────────────────────
  function Community({
    profile, projects = [],
    feed, feedLoading, feedFilter, onSelectFilter,
    savedPosts, savedLoading,
    postLikes, postSaves, postComments, posting,
    onCreatePost, onDeletePost, onToggleLike, onToggleSave,
    onLoadComments, onAddComment, onDeleteComment,
    onOpenProject, onStart,
  }) {
    const [confirmId, setConfirmId] = useState(null);
    const myProjects = projects.filter((p) => profile && isProjectAdmin(p, profile));

    const FILTERS = [
      { id: "all", label: "All", icon: "grid" },
      { id: "school", label: "My school", icon: "flag" },
      { id: "saved", label: "Saved", icon: "bookmark" },
    ];

    let list = feed;
    if (feedFilter === "school") list = feed.filter((p) => profile && p.uni && p.uni === profile.uni);
    if (feedFilter === "saved") list = savedPosts || [];
    const listLoading = feedFilter === "saved" ? savedLoading : feedLoading;

    // Right rail: the most-viewed live projects — a reason to wander back
    // to the big board.
    const trending = [...projects].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 3);

    return (
      React.createElement("div", { className: "community" },
        React.createElement("div", { className: "disco-head" },
          React.createElement("div", { className: "head-txt" },
            React.createElement("h1", null, "The ", React.createElement("em", null, "community")),
            React.createElement("p", { className: "sub" }, "What NYC students are building right now — wins, works-in-progress, and the photos to prove it.")
          )
        ),
        React.createElement("div", { className: "com-cols" },
          React.createElement("div", { className: "com-main" },
            React.createElement(Composer, { profile, myProjects, posting, onCreatePost }),
            React.createElement("div", { className: "match-tabs com-filters" },
              FILTERS.map((f) => (
                React.createElement("button", { key: f.id, className: "match-tab" + (feedFilter === f.id ? " active" : ""), onClick: () => onSelectFilter(f.id) },
                  React.createElement(Icon, { name: f.icon, size: 16 }), f.label)
              ))
            ),
            listLoading && React.createElement(Skeleton, { count: 3 }),
            !listLoading && list.length === 0 && React.createElement("div", { className: "match-empty fade-up" },
              React.createElement("h3", null, feedFilter === "saved" ? "Nothing saved yet" : "The board is empty"),
              React.createElement("p", null, feedFilter === "saved"
                ? "Tap the bookmark on any post to keep it here."
                : "Be the first — pin what you're working on today.")
            ),
            !listLoading && list.map((p) => (
              React.createElement(PostCard, {
                key: p.id, p,
                mine: !!(profile && p.authorId === profile.id),
                liked: postLikes.has(p.id),
                savedOn: postSaves.has(p.id),
                comments: postComments[p.id],
                profileId: profile && profile.id,
                onToggleLike, onToggleSave, onOpenProject,
                onLoadComments, onAddComment, onDeleteComment,
                onAskDelete: setConfirmId,
              })
            ))
          ),
          React.createElement("aside", { className: "com-rail" },
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
            React.createElement("div", { className: "com-rail-card" },
              React.createElement("h4", null, "Show, don't tell"),
              React.createElement("p", null, "Posts with photos of the actual work get the board moving. Tag your project so people can find the flyer."),
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
        })
      )
    );
  }

  export { Community };
  export default Community;
