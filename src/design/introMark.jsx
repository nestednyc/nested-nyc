/* ============================================================
   NESTED NYC — the Nested AI mark on an intro bubble ("the flame")
   The three pixel sparks lifted straight off the nested social wordmark
   (nested-social-redrawn-solid.svg, first three subpaths, viewBox cropped to
   them) plus "AI" drawn on the same 1-unit pixel grid. Presentational; the
   strike → fade-to-grey loop is CSS (.flame in styles.css) and the three
   sparks carry their own classes so the stagger can address each one.
   ============================================================ */
import React from 'react'

// the sparks, in the wordmark's own coordinates
const SPARKS = [
  "M672 48L684 48L684 60L696 60L696 96L708 96L708 120L696 120L696 132L672 132L672 144L660 144L660 120L648 120L648 84L660 84L660 72L672 72Z",
  "M732 84L756 84L756 96L768 96L768 132L756 132L756 144L744 144L744 132L732 132L732 108L744 108L744 96L732 96Z",
  "M588 96L600 96L600 120L612 120L612 144L600 144L600 168L588 168L588 144L576 144L576 108L588 108Z"
];

// "AI" on a 9×7 pixel grid: [x, y] of every lit cell
const AI_CELLS = [[1, 0], [2, 0], [3, 0], [0, 1], [4, 1], [0, 2], [4, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [0, 4], [4, 4], [0, 5], [4, 5], [0, 6], [4, 6], [6, 0], [7, 0], [8, 0], [7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [6, 6], [7, 6], [8, 6]];

export function Flame() {
  return React.createElement("span", { className: "flame", title: "Written by Nested AI", "aria-label": "Written by Nested AI" },
    React.createElement("svg", { viewBox: "570 40 205 135", width: 24, height: 16, "aria-hidden": true },
      SPARKS.map((d, i) => React.createElement("path", { key: i, className: "sp sp" + (i + 1), d, fill: "currentColor", fillRule: "evenodd" }))),
    React.createElement("svg", { className: "ai", viewBox: "0 0 9 7", width: 15, height: 11.7, fill: "currentColor", shapeRendering: "crispEdges", "aria-hidden": true },
      AI_CELLS.map(([x, y], i) => React.createElement("rect", { key: i, x, y, width: 1, height: 1 })))
  );
}

export default Flame;
