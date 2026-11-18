import type { Metadata } from "next";
import "./globals.css";
import { DbProvider } from "@/components/providers/DbProvider";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "ArtLedger",
  description:
    "Lightweight tax and bookkeeping for freelance digital artists in the Philippines",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <DbProvider>
          <AppShell>{children}</AppShell>
        </DbProvider>
      </body>
    </html>
  );
}
