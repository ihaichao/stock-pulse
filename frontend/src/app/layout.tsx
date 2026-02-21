import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "Stock Pulse — 事件驱动股票提醒",
  description:
    "不再错过影响你持仓的财报、FOMC、CPI 或内部人交易。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh" className="dark">
      <body className="antialiased">
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
