/* Local-only: render the Phase-1 emails to HTML + PNG so we can eyeball them.
   Throwaway tooling — not shipped, not imported by the app.
   Run:  node email-preview/build-preview.mjs                                  */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emails } from "../api/_email/template.js";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "out");
await mkdir(outDir, { recursive: true });

const samples = {
  "1-join-request": emails.joinRequest({
    requesterName: "Maya Rodriguez", school: "NYU", role: "Backend Engineer",
    projectTitle: "Solar Pitch Deck", projectId: "demo",
    message: "Loved the deck — I've shipped two Supabase backends and can wire up auth + the API this week.",
  }),
  "2-join-approved": emails.joinApproved({
    ownerName: "Leo Chen", role: "Backend Engineer",
    projectTitle: "Solar Pitch Deck", projectId: "demo",
  }),
  "3-new-connection": emails.newConnection({
    sourceName: "Priya Anand", school: "Columbia", sourceUsername: "priya",
  }),
  "4-org-verified": emails.orgVerified({ orgName: "Columbia Entrepreneurship" }),
};

for (const [name, { html }] of Object.entries(samples)) {
  await writeFile(join(outDir, name + ".html"), html, "utf8");
}
console.log("wrote", Object.keys(samples).length, "HTML files →", outDir);

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 680, height: 900 }, deviceScaleFactor: 2 });
for (const name of Object.keys(samples)) {
  await page.goto("file://" + join(outDir, name + ".html").replace(/\\/g, "/"));
  try { await page.evaluate(() => document.fonts && document.fonts.ready); } catch {}
  await page.waitForTimeout(900); // let the Google fonts paint
  await page.screenshot({ path: join(outDir, name + ".png"), fullPage: true });
  console.log("shot", name);
}
await browser.close();
console.log("done");
