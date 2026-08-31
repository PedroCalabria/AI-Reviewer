import type { ReactNode } from "react";
import { Sidebar } from "@/components/app/Sidebar";
import { Toast } from "@/components/app/Toast";
import { DeskProvider } from "@/lib/store";
import { requireLocation } from "@/lib/tenancy";
import { loadDeskData } from "@/lib/view";

/**
 * The desk shell.
 *
 * This is where authorization actually happens — not in a proxy. Next's own
 * guidance is that proxy runs before the cache and is the wrong place for
 * session management; doing it here means the check runs in the same request
 * that reads the data, against the same session, with no gap between them.
 *
 * It is also the one read: every screen under (desk) renders from this single
 * server-side load, and every mutation refreshes it.
 */
export default async function DeskLayout({ children }: { children: ReactNode }) {
  const tenant = await requireLocation();
  const data = await loadDeskData(tenant);

  return (
    <DeskProvider data={data}>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "stretch",
          flexWrap: "wrap",
        }}
      >
        <Sidebar />
        <div
          style={{
            flex: "1 1 560px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {children}
        </div>
      </div>
      <Toast />
    </DeskProvider>
  );
}
