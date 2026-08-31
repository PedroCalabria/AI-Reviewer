import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Review Desk",
  description:
    "Drafted replies to your Google Business Profile reviews, waiting for your approval. Nothing publishes on its own.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            color: "var(--text-primary)",
            background: "var(--surface-page)",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {children}
        </div>
      </body>
    </html>
  );
}
