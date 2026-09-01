/* Local-only: render every email to HTML + PNG so we can eyeball them.
   Throwaway tooling — not shipped, not imported by the app.
   Run:  node email-preview/build-preview.mjs
   The band logo comes from EMAIL_LOGO_URL; this script points it at the
   local public/ asset so previews don't depend on the deployed site.      */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const toFileUrl = (p) => "file://" + p.replace(/\\/g, "/");
process.env.EMAIL_LOGO_URL ||= toFileUrl(join(here, "..", "public", "email", "nested-mark-ivory.png"));

const { emails } = await import("../api/_email/template.js");

const outDir = join(here, "out");
await mkdir(outDir, { recursive: true });

// A real-shaped storage URL exercises the photo branch; omitting avatarUrl
// exercises the initials-disc fallback (safeAvatarUrl rejects anything else).
const AVATAR = "https://demo.supabase.co/storage/v1/object/public/avatars/demo/1.jpg";
const unsubUrl = "https://www.nested.social/api/unsubscribe?u=demo&t=demo";

const samples = {
  "01-join-request": emails.joinRequest({
    requesterName: "@maya", school: "Parsons", role: "Backend Engineer",
    projectTitle: "Solar Pitch Deck", projectId: "demo",
    message: "Loved the deck — I've shipped two Supabase backends and can wire up auth + the API this week.",
    avatarUrl: AVATAR, unsubUrl,
  }),
  "02-join-approved": emails.joinApproved({
    ownerName: "@leo", role: "Backend Engineer",
    projectTitle: "Solar Pitch Deck", projectId: "demo", avatarUrl: AVATAR, unsubUrl,
  }),
  "03-club-join-request": emails.clubJoinRequest({
    applicantName: "@maya", school: "Parsons", clubName: "Blockchain Club", avatarUrl: AVATAR, unsubUrl,
  }),
  "04-club-join-accepted": emails.clubJoinAccepted({
    clubName: "Blockchain Club", clubSlug: "blockchain-club", unsubUrl,
  }),
  "05-new-connection": emails.newConnection({
    sourceName: "@priya", school: "Columbia", sourceUsername: "priya", avatarUrl: AVATAR, unsubUrl,
  }),
  "06-new-message": emails.newMessage({
    senderName: "@jordan", school: "NYU", senderUsername: "jordan", avatarUrl: AVATAR, unsubUrl,
  }),
  "07-new-message-noavatar": emails.newMessage({
    senderName: "@sam", school: "NYU", senderUsername: "sam", unsubUrl,
  }),
  "08-new-report": emails.newReport({
    reporterName: "@sam", reporterSchool: "NYU", targetLabel: "a post by @spammer",
    excerpt: "Buy my course", reason: "spam", targetType: "post", targetId: "123",
  }),
  "09-new-org": emails.newOrg({
    name: "Chess Club", type: "club", slug: "chess-club", location: "NYC",
    bio: "We play chess.", ownerEmail: "owner@nyu.edu", school: "NYU",
  }),
  "10-weekly-digest": emails.weeklyDigest({
    firstName: "Hamza", school: "NYU",
    posts: [
      { label: "Shipped our MVP over the weekend — roast it", sub: "win · @maya, Parsons", url: "https://www.nested.social/community/1" },
      { label: "Looking for a designer for a fintech pitch", sub: "ask · @leo, NYU Stern", url: "https://www.nested.social/community/2" },
    ],
    events: [
      { label: "NYC Student Founder Mixer", sub: "Thu Sep 4 · 6:30 PM · SoHo", url: "https://www.nested.social/events/1" },
    ],
    flyers: [
      { label: "Blockchain Club — first GBM of the semester", sub: "NYU Blockchain Club", url: "https://www.nested.social/projects/1" },
    ],
    unsubUrl, digestUnsubUrl: unsubUrl + "&kind=digest",
  }),
  "11-org-verified": emails.orgVerified({ orgName: "Columbia Entrepreneurship", unsubUrl }),
};

for (const [name, { html }] of Object.entries(samples)) {
  await writeFile(join(outDir, name + ".html"), html, "utf8");
}
console.log("wrote", Object.keys(samples).length, "HTML files →", outDir);

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 680, height: 900 }, deviceScaleFactor: 2 });
for (const name of Object.keys(samples)) {
  await page.goto(toFileUrl(join(outDir, name + ".html")));
  try { await page.evaluate(() => document.fonts && document.fonts.ready); } catch {}
  await page.waitForTimeout(900); // let the Google fonts paint
  await page.screenshot({ path: join(outDir, name + ".png"), fullPage: true });
  console.log("shot", name);
}
await browser.close();
console.log("done");
