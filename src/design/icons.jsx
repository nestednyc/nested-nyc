/* ============================================================
   NESTED NYC — Custom line-icon set (no emoji)
   Single weight, 24px grid, round caps. Exported as <Icon/>.
   ============================================================ */
import React from 'react'

// category + ui icon path data
  const ICONS = {
    // categories
    startup: `<path d="M12 2c3 2 4.5 5.5 4.5 9 0 2-.7 3.8-1.6 5H9.1C8.2 14.8 7.5 13 7.5 11c0-3.5 1.5-7 4.5-9Z"/><circle cx="12" cy="9.5" r="1.8"/><path d="M9.1 16c-1.6.6-2.6 2-2.6 4M14.9 16c1.6.6 2.6 2 2.6 4M12 16.8V21"/>`,
    class: `<path d="M12 6c-1.8-1.3-4-1.8-6.5-1.8V18c2.5 0 4.7.5 6.5 1.8 1.8-1.3 4-1.8 6.5-1.8V4.2C16 4.2 13.8 4.7 12 6Z"/><path d="M12 6v13.8"/>`,
    hack: `<path d="M13.5 2 4 13.2h6L9 22l9.5-11.2h-6L13.5 2Z"/>`,
    side: `<path d="m14.5 6.5 3 3M4 20l6.2-6.2M14.5 6.5a3.5 3.5 0 0 1 4.8-4.8l-2.6 2.6.7 2 2 .7 2.6-2.6a3.5 3.5 0 0 1-4.8 4.8"/><path d="M10.2 13.8 6.5 9.2 4 8l-2-2 2.5-2.5 2 2 1.2 2.5 4.6 3.7"/>`,
    research: `<path d="M9.5 3v6.2L4.6 17a2 2 0 0 0 1.7 3h11.4a2 2 0 0 0 1.7-3l-4.9-7.8V3"/><path d="M8 3h8M7.5 14h9"/>`,
    grid: `<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>`,

    // ui
    search: `<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>`,
    message: `<path d="M4 18V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8l-4 4Z"/>`,
    bell: `<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7"/><path d="M10 20a2 2 0 0 0 4 0"/>`,
    plus: `<path d="M12 5v14M5 12h14"/>`,
    bookmark: `<path d="M6 4h12v16l-6-3.5L6 20Z"/>`,
    calendar: `<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>`,
    matches: `<path d="M12 20.5 4.2 12.8a4.6 4.6 0 0 1 6.5-6.5l1.3 1.3 1.3-1.3a4.6 4.6 0 0 1 6.5 6.5Z"/>`,
    user: `<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>`,
    pin: `<path d="M9 3.5h6l-1 5 3 3.5v2H7v-2l3-3.5-1-5Z"/><path d="M12 14v6.5"/>`,
    arrowLeft: `<path d="M19 12H5M11 6l-6 6 6 6"/>`,
    arrowRight: `<path d="M5 12h14M13 6l6 6-6 6"/>`,
    check: `<path d="M20 6 9 17l-5-5"/>`,
    x: `<path d="M6 6l12 12M18 6 6 18"/>`,
    map: `<path d="M9 3 3.5 5v16L9 19l6 2 5.5-2V3L15 5 9 3Z"/><path d="M9 3v16M15 5v16"/>`,
    clock: `<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>`,
    users: `<circle cx="9" cy="8" r="3.5"/><path d="M3 19.5a6 6 0 0 1 12 0"/><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M16.5 14.4a6 6 0 0 1 4.5 5.1"/>`,
    send: `<path d="M21 4 3 11l6 2.5L12 20l3-7 6-9Z"/><path d="m9 13.5 4-2.5"/>`,
    sparkle: `<path d="M12 3c.5 4 1.5 5 6 6-4.5 1-5.5 2-6 6-.5-4-1.5-5-6-6 4.5-1 5.5-2 6-6Z"/>`,
    bolt: `<path d="M13.5 2 4 13.2h6L9 22l9.5-11.2h-6L13.5 2Z"/>`,
    flag: `<path d="M6 21V4M6 4h11l-2 4 2 4H6"/>`,
    code: `<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12"/>`,
    palette: `<path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2 0-1.5 1-2 2.5-2H18a3 3 0 0 0 3-3c0-5-4-9-9-9Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="11" cy="7.5" r="1"/><circle cx="15.5" cy="8.5" r="1"/>`,
    chat: `<path d="M4 18V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8l-4 4Z"/><path d="M8.5 9h7M8.5 12h4"/>`,
    refresh: `<path d="M20 11a8 8 0 1 0-1.6 5"/><path d="M20 4v6h-6"/>`,
    mail: `<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>`,
    link: `<path d="M10 14a4 4 0 0 0 6 .5l2.5-2.5a4 4 0 0 0-5.7-5.7l-1.3 1.3"/><path d="M14 10a4 4 0 0 0-6-.5L5.5 12a4 4 0 0 0 5.7 5.7l1.3-1.3"/>`,
    external: `<path d="M14 5h5v5M19 5l-8 8"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>`,
    globe: `<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 2.5 14.5 0 17M12 3.5c-2.5 2.5-2.5 14.5 0 17"/>`,
    camera: `<path d="M4 8a2 2 0 0 1 2-2h1.5l1-2h7l1 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><circle cx="12" cy="12.5" r="3.2"/>`,
    skip: `<path d="M6 6l12 12M18 6 6 18"/>`,
    heart: `<path d="M12 20.5 4.2 12.8a4.6 4.6 0 0 1 6.5-6.5l1.3 1.3 1.3-1.3a4.6 4.6 0 0 1 6.5 6.5Z"/>`,
    undo: `<path d="M9 7 4 12l5 5"/><path d="M4 12h11a5 5 0 0 1 0 10h-1"/>`,
    share: `<circle cx="6" cy="12" r="2.6"/><circle cx="17" cy="5.5" r="2.6"/><circle cx="17" cy="18.5" r="2.6"/><path d="M8.3 10.8 14.7 6.7M8.3 13.2l6.4 4.1"/>`,
    block: `<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>`,
    ellipsis: `<path d="M6 12h.01"/><path d="M12 12h.01"/><path d="M18 12h.01"/>`,
  };

  function Icon({ name, size = 22, stroke = "currentColor", width = 1.8, fill = "none", style, className }) {
    const d = ICONS[name];
    if (!d) return null;
    return React.createElement("svg", {
      viewBox: "0 0 24 24", width: size, height: size, fill, stroke,
      strokeWidth: width, strokeLinecap: "round", strokeLinejoin: "round",
      style, className, dangerouslySetInnerHTML: { __html: d },
    });
  }

  export const ICON_NAMES = Object.keys(ICONS);
  export default Icon;
