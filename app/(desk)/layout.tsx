import type { ReactNode } from "react";
import { Sidebar } from "@/components/app/Sidebar";

export default function DeskLayout({ children }: { children: ReactNode }) {
  return (
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
  );
}
