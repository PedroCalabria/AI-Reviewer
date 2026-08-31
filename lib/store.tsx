"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BASE_LOG, BASE_REVIEWS, TEMPLATES, TONES } from "./data";
import { REGENERATE_MS, regenerateDraft } from "./draft";
import type {
  InboxFilter,
  LogEntry,
  LogFilter,
  LogType,
  Review,
  ToneName,
} from "./types";

const LEAVE_MS = 220;
const TOAST_MS = 2600;
const SYNC_MS = 900;

function seedReviews(): Review[] {
  return BASE_REVIEWS.map((r) => ({
    ...r,
    status: "needs" as const,
    edited: false,
    variant: 0,
    draftText: r.lane === "template" ? TEMPLATES[0] : (r.draft ?? ""),
    leaving: false,
  }));
}

/**
 * The desk is a single in-memory session: the seed reviews come from the last
 * sync and the operator's decisions live here until they are published. A
 * reload starts the queue over, which is what the design shows.
 */
type DeskState = {
  reviews: Review[];
  log: LogEntry[];
  tone: ToneName;
  alwaysMention: string;
  contactEmail: string;
  autoApprove: boolean;
  locationId: number;
  filter: InboxFilter;
  cursor: number;
  logFilter: LogFilter;
  syncing: boolean;
  regeneratingId: string | null;
  toast: string | null;
};

function initialState(): DeskState {
  return {
    reviews: seedReviews(),
    log: BASE_LOG.slice(),
    tone: "Warm",
    alwaysMention: "",
    contactEmail: "",
    autoApprove: false,
    locationId: 1,
    filter: "Needs review",
    cursor: 0,
    logFilter: "All",
    syncing: false,
    regeneratingId: null,
    toast: null,
  };
}

function stamp(): string {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "short" });
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${month} ${now.getDate()} · ${time}`;
}

type DeskApi = {
  state: DeskState;
  visibleReviews: Review[];
  counts: Record<InboxFilter, number>;
  needsCount: number;
  pendingTemplates: number;
  visibleLog: LogEntry[];
  reviewById: (id: string) => Review | undefined;
  neighbours: (id: string) => { prev?: Review; next?: Review; index: number };
  setFilter: (filter: InboxFilter) => void;
  setCursor: (updater: (cursor: number) => number) => void;
  setLogFilter: (filter: LogFilter) => void;
  setTone: (tone: ToneName) => void;
  setAlwaysMention: (value: string) => void;
  setContactEmail: (value: string) => void;
  setAutoApprove: (value: boolean) => void;
  setLocationId: (id: number) => void;
  approve: (id: string) => void;
  approveTemplates: () => void;
  markHandled: (id: string) => void;
  editDraft: (id: string, text: string) => void;
  regenerate: (id: string, choice: string) => void;
  cycleTemplate: (id: string) => void;
  syncNow: () => void;
  showToast: (message: string) => void;
};

const DeskContext = createContext<DeskApi | null>(null);

/** Rows animate out of the queue unless the operator has asked them not to. */
function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function DeskProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DeskState>(initialState);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = useCallback((message: string) => {
    setState((s) => ({ ...s, toast: message }));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(
      () => setState((s) => ({ ...s, toast: null })),
      TOAST_MS,
    );
  }, []);

  const addLog = useCallback((actor: string, type: LogType, text: string) => {
    setState((s) => ({
      ...s,
      log: [{ time: stamp(), actor, type, text }, ...s.log],
    }));
  }, []);

  const patch = useCallback((id: string, fields: Partial<Review>) => {
    setState((s) => ({
      ...s,
      reviews: s.reviews.map((r) => (r.id === id ? { ...r, ...fields } : r)),
    }));
  }, []);

  const approve = useCallback(
    (id: string) => {
      const review = state.reviews.find((r) => r.id === id);
      if (!review || review.status !== "needs") return;

      patch(id, { leaving: true });
      const finish = () => {
        setState((s) => ({
          ...s,
          reviews: s.reviews.map((r) =>
            r.id === id ? { ...r, leaving: false, status: "published" } : r,
          ),
        }));
        addLog("Sarah", "You", `Approved and published reply to ${review.name}`);
      };
      if (prefersReducedMotion()) finish();
      else setTimeout(finish, LEAVE_MS);
      showToast(`Published reply to ${review.name}`);
    },
    [addLog, patch, showToast, state.reviews],
  );

  const approveTemplates = useCallback(() => {
    const ids = state.reviews
      .filter((r) => r.lane === "template" && r.status === "needs")
      .map((r) => r.id);
    if (!ids.length) return;

    setState((s) => ({
      ...s,
      reviews: s.reviews.map((r) =>
        ids.includes(r.id) ? { ...r, leaving: true } : r,
      ),
    }));
    const finish = () =>
      setState((s) => ({
        ...s,
        reviews: s.reviews.map((r) =>
          ids.includes(r.id)
            ? { ...r, leaving: false, status: "published" }
            : r,
        ),
      }));
    if (prefersReducedMotion()) finish();
    else setTimeout(finish, LEAVE_MS);

    const plural = ids.length === 1 ? "reply" : "replies";
    addLog("Sarah", "You", `Approved ${ids.length} template ${plural}`);
    showToast(`${ids.length} template ${plural} published`);
  }, [addLog, showToast, state.reviews]);

  const markHandled = useCallback(
    (id: string) => {
      const review = state.reviews.find((r) => r.id === id);
      if (!review) return;
      patch(id, { status: "approved", draftText: "Handled outside the tool." });
      addLog(
        "Sarah",
        "You",
        `Marked escalated review from ${review.name} as handled`,
      );
      showToast("Marked as handled — no reply published");
    },
    [addLog, patch, showToast, state.reviews],
  );

  const editDraft = useCallback(
    (id: string, text: string) => patch(id, { draftText: text, edited: true }),
    [patch],
  );

  const regenerate = useCallback(
    (id: string, choice: string) => {
      const review = state.reviews.find((r) => r.id === id);
      if (!review) return;
      const tone = (
        choice === "Same tone" ? state.tone : choice
      ) as ToneName;

      setState((s) => ({ ...s, regeneratingId: id }));
      const finish = () => {
        setState((s) => ({
          ...s,
          regeneratingId: null,
          reviews: s.reviews.map((r) =>
            r.id === id
              ? { ...r, draftText: regenerateDraft(r, tone), edited: false }
              : r,
          ),
        }));
        addLog(
          "AI",
          "AI",
          `Regenerated reply for ${review.name} (${tone.toLowerCase()})`,
        );
      };
      if (prefersReducedMotion()) finish();
      else setTimeout(finish, REGENERATE_MS);
    },
    [addLog, state.reviews, state.tone],
  );

  const cycleTemplate = useCallback(
    (id: string) => {
      const review = state.reviews.find((r) => r.id === id);
      if (!review) return;
      const next = (review.variant + 1) % TEMPLATES.length;
      patch(id, { variant: next, draftText: TEMPLATES[next], edited: false });
    },
    [patch, state.reviews],
  );

  const syncNow = useCallback(() => {
    if (state.syncing) return;
    setState((s) => ({ ...s, syncing: true }));
    // Where the Business Profile pull belongs: fetch new reviews for the
    // selected location, run the triage + draft pass, then merge them in.
    setTimeout(() => {
      setState((s) => ({ ...s, syncing: false }));
      showToast("No new reviews since 09:02");
    }, SYNC_MS);
  }, [showToast, state.syncing]);

  const visibleReviews = useMemo(() => {
    const { filter, reviews } = state;
    return reviews.filter((r) => {
      if (filter === "All") return true;
      if (filter === "Escalated") return r.lane === "escalated";
      if (filter === "Needs review") return r.status === "needs";
      if (filter === "Approved") return r.status === "approved";
      if (filter === "Published") return r.status === "published";
      return true;
    });
  }, [state]);

  const counts = useMemo<Record<InboxFilter, number>>(() => {
    const r = state.reviews;
    return {
      "Needs review": r.filter((x) => x.status === "needs").length,
      Escalated: r.filter((x) => x.lane === "escalated").length,
      Approved: r.filter((x) => x.status === "approved").length,
      Published: r.filter((x) => x.status === "published").length,
      All: r.length,
    };
  }, [state.reviews]);

  const visibleLog = useMemo(
    () =>
      state.log.filter(
        (e) => state.logFilter === "All" || e.type === state.logFilter,
      ),
    [state.log, state.logFilter],
  );

  const api = useMemo<DeskApi>(
    () => ({
      state,
      visibleReviews,
      counts,
      needsCount: counts["Needs review"],
      pendingTemplates: state.reviews.filter(
        (r) => r.lane === "template" && r.status === "needs" && !r.leaving,
      ).length,
      visibleLog,
      reviewById: (id) => state.reviews.find((r) => r.id === id),
      neighbours: (id) => {
        const index = state.reviews.findIndex((r) => r.id === id);
        return {
          index,
          prev: index > 0 ? state.reviews[index - 1] : undefined,
          next:
            index >= 0 && index < state.reviews.length - 1
              ? state.reviews[index + 1]
              : undefined,
        };
      },
      setFilter: (filter) => setState((s) => ({ ...s, filter, cursor: 0 })),
      setCursor: (updater) =>
        setState((s) => ({ ...s, cursor: updater(s.cursor) })),
      setLogFilter: (logFilter) => setState((s) => ({ ...s, logFilter })),
      setTone: (tone) => setState((s) => ({ ...s, tone })),
      setAlwaysMention: (alwaysMention) =>
        setState((s) => ({ ...s, alwaysMention })),
      setContactEmail: (contactEmail) =>
        setState((s) => ({ ...s, contactEmail })),
      setAutoApprove: (autoApprove) => setState((s) => ({ ...s, autoApprove })),
      setLocationId: (locationId) => setState((s) => ({ ...s, locationId })),
      approve,
      approveTemplates,
      markHandled,
      editDraft,
      regenerate,
      cycleTemplate,
      syncNow,
      showToast,
    }),
    [
      approve,
      approveTemplates,
      counts,
      cycleTemplate,
      editDraft,
      markHandled,
      regenerate,
      showToast,
      state,
      syncNow,
      visibleLog,
      visibleReviews,
    ],
  );

  return <DeskContext.Provider value={api}>{children}</DeskContext.Provider>;
}

export function useDesk(): DeskApi {
  const ctx = useContext(DeskContext);
  if (!ctx) throw new Error("useDesk must be used inside <DeskProvider>");
  return ctx;
}

export function toneFor(name: ToneName) {
  return TONES.find((t) => t.name === name) ?? TONES[0];
}
