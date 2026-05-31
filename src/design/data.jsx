/* ============================================================
   NESTED NYC — Mock data + shared bits
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

  const MAJORS = [
    "Computer Science", "Design / Comm Design", "Business", "Mechanical Eng",
    "Economics", "Fine Arts", "Data Science", "Architecture", "Film / Media",
    "Cognitive Science", "Math", "Marketing", "Music Tech", "Bio / Pre-med", "Undeclared",
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
  const initials = (name) => name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const P = (id, o) => ({ id, saved: false, ...o });

  const PROJECTS = [];

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

  // Seed orgs back the mock event feed until Phase E wires events to Supabase.
  // Ownership is now a DB concern (organizations.owner_user_id), not a flag here.
  const ORGANIZATIONS = [
    {
      id: "nyu-ai-collective", name: "NYU AI Collective", type: "club", uni: "nyu",
      logo: null, banner: null, verified: true,
      bio: "A student-run collective at NYU building and shipping AI projects — from research demos to weekend hacks. Open to every major.",
      website: "https://nyuai.club", instagram: "nyu.ai", location: "NYU Tandon, Brooklyn",
      members: [
        { name: "Maya Chen", role: "admin" },
        { name: "Arjun Patel", role: "admin" },
      ],
      rot: "-1.5deg", createdAt: "2026-01-12T00:00:00.000Z",
    },
    {
      id: "columbia-build", name: "Columbia Build", type: "club", uni: "columbia",
      logo: null, banner: null, verified: true,
      bio: "Columbia's home for builders. We host demo nights, hackathons, and founder office hours every week of term.",
      website: "https://columbiabuild.org", instagram: "columbia.build", location: "Columbia SEAS, Morningside Heights",
      members: [{ name: "Sofia Ramirez", role: "admin" }],
      rot: "2deg", createdAt: "2026-02-02T00:00:00.000Z",
    },
    {
      id: "nyc-founders", name: "NYC Student Founders", type: "other", uni: "nyu",
      logo: null, banner: null, verified: true,
      bio: "A cross-campus community for student founders across NYC. Monthly mixers, pitch nights, and a Slack of 600+ builders.",
      website: "https://nycstudentfounders.com", instagram: "nyc.founders", location: "Across NYC campuses",
      members: [{ name: "Liam O'Brien", role: "admin" }],
      rot: "-2.5deg", createdAt: "2026-01-20T00:00:00.000Z",
    },
  ];
  const ORG = Object.fromEntries(ORGANIZATIONS.map((o) => [o.id, o]));

  const E = (id, o) => ({ id, ...o });
  // Seed events span upcoming + past, across the seed orgs. `going`/`goingNames`
  // drive the facepile; `capacity` drives the "spots left" + capacity bar.
  const EVENTS = [
    E("ai-spring-kickoff", {
      type: "talk", orgId: "nyu-ai-collective", uni: "nyu",
      title: "Spring AI Kickoff Night",
      blurb: "Lightning talks from students shipping AI projects this semester.",
      about: "Kick off the term with five-minute lightning talks from NYU students building with AI — agents, vision, fine-tuning, the works. Stick around for Q&A and meet potential teammates over pizza.",
      mon: "JUN", day: "04", weekday: "Thursday", dateLabel: "June 4, 2026",
      time: "6:00 PM", duration: "2 hours",
      place: "NYU Tandon — Rogers Hall", address: "6 MetroTech Center, Brooklyn, NY",
      tags: ["AI / ML", "Consumer apps"],
      highlights: ["Five 5-minute student lightning talks", "Q&A with NYU AI faculty", "Pizza + open networking after"],
      going: 52, goingNames: ["Maya Chen", "Arjun Patel", "Sofia Ramirez", "Devin Park"],
      capacity: 120, group: "This week", isPast: false, rot: "-2deg", pinType: "tape",
    }),
    E("columbia-demo-night", {
      type: "demo", orgId: "columbia-build", uni: "columbia",
      title: "Columbia Demo Night",
      blurb: "Ten student teams demo what they shipped this term.",
      about: "Our biggest night of the semester. Ten teams get the stage for a live demo and 90 seconds of Q&A. Judges from NYC startups award the room's favorite build.",
      mon: "JUN", day: "06", weekday: "Saturday", dateLabel: "June 6, 2026",
      time: "7:00 PM", duration: "3 hours",
      place: "Columbia SEAS — Davis Auditorium", address: "530 W 120th St, New York, NY",
      tags: ["Startup", "Consumer apps"],
      highlights: ["10 live student demos", "Judges from NYC startups", "Afterparty + networking"],
      going: 88, goingNames: ["Sofia Ramirez", "Jordan Kim", "Wei Zhang", "Tomas Vidal"],
      capacity: 150, group: "This week", isPast: false, rot: "-1deg", pinType: "tape",
    }),
    E("ai-agents-workshop", {
      type: "workshop", orgId: "nyu-ai-collective", uni: "nyu",
      title: "Build Your First AI Agent",
      blurb: "Hands-on workshop: ship a working agent in 90 minutes.",
      about: "Bring a laptop. We'll go from zero to a working tool-using agent in 90 minutes, then turn you loose to build your own. Beginners welcome — we pair every newcomer with a mentor.",
      mon: "JUN", day: "11", weekday: "Thursday", dateLabel: "June 11, 2026",
      time: "5:30 PM", duration: "2 hours",
      place: "NYU Tandon — Makerspace", address: "6 MetroTech Center, Brooklyn, NY",
      tags: ["AI / ML", "Open source"],
      highlights: ["Starter repo + API keys provided", "A mentor for every 3 attendees", "Demo your agent at the end"],
      going: 34, goingNames: ["Priya Nair", "Marcus Lee", "Ana Gomez"],
      capacity: 60, group: "Next week", isPast: false, rot: "1.5deg", pinType: "pin",
    }),
    E("founders-mixer-june", {
      type: "mixer", orgId: "nyc-founders", uni: "nyu",
      title: "Cross-Campus Founders Mixer",
      blurb: "Student founders from every NYC campus, one rooftop.",
      about: "No pitches, no slides — just builders. Meet student founders from NYU, Columbia, Cooper, Parsons, CUNY and Fordham over drinks and a skyline.",
      mon: "JUN", day: "13", weekday: "Friday", dateLabel: "June 13, 2026",
      time: "8:00 PM", duration: "3 hours",
      place: "Williamsburg Rooftop", address: "Wythe Ave, Brooklyn, NY",
      tags: ["Startup", "Social impact"],
      highlights: ["600+ founder community", "Drinks + skyline views", "Bring a co-founder, find a co-founder"],
      going: 140, goingNames: ["Liam O'Brien", "Hana Suzuki", "Raj Mehta", "Bella Cruz"],
      capacity: 200, group: "Next week", isPast: false, rot: "2.5deg", pinType: "tape",
    }),
    E("hack-the-summer", {
      type: "hack", orgId: "nyu-ai-collective", uni: "nyu",
      title: "Hack the Summer",
      blurb: "A 24-hour build sprint to kick off summer projects.",
      about: "Form a team, pick a problem, and ship something in 24 hours. Tracks for AI, civic tech, and consumer apps. Hardware welcome.",
      mon: "JUN", day: "20", weekday: "Saturday", dateLabel: "June 20, 2026",
      time: "10:00 AM", duration: "All day",
      place: "NYU Tandon — Event Hall", address: "6 MetroTech Center, Brooklyn, NY",
      tags: ["AI / ML", "Civic / NYC", "Hardware"],
      highlights: ["24-hour build sprint", "$2k in prizes", "Meals + cold brew all weekend"],
      going: 71, goingNames: ["Maya Chen", "Devin Park", "Ana Gomez", "Marcus Lee"],
      capacity: 100, group: "Later", isPast: false, rot: "-1.5deg", pinType: "pin",
    }),
    // ---- past ----
    E("intro-to-figma", {
      type: "design", orgId: "columbia-build", uni: "columbia",
      title: "Intro to Figma for Builders",
      blurb: "Engineers, learn to prototype your own MVPs fast.",
      about: "A beginner-friendly run through Figma — components, auto-layout, and clickable prototypes — aimed at engineers who want to design their own MVPs.",
      mon: "MAY", day: "21", weekday: "Wednesday", dateLabel: "May 21, 2026",
      time: "6:00 PM", duration: "1.5 hours",
      place: "Columbia SEAS — Mudd 233", address: "500 W 120th St, New York, NY",
      tags: ["Creative tools", "Consumer apps"],
      highlights: ["A starter Figma file to keep", "Live prototype demo", "Open Q&A"],
      going: 40, goingNames: ["Jordan Kim", "Wei Zhang"],
      capacity: 45, group: "Past", isPast: true, rot: "1deg", pinType: "tape",
    }),
    E("ai-welcome-social", {
      type: "social", orgId: "nyu-ai-collective", uni: "nyu",
      title: "AI Collective Welcome Social",
      blurb: "Our first social of the term — 90 new members joined.",
      about: "Welcome social to kick off the semester. We met new members, formed project pods, and set the calendar for the term.",
      mon: "MAY", day: "08", weekday: "Thursday", dateLabel: "May 8, 2026",
      time: "7:00 PM", duration: "2 hours",
      place: "NYU Tandon — Lounge", address: "6 MetroTech Center, Brooklyn, NY",
      tags: ["Social impact"],
      highlights: ["90+ new members", "Project pod sign-ups", "Snacks + music"],
      going: 90, goingNames: ["Maya Chen", "Arjun Patel", "Priya Nair", "Devin Park"],
      capacity: 100, group: "Past", isPast: true, rot: "2deg", pinType: "pin",
    }),
    E("founders-pitch-night", {
      type: "demo", orgId: "nyc-founders", uni: "nyu",
      title: "Spring Pitch Night",
      blurb: "Eight student startups pitched for a $5k grant.",
      about: "Our spring pitch night brought eight student startups to the stage for a shot at a $5k grant and intros to NYC angels.",
      mon: "APR", day: "30", weekday: "Wednesday", dateLabel: "April 30, 2026",
      time: "7:00 PM", duration: "2.5 hours",
      place: "Cornell Tech — Verizon Hall", address: "2 W Loop Rd, New York, NY",
      tags: ["Startup", "Fintech"],
      highlights: ["8 startup pitches", "$5k grant awarded", "Angel investor panel"],
      going: 96, goingNames: ["Liam O'Brien", "Bella Cruz", "Raj Mehta"],
      capacity: 120, group: "Past", isPast: true, rot: "-2deg", pinType: "tape",
    }),
  ];

  // Lookup + filtering helpers (operate on caller-supplied lists so created
  // orgs/events from NestedApp are included alongside the seeds above).
  const findById = (list, id) => (list || []).find((x) => x.id === id) || null;
  const orgEventsOf = (events, orgId) => (events || []).filter((e) => e.orgId === orgId);
  const sortByDay = (events) => [...(events || [])].sort((a, b) => (a.isPast === b.isPast) ? 0 : (a.isPast ? 1 : -1));

  const ROLES = [
    { id: "designer",   label: "Designer",   color: "var(--c-research)" },
    { id: "engineer",   label: "Engineer",   color: "var(--c-class)" },
    { id: "founder",    label: "Founder",    color: "var(--c-startup)" },
    { id: "researcher", label: "Researcher", color: "var(--c-side)" },
    { id: "creative",   label: "Creative",   color: "var(--c-hack)" },
  ];
  const ROLE = Object.fromEntries(ROLES.map((r) => [r.id, r]));

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
  };

  const PR = (id, o) => ({ id, ...o });
  const PEOPLE = [];

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

  export {
    CATEGORIES, CAT, UNIVERSITIES, UNI, MAJORS, INTERESTS, FIELDS, SKILLS,
    PROJECTS, EVENT_TYPES, ETYPE, EVENTS, PEOPLE, ROLES, ROLE, STAGES, COMMITMENTS,
    ORG_TYPES, ORG_TYPE, ORGANIZATIONS, ORG,
    LINK_ICON, avColor, initials, findById, orgEventsOf, sortByDay,
    ownerToken, isProjectAdmin, isProjectOwner,
    STATUSES, STATUS, statusMeta, DEFAULT_STATUS,
  };

  export const NestedData = {
    CATEGORIES, CAT, UNIVERSITIES, UNI, MAJORS, INTERESTS, FIELDS, SKILLS,
    PROJECTS, EVENT_TYPES, ETYPE, EVENTS, PEOPLE, ROLES, ROLE, STAGES, COMMITMENTS,
    ORG_TYPES, ORG_TYPE, ORGANIZATIONS, ORG,
    LINK_ICON, avColor, initials, findById, orgEventsOf, sortByDay,
    ownerToken, isProjectAdmin, isProjectOwner,
    STATUSES, STATUS, statusMeta, DEFAULT_STATUS,
  };
