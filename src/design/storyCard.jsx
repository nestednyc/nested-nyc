/* ============================================================
   NESTED NYC — "Share to story" card
   Renders a 1080×1920 (9:16) Instagram-story image of a profile,
   polaroid-forward, by drawing to a real <canvas> (no DOM-snapshot
   library — those rasterize <foreignObject> to canvas, which is
   unreliable across browsers). Hands off via the native share sheet
   on mobile, with a universal PNG download on every platform.
   ============================================================ */
import React from 'react'
import Icon from './icons'

const { useState } = React;

// Instagram Story canvas, drawn at 2× for crispness.
const W = 1080;
const H = 1920;
const SCALE = 2;
const PAD = 88;

// Palette — hex equivalents of the app's oklch vars, so the card is
// portable (no reliance on canvas oklch support) and matches the UI.
const C = {
  cork: "#cbb89e",
  corkDot: "rgba(150,120,80,0.18)",
  ink: "#39342d",
  inkSoft: "#6c6358",
  inkFaint: "#978d7e",
  accent: "#d6543a",
  accentInk: "#9c3a26",
  paper: "#fdfbf4",
  paperEdge: "#ddd6c8",
};

const TILTS = [-4, 2.5, 5];          // degrees, matches the live .pm-photos fan
const POLA_W = 312;                   // polaroid frame width (drawing units)
const POLA_PAD = 16;                  // white border around the photo
const POLA_CAP = 48;                  // caption strip height at the bottom
const POLA_SPACING = 250;             // horizontal gap between polaroid centers

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // a broken photo just leaves an empty frame
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// draw `text` wrapped to maxWidth, return the y just past the last line
function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text).split(/\s+/);
  let line = "";
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + " " + words[i] : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      const last = maxLines && lines === maxLines - 1;
      ctx.fillText(last ? truncate(ctx, line, maxWidth) : line, x, y);
      lines++;
      y += lineHeight;
      if (maxLines && lines >= maxLines) return y;
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) { ctx.fillText(line, x, y); y += lineHeight; }
  return y;
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

// draw a single row of pill-shaped tags, return the y past the row
function drawTags(ctx, tags, x, y, maxWidth) {
  ctx.font = '23px "Spline Sans Mono", monospace';
  const padX = 18, gap = 12, h = 44;
  let cx = x;
  for (const t of tags) {
    const w = ctx.measureText(t).width + padX * 2;
    if (cx + w > x + maxWidth) break; // single row — drop the rest
    ctx.fillStyle = C.paper;
    roundRect(ctx, cx, y, w, h, h / 2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = C.paperEdge;
    ctx.stroke();
    ctx.fillStyle = C.inkSoft;
    ctx.textAlign = "left";
    ctx.fillText(t, cx + padX, y + 30);
    cx += w + gap;
  }
  return y + h;
}

function drawPolaroid(ctx, cx, cy, deg, img, cap) {
  const photo = POLA_W - POLA_PAD * 2;
  const frameH = POLA_PAD + photo + POLA_CAP;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((deg * Math.PI) / 180);
  // shadow + white frame
  ctx.shadowColor = "rgba(40,30,15,0.32)";
  ctx.shadowBlur = 46;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = C.paper;
  roundRect(ctx, -POLA_W / 2, -frameH / 2, POLA_W, frameH, 3);
  ctx.fill();
  ctx.shadowColor = "transparent";
  // photo (clipped) or empty well
  const px = -POLA_W / 2 + POLA_PAD;
  const py = -frameH / 2 + POLA_PAD;
  ctx.save();
  roundRect(ctx, px, py, photo, photo, 2);
  ctx.clip();
  if (img) {
    // cover-fit the source into the square well
    const s = Math.max(photo / img.width, photo / img.height);
    const dw = img.width * s, dh = img.height * s;
    ctx.drawImage(img, px + (photo - dw) / 2, py + (photo - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = "#efe9da";
    ctx.fillRect(px, py, photo, photo);
  }
  ctx.restore();
  // caption
  if (cap) {
    ctx.fillStyle = C.inkFaint;
    ctx.font = '18px "Spline Sans Mono", monospace';
    ctx.textAlign = "center";
    ctx.fillText(cap, 0, frameH / 2 - 16);
  }
  ctx.restore();
}

async function renderStoryCanvas({ displayName, username, school, major, bio, building, photos, fields, skills }) {
  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "alphabetic";

  // ── background: cork + dot texture ──────────────
  ctx.fillStyle = C.cork;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.corkDot;
  for (let y = 0; y < H; y += 11) {
    for (let x = (y % 22 ? 5 : 0); x < W; x += 11) {
      ctx.beginPath();
      ctx.arc(x, y, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── brand row ───────────────────────────────────
  ctx.save();
  ctx.fillStyle = C.accent;
  roundRect(ctx, PAD, 84, 46, 46, 12);
  ctx.fill();
  ctx.fillStyle = C.paper;
  ctx.font = '800 28px "Bricolage Grotesque", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("N", PAD + 23, 84 + 33);
  ctx.textAlign = "left";
  ctx.font = '800 30px "Bricolage Grotesque", sans-serif';
  ctx.fillStyle = C.ink;
  ctx.fillText("nested", PAD + 60, 84 + 33);
  const nW = ctx.measureText("nested").width;
  ctx.fillStyle = C.accent;
  ctx.fillText(".nyc", PAD + 60 + nW, 84 + 33);
  ctx.restore();

  // ── polaroid fan (the hero) ─────────────────────
  const snaps = (photos || []).filter((p) => p && p.src).slice(0, 3);
  const cluster = snaps.length ? snaps : [{}, {}, {}];
  const imgs = await Promise.all(cluster.map((p) => loadImage(p.src)));
  const frameH = POLA_PAD + (POLA_W - POLA_PAD * 2) + POLA_CAP;
  const heroCY = 900;
  const n = cluster.length;
  const start = -((n - 1) / 2) * POLA_SPACING;
  // draw middle one last so it sits on top
  const order = n === 3 ? [0, 2, 1] : cluster.map((_, i) => i);
  for (const i of order) {
    drawPolaroid(ctx, W / 2 + start + i * POLA_SPACING, heroCY, TILTS[i % 3], imgs[i], cluster[i].cap);
  }

  // ── identity block ──────────────────────────────
  const maxW = W - PAD * 2;
  let y = heroCY + frameH / 2 + 120;

  ctx.textAlign = "left";
  ctx.fillStyle = C.ink;
  ctx.font = '800 84px "Bricolage Grotesque", sans-serif';
  y = wrapText(ctx, displayName || "", PAD, y, maxW, 88, 2);

  const metaBits = ["@" + (username || "you"), school, major].filter(Boolean).join("  ·  ");
  ctx.fillStyle = C.inkSoft;
  ctx.font = '27px "Spline Sans Mono", monospace';
  y += 30;
  ctx.fillText(truncate(ctx, metaBits, maxW), PAD, y);

  if (bio) {
    ctx.fillStyle = C.inkSoft;
    ctx.font = '33px "Hanken Grotesk", sans-serif';
    y += 56;
    y = wrapText(ctx, bio, PAD, y, maxW, 46, 3);
  }

  if (building) {
    ctx.fillStyle = C.inkFaint;
    ctx.font = '25px "Spline Sans Mono", monospace';
    y += 22;
    ctx.fillText(truncate(ctx, "// " + building, maxW), PAD, y);
  }

  // ── interest / skill tags (mirrors the profile) ──
  const tags = [].concat(fields || [], skills || []).filter(Boolean);
  if (tags.length) {
    y += 40;
    drawTags(ctx, tags, PAD, y, maxW);
  }

  // ── footer ──────────────────────────────────────
  const fy = H - 96;
  ctx.strokeStyle = C.paperEdge;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 9]);
  ctx.beginPath();
  ctx.moveTo(PAD, fy - 40);
  ctx.lineTo(W - PAD, fy - 40);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = '24px "Spline Sans Mono", monospace';
  ctx.fillStyle = C.inkFaint;
  ctx.textAlign = "left";
  ctx.fillText("find me on the board", PAD, fy);
  ctx.fillStyle = C.accentInk;
  ctx.textAlign = "right";
  ctx.fillText("nested.nyc", W - PAD, fy);

  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

async function shareOrDownload(blob, username) {
  const fileName = `nested-${username || "profile"}-story.png`;
  const file = new File([blob], fileName, { type: "image/png" });

  // Always download the PNG — reliable on every platform, and the file lands
  // where the user can post it to their story.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  // On touch devices, also open the native share sheet so they can hand the
  // image straight to Instagram. Desktop just gets the download above.
  const coarse =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(pointer: coarse)").matches;
  if (coarse && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "My Nested profile" });
    } catch (e) {
      // dismissed or failed — they still have the download
    }
  }
}

/* Drop-in button for the profile CTA row. */
function ShareStoryButton(props) {
  const [busy, setBusy] = useState(false);

  async function onShare() {
    if (busy) return;
    setBusy(true);
    try {
      // canvas text uses the page's loaded web fonts — wait for them first
      if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch (e) { /* non-fatal */ }
      }
      const canvas = await renderStoryCanvas(props);
      const blob = await canvasToBlob(canvas);
      if (blob) await shareOrDownload(blob, props.username);
    } catch (e) {
      // swallow — nothing to surface cleanly in this MVP
    } finally {
      setBusy(false);
    }
  }

  return React.createElement("button", {
    className: "btn btn-ghost", onClick: onShare,
    disabled: busy,
    style: busy ? { opacity: 0.6, pointerEvents: "none" } : undefined,
    title: "Download a vertical card for your Instagram story",
  },
    React.createElement(Icon, { name: busy ? "clock" : "share", size: 17 }),
    busy ? "Building…" : "Share to story"
  );
}

export { ShareStoryButton, renderStoryCanvas };
export default ShareStoryButton;
