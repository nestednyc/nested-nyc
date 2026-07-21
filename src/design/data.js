/* ============================================================
   NESTED NYC — Taxonomy + shared bits
   ============================================================ */
  const CATEGORIES = [
    { id: "startup",  label: "Startup",       icon: "startup",  color: "var(--c-startup)",  wash: "oklch(0.62 0.17 33 / .16)",  ink: "oklch(0.42 0.13 33)" },
    { id: "class",    label: "Class Project", icon: "class",    color: "var(--c-class)",    wash: "oklch(0.55 0.13 250 / .16)", ink: "oklch(0.40 0.11 250)" },
    { id: "hack",     label: "Hackathon",     icon: "hack",     color: "var(--c-hack)",     wash: "oklch(0.66 0.13 78 / .20)",  ink: "oklch(0.42 0.1 78)" },
    { id: "side",     label: "Side Project",  icon: "side",     color: "var(--c-side)",     wash: "oklch(0.56 0.12 152 / .16)", ink: "oklch(0.40 0.1 152)" },
    { id: "research", label: "Research",      icon: "research", color: "var(--c-research)", wash: "oklch(0.53 0.14 310 / .16)", ink: "oklch(0.40 0.12 310)" },
  ];
  const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

  const UNIVERSITIES = [
    // logo = each school's brand mark, self-hosted under public/logos/<id>.<ext>
    // (served at /logos/<id>.<ext>). SVG where the school has a vector seal/mark
    // (crisp at any size); hi-res PNG (up to 2400px) otherwise. Sourced from
    // official sites + Wikimedia, normalized square-ish. UniLogo falls back to
    // the colored initial seal if a file is ever missing.
    { id: "nyu",      name: "NYU",          full: "New York University",      domain: "nyu.edu",      color: "oklch(0.45 0.16 300)", logo: "/logos/nyu.svg" },
    { id: "columbia", name: "Columbia",     full: "Columbia University",      domain: "columbia.edu", color: "oklch(0.50 0.13 250)", logo: "/logos/columbia.png" },
    { id: "cooper-union", name: "Cooper Union", full: "The Cooper Union",     domain: "cooper.edu",   color: "oklch(0.45 0.05 60)",  logo: "/logos/cooper-union.svg" },
    { id: "new-school", name: "Parsons",    full: "Parsons / The New School", domain: "newschool.edu",color: "oklch(0.30 0.02 60)",  logo: "/logos/new-school.svg" },
    { id: "cuny",     name: "CUNY",         full: "City University of NY",    domain: "cuny.edu",     color: "oklch(0.50 0.15 35)",  logo: "/logos/cuny.svg" },
    { id: "fordham",  name: "Fordham",      full: "Fordham University",       domain: "fordham.edu",  color: "oklch(0.45 0.13 280)", logo: "/logos/fordham.svg" },
    { id: "pratt",    name: "Pratt",        full: "Pratt Institute",          domain: "pratt.edu",    color: "oklch(0.50 0.13 30)",  logo: "/logos/pratt.png" },
    { id: "sva",      name: "SVA",          full: "School of Visual Arts",    domain: "sva.edu",      color: "oklch(0.45 0.15 0)",   logo: "/logos/sva.svg" },
    { id: "pace",     name: "Pace",         full: "Pace University",          domain: "pace.edu",     color: "oklch(0.45 0.13 70)",  logo: "/logos/pace.png" },
    { id: "nyit",     name: "NYIT",         full: "New York Tech",            domain: "nyit.edu",     color: "oklch(0.45 0.15 250)", logo: "/logos/nyit.png" },
    { id: "juilliard",name: "Juilliard",    full: "The Juilliard School",     domain: "juilliard.edu",color: "oklch(0.40 0.10 20)",  logo: "/logos/juilliard.png" },
    { id: "fit",      name: "FIT",          full: "Fashion Inst. of Tech.",   domain: "fitnyc.edu",   color: "oklch(0.45 0.18 320)", logo: "/logos/fit.png" },
    { id: "st-johns", name: "St. John's",   full: "St. John's University",    domain: "stjohns.edu",  color: "oklch(0.40 0.13 25)",  logo: "/logos/st-johns.png" },
    { id: "yeshiva",  name: "Yeshiva",      full: "Yeshiva University",       domain: "yu.edu",       color: "oklch(0.40 0.13 250)", logo: "/logos/yeshiva.svg" },
    { id: "barnard",  name: "Barnard",      full: "Barnard College",          domain: "barnard.edu",  color: "oklch(0.45 0.13 0)",   logo: "/logos/barnard.png" },
    { id: "manhattan-college", name: "Manhattan", full: "Manhattan College",   domain: "manhattan.edu",color: "oklch(0.40 0.13 240)", logo: "/logos/manhattan-college.svg" },
    { id: "liu",      name: "LIU",          full: "Long Island University",   domain: "liu.edu",      color: "oklch(0.45 0.13 30)",  logo: "/logos/liu.png" },
    { id: "marymount",name: "Marymount",    full: "Marymount Manhattan",      domain: "mmm.edu",      color: "oklch(0.45 0.13 350)", logo: "/logos/marymount.png" },
  ];
  const UNI = Object.fromEntries(UNIVERSITIES.map((u) => [u.id, u]));

  // Email-domain → supported university. Matches the domain exactly OR as a
  // subdomain of a supported domain (baruch.cuny.edu → CUNY), while rejecting
  // look-alikes (notnyu.edu does NOT match nyu.edu). The server enforces the
  // same list in public.is_supported_edu_email() — keep the two in sync.
  function uniByEmailDomain(email) {
    const at = String(email == null ? "" : email).trim().toLowerCase().split("@")[1] || "";
    if (!at) return null;
    return UNIVERSITIES.find((u) => at === u.domain || at.endsWith("." + u.domain)) || null;
  }
  function isSupportedEduEmail(email) {
    return !!uniByEmailDomain(email);
  }

  // An org row's campus → client-taxonomy UNI slug (the color + logo key), or
  // null when it maps to no known campus. A university-type org keys off its own
  // slug; a club/other keys off university_id via the loaded universities list.
  // Single source of truth so the `uni` enrichment can't drift between the
  // adopt paths (hydrateSession, orgView, and org create/edit all call this).
  function resolveOrgUniSlug(org, universities) {
    if (!org) return null;
    if (org.type === "university" && UNI[org.slug]) return org.slug;
    if (org.university_id) {
      const parent = (universities || []).find((u) => u.id === org.university_id);
      return parent && UNI[parent.slug] ? parent.slug : null;
    }
    return null;
  }

  const MAJORS = [
    "Computer Science", "Design / Comm Design", "Business", "Mechanical Eng",
    "Economics", "Fine Arts", "Data Science", "Architecture", "Film / Media",
    "Cognitive Science", "Math", "Marketing", "Music Tech", "Bio / Pre-med",
    "Political Science", "Computer Information Systems", "Undeclared",
  ];

  const INTERESTS = [
    "AI / ML", "Climate", "Fintech", "Consumer apps", "Hardware", "Web3",
    "Health", "Games", "Social impact", "Creative tools", "Robotics", "Music",
    "Fashion tech", "Ed tech", "Food", "Civic / NYC", "AR / VR", "Open source",
  ];

  // Profile editor — discipline areas the student is into (maps to DB profiles.fields)
  const FIELDS = [
    "Engineering", "Design", "Product", "Data Science",
    "Business", "Marketing", "Research", "Arts & Media",
  ];

  // Profile editor — roles/skills the student brings (maps to DB profiles.skills, post-013)
  const SKILLS = [
    "Frontend", "Backend", "Full Stack", "Mobile", "DevOps",
    "UI/UX", "Product Design", "Graphic Design", "Product",
    "Project Mgmt", "Strategy", "Data", "Data Analysis",
    "ML/AI", "Research", "Marketing", "Growth", "Content",
    "Sales", "BD", "Writing", "Video", "Photography",
  ];

  const AV_COLORS = [
    "var(--c-startup)", "var(--c-class)", "var(--c-hack)", "var(--c-side)",
    "var(--c-research)", "oklch(0.55 0.13 200)", "oklch(0.55 0.14 350)", "oklch(0.5 0.12 130)",
  ];
  const avColor = (name) => AV_COLORS[(name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % AV_COLORS.length];
  // Strip a leading "@" (usernames carry one) before deriving initials. Real
  // names ("Eddie Rossi") yield first-of-each-word ("ER"); a single token —
  // e.g. a handle like "@eddierossi" — yields its first two letters ("ED")
  // instead of surfacing the "@".
  const initials = (name) => {
    const parts = String(name || "").replace(/^@+/, "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  // Usernames are stored bare — the "@" is display-only (DB constraint
  // profiles_username_no_leading_at). Legacy rows may still carry a leading
  // "@"; strip before prefixing so nothing renders "@@handle".
  const bareHandle = (username) => String(username || "").replace(/^@+/, "");

  // Username-led person label — the ONE rule for notification emails and the
  // denormalised team_members.name snapshots: "@handle" when the account has
  // a username, else the real name, else `fallback`. Reads BOTH row shapes:
  // DB profiles (first_name/last_name) and cork-board profiles
  // (firstName/lastName). In-app LIVE display deliberately stays with
  // projectAdapter.memberIdentity (full-name-first) — do not reroute it here.
  const personLabel = (p, fallback = "Someone") => {
    const u = bareHandle(p && p.username);
    if (u) return "@" + u;
    const name = [p && (p.first_name || p.firstName), p && (p.last_name || p.lastName)]
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    return name || fallback;
  };

  const EVENT_TYPES = [
    { id: "hack",       label: "Hackathon",  icon: "hack",    color: "var(--c-hack)",     wash: "oklch(0.66 0.13 78 / .20)",  ink: "oklch(0.42 0.1 78)" },
    { id: "demo",       label: "Demo Day",   icon: "sparkle", color: "var(--c-side)",     wash: "oklch(0.56 0.12 152 / .16)", ink: "oklch(0.40 0.1 152)" },
    { id: "mixer",      label: "Mixer",      icon: "users",   color: "var(--c-startup)",  wash: "oklch(0.62 0.17 33 / .16)",  ink: "oklch(0.42 0.13 33)" },
    { id: "workshop",   label: "Workshop",   icon: "code",    color: "var(--c-class)",    wash: "oklch(0.55 0.13 250 / .16)", ink: "oklch(0.40 0.11 250)" },
    { id: "talk",       label: "Talk",       icon: "chat",    color: "var(--c-research)", wash: "oklch(0.53 0.14 310 / .16)", ink: "oklch(0.40 0.12 310)" },
    { id: "networking", label: "Networking", icon: "link",    color: "var(--c-side)",     wash: "oklch(0.56 0.12 152 / .16)", ink: "oklch(0.40 0.1 152)" },
    { id: "social",     label: "Social",     icon: "sparkle", color: "var(--c-startup)",  wash: "oklch(0.62 0.17 33 / .16)",  ink: "oklch(0.42 0.13 33)" },
    { id: "career",     label: "Career",     icon: "flag",    color: "var(--c-class)",    wash: "oklch(0.55 0.13 250 / .16)", ink: "oklch(0.40 0.11 250)" },
    { id: "design",     label: "Design",     icon: "palette", color: "var(--c-research)", wash: "oklch(0.53 0.14 310 / .16)", ink: "oklch(0.40 0.12 310)" },
  ];
  const ETYPE = Object.fromEntries(EVENT_TYPES.map((e) => [e.id, e]));

  // Org types (for the "Pin your org" flow)
  const ORG_TYPES = [
    { id: "club",       label: "Student club", note: "A campus club or student org" },
    { id: "university", label: "University",   note: "An official school or department" },
    { id: "other",      label: "Community",    note: "A collective, lab, or cross-campus group" },
  ];
  const ORG_TYPE = Object.fromEntries(ORG_TYPES.map((o) => [o.id, o]));

  // Lookup + filtering helpers (operate on caller-supplied lists from the
  // live services so created orgs/events are handled uniformly).
  const findById = (list, id) => (list || []).find((x) => x.id === id) || null;
  const orgEventsOf = (events, orgId) => (events || []).filter((e) => e.orgId === orgId);
  const sortByDay = (events) => [...(events || [])].sort((a, b) => (a.isPast === b.isPast) ? 0 : (a.isPast ? 1 : -1));

  const STAGES = [
    { id: "idea",          label: "Just an idea",    note: "Looking for co-founders or first hands" },
    { id: "mvp",           label: "Building MVP",    note: "First version in motion" },
    { id: "recruiting",    label: "Recruiting team", note: "Have the plan, need builders" },
    { id: "active-sprint", label: "Active sprint",   note: "Shipping now — extra help welcome" },
  ];

  const COMMITMENTS = [
    { id: "hackathon",     label: "Hackathon",      note: "1–3 days, sprint hard" },
    { id: "side-project",  label: "Side project",   note: "A few hours a week" },
    { id: "serious-build", label: "Serious build",  note: "15–25 hrs / week" },
    { id: "startup-mode",  label: "Startup mode",   note: "All-in" },
  ];

  // contact link kind -> icon name
  const LINK_ICON = {
    site: "globe", portfolio: "globe", github: "code", linkedin: "external",
    instagram: "camera", email: "mail", calendly: "calendar", twitter: "external",
    dribbble: "palette", figma: "palette", substack: "mail", read: "globe",
    // project-link platforms (detectProjectLink) beyond the profile set
    gitlab: "code", tiktok: "camera", youtube: "camera", discord: "chat",
    slack: "chat", appstore: "download", playstore: "download", devpost: "code",
    notion: "file", behance: "palette", medium: "pencil", itch: "sparkle",
    twitch: "camera", linktree: "link",
  };

  /* ── Project links ("find it online") ─────────────────────────────
     Public links on a flyer: the project's website, app-store page,
     socials — wherever it lives online. One paste-anything resolver:
     raw input → { kind, label, url } with an https-normalized url, or
     null when it isn't a usable http(s) URL. Known platforms brand the
     pill (label + LINK_ICON[kind]); any other host reads as its bare
     domain, which is just as telling on a flyer.                       */
  const PROJECT_LINK_MAX = 4;
  const LINK_BRANDS = [
    ["instagram.com", "instagram", "Instagram"],
    ["github.com", "github", "GitHub"],
    ["gitlab.com", "gitlab", "GitLab"],
    ["linkedin.com", "linkedin", "LinkedIn"],
    ["twitter.com", "twitter", "X / Twitter"],
    ["x.com", "twitter", "X / Twitter"],
    ["tiktok.com", "tiktok", "TikTok"],
    ["youtube.com", "youtube", "YouTube"],
    ["youtu.be", "youtube", "YouTube"],
    ["discord.gg", "discord", "Discord"],
    ["discord.com", "discord", "Discord"],
    ["slack.com", "slack", "Slack"],
    ["apps.apple.com", "appstore", "App Store"],
    ["testflight.apple.com", "appstore", "TestFlight"],
    ["play.google.com", "playstore", "Google Play"],
    ["devpost.com", "devpost", "Devpost"],
    ["substack.com", "substack", "Substack"],
    ["notion.so", "notion", "Notion"],
    ["notion.site", "notion", "Notion"],
    ["figma.com", "figma", "Figma"],
    ["dribbble.com", "dribbble", "Dribbble"],
    ["behance.net", "behance", "Behance"],
    ["medium.com", "medium", "Medium"],
    ["itch.io", "itch", "itch.io"],
    ["twitch.tv", "twitch", "Twitch"],
    ["linktr.ee", "linktree", "Linktree"],
  ];
  function detectProjectLink(input) {
    const raw = (typeof input === "string" ? input : "").trim();
    if (!raw || raw.length > 300) return null;
    // A bare "@handle" reads as an Instagram handle (org muscle memory from
    // the old fixed field). Must run BEFORE the URL parse: WHATWG would parse
    // the @ as empty userinfo and misdetect it as a site. IG charset, 1–30
    // chars, no leading/trailing dot; the canonical URL dedupes against a
    // pasted instagram.com/<handle> link.
    const handle = raw.match(/^@([a-z0-9_](?:[a-z0-9._]{0,28}[a-z0-9_])?)$/i);
    if (handle) {
      return { kind: "instagram", label: "Instagram", url: "https://instagram.com/" + handle[1] };
    }
    // Scheme detection deliberately excludes "." from the scheme charset:
    // no real scheme contains a dot, but "mysite.com:3000" would otherwise
    // read as scheme "mysite.com:" and get silently dropped instead of
    // https-prefixed.
    const withScheme = /^[a-z][a-z0-9+-]*:/i.test(raw) ? raw : "https://" + raw;
    let u;
    try { u = new URL(withScheme); } catch (e) { return null; }
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const host = u.hostname.toLowerCase();
    if (!host.includes(".")) return null;
    const bare = host.replace(/^www\./, "");
    const hit = LINK_BRANDS.find(([d]) => bare === d || bare.endsWith("." + d));
    return {
      kind: hit ? hit[1] : "site",
      label: hit ? hit[2] : bare,
      url: withScheme,
    };
  }
  // Any mix of raw strings / {url} rows → clean [{kind, label, url}]:
  // invalid entries dropped, duplicates collapsed (by url), capped at
  // PROJECT_LINK_MAX. The one normalizer every surface routes through —
  // the form on submit, the adapter in BOTH directions — so the shape
  // can't drift between what's typed, stored, and rendered.
  function cleanProjectLinks(list) {
    const out = [];
    const seen = new Set();
    (Array.isArray(list) ? list : []).forEach((item) => {
      const l = detectProjectLink(typeof item === "string" ? item : item && item.url);
      if (!l || seen.has(l.url)) return;
      seen.add(l.url);
      out.push(l);
    });
    return out.slice(0, PROJECT_LINK_MAX);
  }

  /* ── Project status ───────────────────────────────────────────────
     The live, owner-updatable pulse of a project. Distinct from `stage`
     (set once at create to signal what help you want). Status changes
     often — admins flip it inline from the project page. Each carries a
     tone (ink + wash) so the pill reads at a glance on the board; the
     red "Need Assistance" deliberately pops.                            */
  const STATUSES = [
    { id: "idea",        label: "Idea Stage",       ink: "oklch(0.46 0.10 70)",  wash: "oklch(0.72 0.13 70 / 0.18)" },
    { id: "in-progress", label: "In Progress",      ink: "oklch(0.40 0.11 255)", wash: "oklch(0.55 0.13 255 / 0.14)" },
    { id: "looking",     label: "Looking for Team", ink: "oklch(0.40 0.11 152)", wash: "oklch(0.55 0.13 152 / 0.15)" },
    { id: "need-help",   label: "Need Assistance",  ink: "oklch(0.45 0.17 30)",  wash: "oklch(0.60 0.185 30 / 0.15)" },
    { id: "mvp",         label: "MVP Built",        ink: "oklch(0.41 0.13 310)", wash: "oklch(0.52 0.15 310 / 0.14)" },
    { id: "live",        label: "Live",             ink: "oklch(0.39 0.13 150)", wash: "oklch(0.58 0.16 150 / 0.16)" },
    { id: "paused",      label: "Paused",           ink: "oklch(0.46 0.02 280)", wash: "oklch(0.65 0.02 280 / 0.20)" },
    { id: "completed",   label: "Completed",        ink: "oklch(0.40 0.03 270)", wash: "oklch(0.55 0.03 270 / 0.16)" },
  ];
  const STATUS = Object.fromEntries(STATUSES.map((s) => [s.id, s]));
  const DEFAULT_STATUS = "idea";
  function statusMeta(id) { return STATUS[id] || STATUS[DEFAULT_STATUS]; }

  /* ── Project ownership ────────────────────────────────────────────
     A project is "pinned" by one student (the owner) and editable by a
     set of admins. Today admins == [owner]; later the owner can promote
     team members into `admins[]` so co-admins can edit the flyer too.

     Identity token is profile.id when present (Supabase-hydrated) and
     falls back to the username in local-only mode. Stored on the project
     as ownerId + admins; legacy projects pinned before this model existed
     have neither, so we fall back to the old lead.name===username rule so
     they stay editable.

       isProjectAdmin → can edit the flyer (owner or any co-admin)
       isProjectOwner → can delete it / promote members (owner only)        */
  function ownerToken(profile) {
    if (!profile) return null;
    return profile.id || profile.username || null;
  }
  function isProjectAdmin(project, profile) {
    const me = ownerToken(profile);
    if (!me || !project) return false;
    if (Array.isArray(project.admins) && project.admins.includes(me)) return true;
    if (project.ownerId != null) return project.ownerId === me;
    // legacy fallback: pre-ownership projects keyed by lead display name
    return !!(project.lead && project.lead.name === profile.username);
  }
  function isProjectOwner(project, profile) {
    const me = ownerToken(profile);
    if (!me || !project) return false;
    if (project.ownerId != null) return project.ownerId === me;
    // legacy fallback: pre-ownership projects keyed by lead display name
    return !!(project.lead && project.lead.name === profile.username);
  }
  /* Co-lead derivations — the single definition of "who co-leads", shared by
     the discover card masthead and the detail crew card so the two surfaces
     can't drift. The admins array holds the owner too; co-leads are the TEAM
     rows whose userId carries a grant (the owner isn't in team). */
  function projectAdminSet(project) {
    return new Set(Array.isArray(project && project.admins) ? project.admins : []);
  }
  function coLeadsOf(project) {
    const grants = projectAdminSet(project);
    return ((project && project.team) || []).filter((t) => t.userId && grants.has(t.userId));
  }

  export {
    CATEGORIES, CAT, UNIVERSITIES, UNI, MAJORS, INTERESTS, FIELDS, SKILLS,
    EVENT_TYPES, ETYPE, STAGES, COMMITMENTS,
    ORG_TYPES, ORG_TYPE,
    LINK_ICON, avColor, initials, findById, orgEventsOf, sortByDay,
    ownerToken, isProjectAdmin, isProjectOwner, projectAdminSet, coLeadsOf,
    STATUSES, STATUS, statusMeta, DEFAULT_STATUS,
    uniByEmailDomain, isSupportedEduEmail, resolveOrgUniSlug,
    bareHandle, personLabel,
    detectProjectLink, cleanProjectLinks, PROJECT_LINK_MAX,
  };

  export const NestedData = {
    CATEGORIES, CAT, UNIVERSITIES, UNI, MAJORS, INTERESTS, FIELDS, SKILLS,
    EVENT_TYPES, ETYPE, STAGES, COMMITMENTS,
    ORG_TYPES, ORG_TYPE,
    LINK_ICON, avColor, initials, findById, orgEventsOf, sortByDay,
    ownerToken, isProjectAdmin, isProjectOwner, projectAdminSet, coLeadsOf,
    STATUSES, STATUS, statusMeta, DEFAULT_STATUS,
  };
