/* ============================================================
   NESTED NYC — Legal documents (Terms of Service / Privacy Policy)
   The two docs are structurally identical (title, effective date,
   numbered sections), so one presentational component takes a
   `doc` prop rather than forking into two files — mirrors how
   orgForm.jsx serves both org onboarding and student club founding
   through a `variant` prop. Content is imported verbatim from the
   finalized markdown in legal/ (never edited here) and
   parsed into real heading hierarchy; reuses the flyer detail
   page's shell (.backbar/.back/.detail/.detail-body) for chrome
   and paragraph type. Each page links to the other under the card.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { TERMS_VERSION } from './data'
import storageKeys from './storageKeys.json'
import { authService } from '../lib/supabase'
import TERMS_RAW from '../../legal/terms-of-service.md?raw'
import PRIVACY_RAW from '../../legal/privacy-policy.md?raw'

// Render from the real title down — anything a source file carries above
// its H1 (a drafting note, front matter) is addressed to whoever edits the
// markdown, not to end users.
function toDocBody(raw) {
  const lines = raw.split("\n");
  const start = lines.findIndex((l) => l.startsWith("# "));
  return (start === -1 ? lines : lines.slice(start)).join("\n").trim();
}

// The exact subset of markdown both documents use: one H1, "## N. Heading"
// sections, "- " bullet lists, and single-line paragraphs (the source never
// hard-wraps a paragraph across lines) — a small tailored parser is safer
// here than a general markdown renderer would be for text that has to stay
// legally verbatim.
function toLegalBlocks(raw) {
  const lines = toDocBody(raw).split("\n");
  const blocks = [];
  let list = null;
  function flushList() { if (list && list.length) blocks.push({ type: "list", items: list }); list = null; }
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { flushList(); continue; }
    if (line.slice(0, 3) === "## ") { flushList(); blocks.push({ type: "h2", text: line.slice(3) }); continue; }
    if (line.slice(0, 2) === "# ") { flushList(); blocks.push({ type: "h1", text: line.slice(2) }); continue; }
    if (line.slice(0, 2) === "- ") { (list = list || []).push(line.slice(2)); continue; }
    flushList();
    blocks.push({ type: "p", text: line });
  }
  flushList();
  return blocks;
}

// Inline **bold**, [bracketed placeholders] and bare email addresses.
// Placeholders render as visibly plain, flagged text — nothing here invents a
// value for one (the shipped docs carry none; this is the safety net for a
// future edit). An email becomes a mailto: link; the wording stays verbatim.
function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g).filter(Boolean).map((part, i) => {
    if (part.slice(0, 2) === "**") return React.createElement("strong", { key: i }, part.slice(2, -2));
    if (part.charAt(0) === "[") return React.createElement("span", { key: i, className: "legal-placeholder" }, part);
    if (/^[\w.+-]+@/.test(part)) return React.createElement("a", { key: i, href: "mailto:" + part }, part);
    return part;
  });
}

function LegalBlock({ block, idx }) {
  if (block.type === "h1") return React.createElement("h1", { key: idx, className: "legal-title" }, renderInline(block.text));
  if (block.type === "h2") return React.createElement("h2", { key: idx }, renderInline(block.text));
  if (block.type === "list") {
    return React.createElement("ul", { key: idx }, block.items.map((it, i) => React.createElement("li", { key: i }, renderInline(it))));
  }
  return React.createElement("p", { key: idx }, renderInline(block.text));
}

const DOCS = {
  terms: TERMS_RAW,
  privacy: PRIVACY_RAW,
};

// The sibling document, linked under the card.
const OTHER = {
  terms: { route: "privacy", path: "/privacy", label: "Privacy Policy" },
  privacy: { route: "terms", path: "/terms", label: "Terms of Service" },
};

// A real href (so it opens in a new tab / copies as a link) that navigates
// in-app on a plain click.
function docLink(route, path, label, onOpenDoc) {
  return React.createElement("a", {
    href: path,
    onClick: (e) => {
      if (!onOpenDoc || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      onOpenDoc(route);
    },
  }, label);
}

// The two documents as new-tab links — for the places that must not navigate
// away (a half-filled signup form, the notice strip).
const newTab = (path, label) => React.createElement("a", { href: path, target: "_blank", rel: "noopener noreferrer" }, label);

function LegalDoc({ doc, onBack, onOpenDoc }) {
  const blocks = toLegalBlocks(DOCS[doc] || DOCS.terms);
  const other = OTHER[doc] || OTHER.terms;
  return (
    React.createElement("div", { className: "legal-wrap" },
      React.createElement("div", { className: "backbar" },
        React.createElement("button", { className: "back", onClick: onBack },
          React.createElement(Icon, { name: "arrowLeft", size: 17 }), "The board")
      ),
      React.createElement("div", { className: "detail grain fade-up" },
        React.createElement("div", { className: "cat-bar", style: { background: "var(--accent)" } }),
        React.createElement("div", { className: "detail-inner" },
          React.createElement("div", { className: "detail-body legal-body" },
            blocks.map((block, idx) => React.createElement(LegalBlock, { key: idx, block, idx }))
          )
        )
      ),
      React.createElement("p", { className: "legal-foot" },
        "Also read the ",
        docLink(other.route, other.path, other.label, onOpenDoc),
        "."
      )
    )
  );
}

// The required "I agree" box — student signup step 5 and org sign-up. New-tab
// links: routing away would unmount the form and lose everything typed.
function ConsentCheckbox({ checked, onChange }) {
  return (
    React.createElement("label", { className: "onb-consent" },
      React.createElement("input", { type: "checkbox", checked, onChange: (e) => onChange(e.target.checked) }),
      React.createElement("span", null,
        "I agree to the ", newTab("/terms", "Terms of Service"), " and ", newTab("/privacy", "Privacy Policy"), "."
      )
    )
  );
}

// ---------- acceptance cache (per browser, per account) ----------
// The record of who agreed lives on the account (auth user metadata — see
// authService.getTermsStatus); this is only a local shortcut so a known yes
// costs no request. Keyed by version + user id: a bumped TERMS_VERSION asks
// again, and a second account on the same browser is asked for itself.
function termsCached(userId) {
  try { return localStorage.getItem(storageKeys.termsSeen) === TERMS_VERSION + ":" + userId; } catch (e) { return false; }
}
function cacheTerms(userId) {
  try { localStorage.setItem(storageKeys.termsSeen, TERMS_VERSION + ":" + userId); } catch (e) {}
}

// One-time strip under the top bar for signed-in accounts that have not
// agreed yet — in practice the ones that predate the documents. Anyone who
// ticked the signup checkbox, or pressed "Got it" on any device, is never
// asked again: it renders nothing until the account's record says "not yet".
function LegalNotice() {
  const [userId, setUserId] = React.useState(null);   // set = show the strip
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    authService.getTermsStatus(termsCached).then((s) => {
      if (cancelled || !s.userId) return;
      if (s.accepted) return cacheTerms(s.userId);
      if (s.accepted === false) setUserId(s.userId);   // null = couldn't confirm; ask next time
    });
    return () => { cancelled = true; };
  }, []);
  if (!userId) return null;
  // The strip only goes away once the yes is saved on the account — a failed
  // save leaves it up (button live again) rather than pretending it worked.
  function gotIt() {
    if (saving) return;
    setSaving(true);
    authService.recordTermsAcceptance("notice").then((r) => {
      setSaving(false);
      if (r.error) return;
      cacheTerms(userId);
      setUserId(null);
    });
  }
  return (
    React.createElement("div", { className: "legal-notice", role: "status" },
      React.createElement("span", null,
        "We've added ", newTab("/terms", "Terms of Service"), " and a ", newTab("/privacy", "Privacy Policy"),
        ". By continuing to use Nested, you agree to them."
      ),
      React.createElement("button", { className: "btn btn-ghost btn-sm", type: "button", disabled: saving, onClick: gotIt }, saving ? "Saving…" : "Got it")
    )
  );
}

// Small-print links at the foot of the public pages, so the documents are
// reachable from the site itself and not only from the auth screens.
function LegalLinks({ onOpenDoc }) {
  return (
    React.createElement("p", { className: "legal-foot site-foot" },
      docLink("terms", "/terms", "Terms", onOpenDoc), " · ", docLink("privacy", "/privacy", "Privacy", onOpenDoc)
    )
  );
}

export { LegalDoc, LegalNotice, LegalLinks, ConsentCheckbox };
export default LegalDoc;
