"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  approveAllTemplates,
  approveAndPublish,
  cycleTemplate as cycleTemplateAction,
  markHandled as markHandledAction,
  regenerateDraft,
  saveDraftEdit,
  setActiveLocation,
  setBrandVoiceDetails,
  setTone as setToneAction,
  syncNow as syncNowAction,
  type ActionResult,
} from "./actions";
import type {
  DeskData,
  InboxFilter,
  LogFilter,
  Review,
  ToneName,
} from "./types";

/**
 * The desk session.
 *
 * The server owns the data: every screen under (desk) is rendered from a fresh
 * read, and every mutation is a server action followed by a refresh. What lives
 * here is only what the server cannot hold — the row animating out of the
 * queue, the keystroke that has not been saved yet, the toast.
 *
 * Those transient bits are kept in an overlay keyed by review ID rather than in
 * a copy of the list, so a server refresh flows straight through instead of
 * being clobbered by stale client state.
 */

const LEAVE_MS = 220;
const TOAST_MS = 2600;
/** How long after the last keystroke the draft is persisted. */
const SAVE_DEBOUNCE_MS = 700;

type Transient = Partial<Pick<Review, "draftText" | "edited" | "leaving">>;

type DeskUiState = {
  filter: InboxFilter;
  cursor: number;
  logFilter: LogFilter;
  syncing: boolean;
  regeneratingId: string | null;
  toast: string | null;
};

type DeskApi = {
  data: DeskData;
  state: DeskUiState & {
    reviews: Review[];
    tone: ToneName;
    alwaysMention: string;
    contactEmail: string;
    locationId: string;
  };
  visibleReviews: Review[];
  counts: Record<InboxFilter, number>;
  needsCount: number;
  pendingTemplates: number;
  visibleLog: DeskData["log"];
  busy: boolean;

  reviewById: (id: string) => Review | undefined;
  neighbours: (id: string) => { prev?: Review; next?: Review; index: number };

  setFilter: (filter: InboxFilter) => void;
  setCursor: (updater: (cursor: number) => number) => void;
  setLogFilter: (filter: LogFilter) => void;
  setTone: (tone: ToneName) => void;
  saveVoiceDetails: (alwaysMention: string, contactEmail: string) => void;
  setLocationId: (id: string) => void;

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

export function DeskProvider({
  data,
  children,
}: {
  data: DeskData;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [ui, setUi] = useState<DeskUiState>({
    filter: "Needs review",
    cursor: 0,
    logFilter: "All",
    syncing: false,
    regeneratingId: null,
    toast: null,
  });

  const [transient, setTransient] = useState<Record<string, Transient>>({});

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    const timers = saveTimers.current;
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      timers.forEach(clearTimeout);
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setUi((s) => ({ ...s, toast: message }));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(
      () => setUi((s) => ({ ...s, toast: null })),
      TOAST_MS,
    );
  }, []);

  /** Server actions all answer the same shape, so reporting them is one path. */
  const report = useCallback(
    (result: ActionResult) => {
      if (result.ok) {
        if (result.message) showToast(result.message);
      } else {
        showToast(result.error);
      }
    },
    [showToast],
  );

  const patch = useCallback((id: string, fields: Transient) => {
    setTransient((t) => ({ ...t, [id]: { ...t[id], ...fields } }));
  }, []);

  const clearTransient = useCallback((ids: string[]) => {
    setTransient((t) => {
      const next = { ...t };
      for (const id of ids) delete next[id];
      return next;
    });
  }, []);

  const reviews = useMemo(
    () =>
      data.reviews.map((review) =>
        transient[review.id] ? { ...review, ...transient[review.id] } : review,
      ),
    [data.reviews, transient],
  );

  // --- Mutations -----------------------------------------------------------

  const approve = useCallback(
    (id: string) => {
      const review = reviews.find((r) => r.id === id);
      if (!review || review.status !== "needs") return;

      patch(id, { leaving: true });

      startTransition(async () => {
        const result = await approveAndPublish(id);
        report(result);

        const settle = () => {
          clearTransient([id]);
          router.refresh();
        };
        if (prefersReducedMotion() || !result.ok) settle();
        else setTimeout(settle, LEAVE_MS);
      });
    },
    [clearTransient, patch, report, reviews, router],
  );

  const approveTemplates = useCallback(() => {
    const ids = reviews
      .filter((r) => r.lane === "template" && r.status === "needs")
      .map((r) => r.id);
    if (!ids.length) return;

    for (const id of ids) patch(id, { leaving: true });

    startTransition(async () => {
      report(await approveAllTemplates());
      const settle = () => {
        clearTransient(ids);
        router.refresh();
      };
      if (prefersReducedMotion()) settle();
      else setTimeout(settle, LEAVE_MS);
    });
  }, [clearTransient, patch, report, reviews, router]);

  const markHandled = useCallback(
    (id: string) => {
      startTransition(async () => {
        report(await markHandledAction(id));
        clearTransient([id]);
        router.refresh();
      });
    },
    [clearTransient, report, router],
  );

  /**
   * Typing is local and immediate; persistence is debounced. The operator
   * should never wait on a round trip to see their own keystroke.
   */
  const editDraft = useCallback(
    (id: string, text: string) => {
      patch(id, { draftText: text, edited: true });

      const existing = saveTimers.current.get(id);
      if (existing) clearTimeout(existing);

      saveTimers.current.set(
        id,
        setTimeout(() => {
          saveTimers.current.delete(id);
          void saveDraftEdit(id, text);
        }, SAVE_DEBOUNCE_MS),
      );
    },
    [patch],
  );

  const regenerate = useCallback(
    (id: string, choice: string) => {
      setUi((s) => ({ ...s, regeneratingId: id }));

      startTransition(async () => {
        const tone = choice === "Same tone" ? data.tone : choice;
        const result = await regenerateDraft(id, tone);
        report(result);
        // The regenerated text comes from the server, so drop the local edit.
        clearTransient([id]);
        setUi((s) => ({ ...s, regeneratingId: null }));
        router.refresh();
      });
    },
    [clearTransient, data.tone, report, router],
  );

  const cycleTemplate = useCallback(
    (id: string) => {
      startTransition(async () => {
        report(await cycleTemplateAction(id));
        clearTransient([id]);
        router.refresh();
      });
    },
    [clearTransient, report, router],
  );

  const syncNow = useCallback(() => {
    if (ui.syncing) return;
    setUi((s) => ({ ...s, syncing: true }));

    startTransition(async () => {
      report(await syncNowAction());
      setUi((s) => ({ ...s, syncing: false }));
      router.refresh();
    });
  }, [report, router, ui.syncing]);

  const setTone = useCallback(
    (tone: ToneName) => {
      startTransition(async () => {
        report(await setToneAction(tone));
        router.refresh();
      });
    },
    [report, router],
  );

  const saveVoiceDetails = useCallback(
    (alwaysMention: string, contactEmail: string) => {
      startTransition(async () => {
        report(await setBrandVoiceDetails(alwaysMention, contactEmail));
        router.refresh();
      });
    },
    [report, router],
  );

  const setLocationId = useCallback(
    (id: string) => {
      startTransition(async () => {
        report(await setActiveLocation(id));
        setTransient({});
        router.refresh();
      });
    },
    [report, router],
  );

  // --- Derived -------------------------------------------------------------

  const visibleReviews = useMemo(() => {
    const { filter } = ui;
    return reviews.filter((r) => {
      if (filter === "All") return true;
      if (filter === "Escalated") return r.lane === "escalated";
      if (filter === "Needs review") return r.status === "needs";
      if (filter === "Approved")
        return r.status === "approved" || r.status === "handled";
      if (filter === "Published") return r.status === "published";
      return true;
    });
  }, [reviews, ui]);

  const counts = useMemo<Record<InboxFilter, number>>(
    () => ({
      "Needs review": reviews.filter((r) => r.status === "needs").length,
      Escalated: reviews.filter((r) => r.lane === "escalated").length,
      Approved: reviews.filter(
        (r) => r.status === "approved" || r.status === "handled",
      ).length,
      Published: reviews.filter((r) => r.status === "published").length,
      All: reviews.length,
    }),
    [reviews],
  );

  const visibleLog = useMemo(
    () =>
      data.log.filter((e) => ui.logFilter === "All" || e.type === ui.logFilter),
    [data.log, ui.logFilter],
  );

  const api = useMemo<DeskApi>(
    () => ({
      data,
      state: {
        ...ui,
        reviews,
        tone: data.tone,
        alwaysMention: data.alwaysMention,
        contactEmail: data.contactEmail,
        locationId: data.activeLocationId,
      },
      visibleReviews,
      counts,
      needsCount: counts["Needs review"],
      pendingTemplates: reviews.filter(
        (r) => r.lane === "template" && r.status === "needs" && !r.leaving,
      ).length,
      visibleLog,
      busy: pending,

      reviewById: (id) => reviews.find((r) => r.id === id),

      // Stepping through the queue follows the list on screen, not the whole
      // table, so Next never jumps to a review the active filter hides.
      neighbours: (id) => {
        const index = visibleReviews.findIndex((r) => r.id === id);
        if (index === -1) {
          const fallback = reviews.findIndex((r) => r.id === id);
          return { index: fallback };
        }
        return {
          index,
          prev: index > 0 ? visibleReviews[index - 1] : undefined,
          next:
            index < visibleReviews.length - 1
              ? visibleReviews[index + 1]
              : undefined,
        };
      },

      setFilter: (filter) => setUi((s) => ({ ...s, filter, cursor: 0 })),
      setCursor: (updater) =>
        setUi((s) => ({ ...s, cursor: updater(s.cursor) })),
      setLogFilter: (logFilter) => setUi((s) => ({ ...s, logFilter })),
      setTone,
      saveVoiceDetails,
      setLocationId,

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
      data,
      editDraft,
      markHandled,
      pending,
      regenerate,
      reviews,
      saveVoiceDetails,
      setLocationId,
      setTone,
      showToast,
      syncNow,
      ui,
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
