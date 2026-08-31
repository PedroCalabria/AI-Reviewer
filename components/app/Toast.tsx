"use client";

import { useDesk } from "@/lib/store";

export function Toast() {
  const { state } = useDesk();
  if (!state.toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "var(--space-8)",
        transform: "translateX(-50%)",
        zIndex: "var(--z-overlay)",
        background: "var(--surface-inverse)",
        color: "var(--text-on-dark)",
        borderRadius: "var(--radius-control)",
        padding: "12px 22px",
        font: "var(--type-label)",
        animation: "toastIn var(--dur-base) var(--ease-out)",
        boxShadow: "var(--shadow-pill)",
      }}
    >
      {state.toast}
    </div>
  );
}
