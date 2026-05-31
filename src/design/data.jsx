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
    { id: "nyu",      name: "NYU",          full: "New York University",      domain: "nyu.edu",      color: "oklch(0.45 0.16 300)" },
    { id: "columbia", name: "Columbia",     full: "Columbia University",      domain: "columbia.edu", color: "oklch(0.50 0.13 250)" },
    { id: "cooper",   name: "Cooper Union", full: "The Cooper Union",         domain: "cooper.edu",   color: "oklch(0.45 0.05 60)" },
    { id: "parsons",  name: "Parsons",      full: "Parsons / The New School", domain: "newschool.edu",color: "oklch(0.30 0.02 60)" },
    { id: "cuny",     name: "CUNY",         full: "City University of NY",    domain: "cuny.edu",     color: "oklch(0.50 0.15 35)" },
    { id: "fordham",  name: "Fordham",      full: "Fordham University",       domain: "fordham.edu",  color: "oklch(0.45 0.13 280)" },
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

  const AV_COLORS = [
    "var(--c-startup)", "var(--c-class)", "var(--c-hack)", "var(--c-side)",
    "var(--c-research)", "oklch(0.55 0.13 200)", "oklch(0.55 0.14 350)", "oklch(0.5 0.12 130)",
  ];
  const avColor = (name) => AV_COLORS[(name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % AV_COLORS.length];
  const initials = (name) => name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const P = (id, o) => ({ id, saved: false, ...o });

  const PROJECTS = [];

  const EVENT_TYPES = [
    { id: "hack",     label: "Hackathon", icon: "hack",     color: "var(--c-hack)",     wash: "oklch(0.66 0.13 78 / .20)",  ink: "oklch(0.42 0.1 78)" },
    { id: "demo",     label: "Demo Day",  icon: "sparkle",  color: "var(--c-side)",     wash: "oklch(0.56 0.12 152 / .16)", ink: "oklch(0.40 0.1 152)" },
    { id: "mixer",    label: "Mixer",     icon: "users",    color: "var(--c-startup)",  wash: "oklch(0.62 0.17 33 / .16)",  ink: "oklch(0.42 0.13 33)" },
    { id: "workshop", label: "Workshop",  icon: "code",     color: "var(--c-class)",    wash: "oklch(0.55 0.13 250 / .16)", ink: "oklch(0.40 0.11 250)" },
    { id: "talk",     label: "Talk",      icon: "chat",     color: "var(--c-research)", wash: "oklch(0.53 0.14 310 / .16)", ink: "oklch(0.40 0.12 310)" },
  ];
  const ETYPE = Object.fromEntries(EVENT_TYPES.map((e) => [e.id, e]));

  const E = (id, o) => ({ id, ...o });
  const EVENTS = [];

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

  export {
    CATEGORIES, CAT, UNIVERSITIES, UNI, MAJORS, INTERESTS,
    PROJECTS, EVENT_TYPES, ETYPE, EVENTS, PEOPLE, ROLES, ROLE, STAGES, COMMITMENTS,
    LINK_ICON, avColor, initials,
  };

  export const NestedData = {
    CATEGORIES, CAT, UNIVERSITIES, UNI, MAJORS, INTERESTS,
    PROJECTS, EVENT_TYPES, ETYPE, EVENTS, PEOPLE, ROLES, ROLE, STAGES, COMMITMENTS,
    LINK_ICON, avColor, initials,
  };
