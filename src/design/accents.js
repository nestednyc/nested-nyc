// The accent palette. Production code resolves the active accent from it
// (NestedApp maps t.accent → --accent/--accent-ink/--accent-wash on the root),
// and the dev-only tweaks panel offers the same entries as swatches. It lives
// here — not in tweaks-panel.jsx — so this prod-facing constant doesn't live
// in the panel file. (That file is still on the prod path for useTweaks —
// only the StyleTweaks panel UI inside it is dev-only.)
export const ACCENTS = [
    { v: "oklch(0.60 0.185 30)",  ink: "oklch(0.42 0.16 32)",  wash: "oklch(0.60 0.185 30 / 0.12)" },
    { v: "oklch(0.55 0.13 255)",  ink: "oklch(0.40 0.11 255)", wash: "oklch(0.55 0.13 255 / 0.12)" },
    { v: "oklch(0.55 0.13 152)",  ink: "oklch(0.40 0.11 152)", wash: "oklch(0.55 0.13 152 / 0.12)" },
    { v: "oklch(0.52 0.15 310)",  ink: "oklch(0.40 0.13 310)", wash: "oklch(0.52 0.15 310 / 0.12)" },
];
