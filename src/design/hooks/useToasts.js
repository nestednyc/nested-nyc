/* ============================================================
   useToasts — the toast queue.

   Domain-hook pattern: state + handlers for one domain live in a
   hook; NestedApp is the composition root that injects cross-domain
   deps (none needed here) and wires the returns into the renders.
   `toast(text, icon)` queues a toast for 2.8s; `toasts` feeds the
   <Toasts items={…}/> render in every shell.
   ============================================================ */
import React from 'react'

const { useState } = React;

export function useToasts() {
  const [toasts, setToasts] = useState([]);

  function toast(text, icon) {
    const id = Math.random().toString(36).slice(2);
    setToasts((arr) => [...arr, { id, text, icon }]);
    setTimeout(() => setToasts((arr) => arr.filter((x) => x.id !== id)), 2800);
  }

  return { toasts, toast };
}
