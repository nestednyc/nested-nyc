/* ============================================================
   NESTED NYC — "Share to story" card
   Renders a 1080×1920 (9:16) Instagram-story image of a profile as
   "the pinned page": a torn-edge paper sheet pinned to a vignetted
   cork board, with the three polaroids fastened by real masking-tape
   and a glossy push-pin, plus a distressed postmark seal. Drawn to a
   real <canvas> (no DOM-snapshot lib — those rasterize <foreignObject>
   to canvas, which is unreliable across browsers). Hands off via the
   native share sheet on mobile, with a universal PNG download.
   ============================================================ */
import React from 'react'
import Icon from './icons'

const { useState } = React;

// Instagram Story canvas, drawn at 2× for crispness.
const W = 1080;
const H = 1920;
const SCALE = 2;

// Palette — hex equivalents of the app's oklch vars (portable; no reliance
// on canvas oklch support) plus a few warm extensions for the paper/tape/pin.
const C = {
  cork: "#cbb89e",
  corkDark: "#b09877",
  corkLight: "#d8c8af",
  ink: "#39342d",
  inkSoft: "#6c6358",
  inkFaint: "#978d7e",
  bodyInk: "#5a5147",
  accent: "#d6543a",
  accentInk: "#9c3a26",
  paper: "#fdfbf4",
  paperWarm: "#f7f1e3",
  paperShade: "#efe7d4",
  paperEdge: "#ddd6c8",
  tape: "rgba(228,210,150,0.62)",
  tapeEdge: "rgba(150,130,70,0.30)",
  pinRed: "#d6543a",
  pinHi: "#f0a594",
  thread: "#b8a888",
  stampRed: "#c0492f",
};

// Card surface geometry (drawing units within the 1080×1920 space).
const CARD_X = 56;
const CARD_Y = 150;
const CARD_W = W - CARD_X * 2;        // 968
const CARD_BOTTOM = 1772;
const INPAD = 72;                      // inner padding from the card edge
const TX = CARD_X + INPAD;             // 128 — text origin x
const MAXW = CARD_W - INPAD * 2;       // 824 — text wrap width

// Polaroid hero.
const TILTS = [-5, 2, 6];              // amplified .pm-photos energy
const CY_OFFSET = [10, -14, 6];        // hand-placed vertical stagger
const POLA_W = 332;
const POLA_PAD = 18;
const POLA_CAP = 56;
const POLA_SPACING = 244;              // overlapping, hand-stacked
const FRAMEH = POLA_PAD + (POLA_W - POLA_PAD * 2) + POLA_CAP;  // 370
const HERO_CY = 560;

// deterministic [0,1) so edges/grain are stable across renders
function hash(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

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

// trace a torn / deckled paper-sheet path (left+right deckled, bottom ripped)
function tornCardPath(ctx, x, y, w, h) {
  const step = 24, J = 5;
  const right = x + w, bottom = y + h;
  let i = 1;
  ctx.beginPath();
  ctx.moveTo(x + 4, y);
  ctx.lineTo(right - 4, y);
  ctx.quadraticCurveTo(right, y, right, y + 4);
  for (let cy = y + 4 + step; cy < bottom - 10; cy += step) {
    ctx.lineTo(right + (hash(i++) - 0.5) * 2 * J, cy);
  }
  ctx.lineTo(right, bottom - 10);
  for (let cx = right - 8; cx > x + 8; cx -= 18) {
    const yy = bottom + Math.sin(cx / 90) * 6 + (hash(i++) - 0.5) * 8;
    ctx.lineTo(cx, yy);
  }
  ctx.lineTo(x, bottom - 10);
  for (let cy = bottom - 10 - step; cy > y + 4; cy -= step) {
    ctx.lineTo(x + (hash(i++) - 0.5) * 2 * J, cy);
  }
  ctx.lineTo(x, y + 4);
  ctx.quadraticCurveTo(x, y, x + 4, y);
  ctx.closePath();
}

// glossy push-pin
function drawPin(ctx, cx, cy, deg, withStem) {
  ctx.save();
  ctx.translate(cx, cy);
  if (deg) ctx.rotate((deg * Math.PI) / 180);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 4;
  if (withStem) {
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(5, 20);
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(-4, -4, 1, 0, 0, 14);
  g.addColorStop(0, C.pinHi);
  g.addColorStop(0.5, C.pinRed);
  g.addColorStop(1, C.accentInk);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.arc(-4, -5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// masking-tape strip — call inside a polaroid's rotated frame space
function drawTape(ctx, extraDeg) {
  ctx.save();
  ctx.translate(0, -FRAMEH / 2 - 4);
  ctx.rotate((extraDeg * Math.PI) / 180);
  const tw = 104, th = 30;
  ctx.save();
  ctx.shadowColor = "rgba(20,15,0,0.30)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = C.tape;
  ctx.fillRect(-tw / 2, -th / 2, tw, th);
  ctx.restore();
  // long-edge shadows
  ctx.strokeStyle = C.tapeEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-tw / 2, -th / 2); ctx.lineTo(tw / 2, -th / 2);
  ctx.moveTo(-tw / 2, th / 2); ctx.lineTo(tw / 2, th / 2);
  ctx.stroke();
  // matte striations
  ctx.strokeStyle = "rgba(255,255,255,0.20)";
  ctx.lineWidth = 5;
  for (const sx of [-30, -6, 18, 38]) {
    ctx.beginPath();
    ctx.moveTo(sx, -th / 2 + 2);
    ctx.lineTo(sx, th / 2 - 2);
    ctx.stroke();
  }
  ctx.restore();
}

// curved text around a circle (postmark). top=true reads along the top arc.
function arcText(ctx, str, radius, top) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const stepA = 0.135;
  for (let i = 0; i < str.length; i++) {
    const off = (i - (str.length - 1) / 2) * stepA;
    ctx.save();
    if (top) {
      ctx.rotate(off);
      ctx.translate(0, -radius);
    } else {
      ctx.rotate(-off);
      ctx.translate(0, radius);
      ctx.rotate(Math.PI);
    }
    ctx.fillText(str[i], 0, 0);
    ctx.restore();
  }
  ctx.textBaseline = "alphabetic";
}

// distressed rubber-stamp seal
function drawPostmark(ctx, cx, cy, year) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-12 * Math.PI) / 180);
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = C.stampRed;
  ctx.fillStyle = C.stampRed;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 64, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2); ctx.stroke();
  ctx.font = '600 16px "Spline Sans Mono", monospace';
  arcText(ctx, "NESTED · SOCIAL", 44, true);
  arcText(ctx, "STUDENT BUILT", 44, false);
  ctx.font = '800 24px "Bricolage Grotesque", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("'" + year, 0, 1);
  ctx.textBaseline = "alphabetic";
  // ink-gap distress
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = C.paperWarm;
  for (let i = 0; i < 28; i++) {
    const a = hash(i * 3.13) * Math.PI * 2;
    const r = hash(i * 7.71) * 66;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 0.5 + hash(i) * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// wrap `text` to maxWidth, return the y just past the last line.
// draw=false measures only (advances y identically without painting).
function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines, draw) {
  const words = String(text).split(/\s+/);
  let line = "", lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + " " + words[i] : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      const last = maxLines && lines === maxLines - 1;
      if (draw) ctx.fillText(last ? truncate(ctx, line, maxWidth) : line, x, y);
      lines++;
      y += lineHeight;
      if (maxLines && lines >= maxLines) return y;
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) { if (draw) ctx.fillText(line, x, y); y += lineHeight; }
  return y;
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

function pill(ctx, x, y, w, h, fill, stroke, dash) {
  if (dash) ctx.setLineDash(dash);
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.setLineDash([]);
}

// category-tinted tag pills, up to 2 rows + a "+N" overflow chip.
// draw=false measures only (returns the same bottom-y without painting).
function drawTags(ctx, tags, x, y, maxWidth, draw) {
  ctx.font = '500 24px "Spline Sans Mono", monospace';
  const padX = 20, gap = 12, h = 46, rowGap = 12, maxRows = 2;
  let cx = x, cy = y, row = 0, drawn = 0;
  for (let k = 0; k < tags.length; k++) {
    const t = tags[k];
    const w = ctx.measureText(t.label).width + padX * 2;
    if (cx + w > x + maxWidth) {
      row++;
      if (row >= maxRows) break;
      cx = x;
      cy += h + rowGap;
    }
    if (draw) {
      if (t.kind === "field") {
        pill(ctx, cx, cy, w, h, "rgba(214,84,58,0.12)", "rgba(214,84,58,0.45)");
        ctx.fillStyle = C.accentInk;
      } else {
        pill(ctx, cx, cy, w, h, C.paperWarm, C.paperEdge);
        ctx.fillStyle = C.inkSoft;
      }
      ctx.textAlign = "left";
      ctx.fillText(t.label, cx + padX, cy + 31);
    }
    cx += w + gap;
    drawn++;
  }
  if (drawn < tags.length) {
    const label = "+" + (tags.length - drawn);
    const w = ctx.measureText(label).width + padX * 1.4;
    if (cx + w <= x + maxWidth) {
      if (draw) {
        pill(ctx, cx, cy, w, h, C.paper, C.paperEdge, [3, 3]);
        ctx.fillStyle = C.inkFaint;
        ctx.textAlign = "left";
        ctx.fillText(label, cx + padX * 0.7, cy + 31);
      }
    }
  }
  return cy + h;
}

// Lay out (measure or draw) the identity block from a given top baseline.
// Returns the y past the last element. Centralizes the spacing so the block
// can be measured first, then vertically centered.
function layoutIdentity(ctx, d, startY, draw) {
  let y = startY;
  ctx.textAlign = "left";
  ctx.font = '800 88px "Bricolage Grotesque", sans-serif';
  if (draw) ctx.fillStyle = C.ink;
  y = wrapText(ctx, d.displayName || "", TX, y, MAXW, 90, 2, draw);

  ctx.font = '500 27px "Spline Sans Mono", monospace';
  y += 34;
  if (draw) { ctx.fillStyle = C.inkSoft; ctx.fillText(truncate(ctx, d.metaBits, MAXW), TX, y); }

  if (d.bio) {
    ctx.font = '400 34px "Hanken Grotesk", sans-serif';
    y += 52;
    if (draw) ctx.fillStyle = C.bodyInk;
    y = wrapText(ctx, d.bio, TX, y, MAXW, 47, 3, draw);
    y -= 47;
  }

  if (d.building) {
    ctx.font = '500 25px "Spline Sans Mono", monospace';
    y += 50;
    if (draw) { ctx.fillStyle = C.accentInk; ctx.fillText(truncate(ctx, "// " + d.building, MAXW), TX, y); }
  }

  if (d.tags.length) {
    y += 46;
    y = drawTags(ctx, d.tags, TX, y, MAXW, draw);
  }
  return y;
}

function drawPolaroid(ctx, cx, cy, deg, img, cap, idx, fastener) {
  const photo = POLA_W - POLA_PAD * 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((deg * Math.PI) / 180);
  // frame with a hair of warmth variance + tight seated shadow
  ctx.save();
  ctx.shadowColor = "rgba(35,25,10,0.34)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = ["#fdfbf4", "#fbf8ef", "#fdfaf2"][idx % 3];
  roundRect(ctx, -POLA_W / 2, -FRAMEH / 2, POLA_W, FRAMEH, 4);
  ctx.fill();
  ctx.restore();
  // photo well
  const px = -POLA_W / 2 + POLA_PAD;
  const py = -FRAMEH / 2 + POLA_PAD;
  ctx.save();
  roundRect(ctx, px, py, photo, photo, 2);
  ctx.clip();
  if (img) {
    const s = Math.max(photo / img.width, photo / img.height);
    const dw = img.width * s, dh = img.height * s;
    ctx.drawImage(img, px + (photo - dw) / 2, py + (photo - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = "#efe9da";
    ctx.fillRect(px, py, photo, photo);
  }
  ctx.restore();
  // seated edge so the photo doesn't float
  roundRect(ctx, px, py, photo, photo, 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.stroke();
  // caption
  if (cap) {
    ctx.fillStyle = C.inkSoft;
    ctx.font = '400 18px "Spline Sans Mono", monospace';
    ctx.textAlign = "center";
    ctx.fillText(truncate(ctx, cap, POLA_W - 24), 0, FRAMEH / 2 - 18);
  }
  // fastener (still in rotated frame space)
  if (fastener === "pin") {
    drawPin(ctx, 0, -FRAMEH / 2 - 2, 0, true);
  } else if (fastener === "tape-left") {
    drawTape(ctx, 7 - deg);
  } else if (fastener === "tape-right") {
    drawTape(ctx, -7 - deg);
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

  // ── 1. cork board: radial glow → dot grid → edge vignette ──
  let g = ctx.createRadialGradient(540, 720, 0, 540, 720, 1150);
  g.addColorStop(0, C.corkLight);
  g.addColorStop(0.55, C.cork);
  g.addColorStop(1, C.corkDark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(120,95,55,0.16)";
  for (let y = 0; y < H; y += 13) {
    for (let x = (y % 26 ? 6.5 : 0); x < W; x += 13) {
      ctx.beginPath(); ctx.arc(x, y, 0.8, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = "rgba(252,250,244,0.20)";
  for (let y = 9; y < H; y += 17) {
    for (let x = 8; x < W; x += 17) {
      ctx.beginPath(); ctx.arc(x, y, 0.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  g = ctx.createRadialGradient(540, 960, 760, 540, 960, 1150);
  g.addColorStop(0, "rgba(70,52,28,0)");
  g.addColorStop(1, "rgba(70,52,28,0.22)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // ── 2. the torn paper card ──────────────────────
  ctx.save();
  ctx.shadowColor = "rgba(40,28,12,0.40)";
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 34;
  tornCardPath(ctx, CARD_X, CARD_Y, CARD_W, CARD_BOTTOM - CARD_Y);
  ctx.fillStyle = C.paperWarm;
  ctx.fill();
  ctx.restore();
  // fill + grain, clipped to the sheet
  ctx.save();
  tornCardPath(ctx, CARD_X, CARD_Y, CARD_W, CARD_BOTTOM - CARD_Y);
  ctx.clip();
  g = ctx.createLinearGradient(0, CARD_Y, 0, CARD_BOTTOM);
  g.addColorStop(0, C.paperWarm);
  g.addColorStop(1, C.paperShade);
  ctx.fillStyle = g;
  ctx.fillRect(CARD_X - 10, CARD_Y - 10, CARD_W + 20, CARD_BOTTOM - CARD_Y + 30);
  for (let i = 0; i < 900; i++) {
    const rx = CARD_X + hash(i * 1.7) * CARD_W;
    const ry = CARD_Y + hash(i * 2.9) * (CARD_BOTTOM - CARD_Y);
    ctx.fillStyle = i % 2 ? "rgba(120,95,55,0.04)" : "rgba(255,255,255,0.05)";
    ctx.beginPath(); ctx.arc(rx, ry, 0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // paper-thickness edge + top highlight
  tornCardPath(ctx, CARD_X + 2, CARD_Y + 2, CARD_W - 4, CARD_BOTTOM - CARD_Y - 4);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(120,95,55,0.18)";
  ctx.stroke();
  // pin the sheet to the board
  drawPin(ctx, CARD_X + 70, CARD_Y + 6, -8, false);
  drawPin(ctx, CARD_X + CARD_W - 70, CARD_Y + 6, 8, false);

  // ── 3. brand mark (a tag on the board, in the top cork margin) ──
  ctx.save();
  ctx.fillStyle = C.accentInk;
  roundRect(ctx, CARD_X + 14, 84 + 2, 48, 48, 13);
  ctx.fill();
  ctx.fillStyle = C.accent;
  roundRect(ctx, CARD_X + 14, 84, 48, 48, 13);
  ctx.fill();
  ctx.fillStyle = C.paper;
  ctx.font = '800 30px "Bricolage Grotesque", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("N", CARD_X + 14 + 24, 84 + 34);
  ctx.textAlign = "left";
  ctx.font = '800 30px "Bricolage Grotesque", sans-serif';
  ctx.fillStyle = C.ink;
  const bx = CARD_X + 74;
  ctx.fillText("nested", bx, 84 + 34);
  ctx.fillStyle = C.accent;
  ctx.fillText(".social", bx + ctx.measureText("nested").width, 84 + 34);
  ctx.restore();

  // ── 4. polaroid hero — taped & pinned ───────────
  const snaps = (photos || []).filter((p) => p && p.src).slice(0, 3);
  const cluster = snaps.length ? snaps : [{}, {}, {}];
  const imgs = await Promise.all(cluster.map((p) => loadImage(p.src)));
  const n = cluster.length;
  const start = -((n - 1) / 2) * POLA_SPACING;
  const fasteners = ["tape-left", "tape-right", "pin"]; // by index 0,1,2 below
  const order = n === 3 ? [0, 2, 1] : cluster.map((_, i) => i);
  for (const i of order) {
    const f = n === 3 ? (i === 1 ? "pin" : i === 0 ? "tape-left" : "tape-right") : "pin";
    drawPolaroid(
      ctx,
      W / 2 + start + i * POLA_SPACING,
      HERO_CY + (CY_OFFSET[i] || 0),
      TILTS[i % 3],
      imgs[i],
      cluster[i].cap,
      i,
      f
    );
  }

  // ── 5. postmark seal (top-right of the sheet) ───
  drawPostmark(ctx, CARD_X + CARD_W - 158, CARD_Y + 172, "26");

  // ── 6+7+8. identity block — measured, then vertically centered ──
  const metaBits = ["@" + (username || "you"), school, major].filter(Boolean).join("  ·  ");
  const tags = []
    .concat((fields || []).map((f) => ({ label: f, kind: "field" })))
    .concat((skills || []).map((s) => ({ label: s, kind: "skill" })))
    .filter((t) => t.label);
  const data = { displayName, metaBits, bio, building, tags };

  // band between the polaroid hero and the footer rule
  const polaroidBottom = HERO_CY + FRAMEH / 2 + Math.max.apply(null, CY_OFFSET);
  const footerDashedY = CARD_BOTTOM - 64 - 40;
  const bandTop = polaroidBottom + 96;     // leave room for the tab-rule
  const bandBottom = footerDashedY - 56;

  const blockH = layoutIdentity(ctx, data, 0, false); // measure
  let startY = bandTop + Math.max(0, (bandBottom - bandTop - blockH) / 2) + 60; // +ascent fudge

  // accent tab-rule sits just above the name
  const ruleY = startY - 52;
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.accent;
  ctx.beginPath(); ctx.moveTo(TX, ruleY); ctx.lineTo(TX + 80, ruleY); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = C.thread;
  ctx.beginPath(); ctx.moveTo(TX + 80, ruleY); ctx.lineTo(CARD_X + CARD_W - INPAD, ruleY); ctx.stroke();

  layoutIdentity(ctx, data, startY, true); // draw

  // ── 9. registration ticks (print-shop corners) ──
  ctx.lineWidth = 1;
  ctx.strokeStyle = C.thread;
  const tick = 14, ins = 40;
  const corners = [
    [CARD_X + ins, CARD_Y + ins, 1, 1],
    [CARD_X + CARD_W - ins, CARD_Y + ins, -1, 1],
    [CARD_X + ins, CARD_BOTTOM - ins, 1, -1],
    [CARD_X + CARD_W - ins, CARD_BOTTOM - ins, -1, -1],
  ];
  for (const [mx, my, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(mx, my); ctx.lineTo(mx + tick * sx, my);
    ctx.moveTo(mx, my); ctx.lineTo(mx, my + tick * sy);
    ctx.stroke();
  }

  // ── 10. footer (inside the sheet) ───────────────
  const fy = CARD_BOTTOM - 64;
  ctx.strokeStyle = C.paperEdge;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 9]);
  ctx.beginPath();
  ctx.moveTo(TX, fy - 40);
  ctx.lineTo(CARD_X + CARD_W - INPAD, fy - 40);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = '400 24px "Spline Sans Mono", monospace';
  ctx.fillStyle = C.inkFaint;
  ctx.textAlign = "left";
  ctx.fillText("find me on the board", TX, fy);
  ctx.font = '600 24px "Spline Sans Mono", monospace';
  ctx.fillStyle = C.accentInk;
  ctx.textAlign = "right";
  ctx.fillText("nested.social", CARD_X + CARD_W - INPAD, fy);

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
