import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock Pulse — Event-Driven Stock Alerts",
  description:
    "Never miss earnings, FOMC, CPI, or insider trades that affect your portfolio.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
