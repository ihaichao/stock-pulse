"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Newspaper,
  Settings,
  LineChart,
  Search,
  Bell,
  User,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItem {
  title: string;
  href: string;
}

const navItems: NavItem[] = [
  { title: "仪表盘", href: "/" },
  { title: "今日事件", href: "/today" },
  { title: "宏观日历", href: "/macro" },
  { title: "持仓管理", href: "/settings" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ─── Top Navigation Bar ─── */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex h-14 items-center px-4 lg:px-8 w-full">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 mr-8 shrink-0">
            <div className="w-7 h-7 bg-primary rounded flex items-center justify-center">
              <LineChart className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-primary hidden sm:inline">
              STOCK PULSE
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {item.title}
              </Link>
            ))}
          </nav>

          {/* Right Side: Search + Icons */}
          <div className="ml-auto flex items-center gap-3">
            {/* Search Bar */}
            <div className="hidden sm:flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-sm text-muted-foreground w-48 lg:w-56">
              <Search className="h-4 w-4 shrink-0" />
              <span className="text-xs">搜索美股代码...</span>
            </div>

            {/* Bell */}
            <button className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors hidden sm:flex">
              <Bell className="h-4 w-4" />
            </button>

            {/* User Avatar */}
            <button className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors hidden sm:flex">
              <User className="h-4 w-4" />
            </button>

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-card px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {item.title}
              </Link>
            ))}
            {/* Mobile Search */}
            <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground mt-2">
              <Search className="h-4 w-4 shrink-0" />
              <span className="text-xs">搜索美股代码...</span>
            </div>
          </div>
        )}
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 px-4 py-4 lg:px-8 lg:py-6 w-full">
        {children}
      </main>
    </div>
  );
}
