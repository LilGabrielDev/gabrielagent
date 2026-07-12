"use client";

import { useRouter } from "next/navigation";
import { Bell, Search, Sun, Moon, LogOut, User } from "lucide-react";
import { useState, useRef, useEffect, FormEvent } from "react";
import { useTheme } from "@/lib/hooks/use-theme";
import { RealtimeStatusIndicator } from "@/components/layout/realtime-status";

interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearchOpen(false);
    router.push(`/conversations?q=${encodeURIComponent(q)}`);
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.push("/login");
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-gabriel-surface border-b border-gabriel-border transition-theme">
      <div className="animate-fade-in">
        <h2 className="text-xl font-semibold text-gabriel-text">{title}</h2>
        {description && (
          <p className="text-sm text-gabriel-text-light mt-0.5">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {searchOpen && (
          <form onSubmit={handleSearch} className="animate-slide-in-down">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gabriel-border rounded-lg bg-gabriel-surface text-gabriel-text focus:outline-none focus:ring-2 focus:ring-gabriel-primary/30 focus:border-gabriel-primary w-64 transition-theme"
              autoFocus
            />
          </form>
        )}
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="p-2 text-gabriel-text-light hover:text-gabriel-text hover:bg-gabriel-primary-50 rounded-lg transition-colors"
          title="Search"
        >
          <Search className="h-5 w-5" />
        </button>

        <RealtimeStatusIndicator />

        <button
          onClick={toggleTheme}
          className="p-2 text-gabriel-text-light hover:text-gabriel-text hover:bg-gabriel-primary-50 rounded-lg transition-colors"
          title={theme === "light" ? "Dark mode" : "Light mode"}
        >
          {theme === "light" ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
        </button>

        <button className="relative p-2 text-gabriel-text-light hover:text-gabriel-text hover:bg-gabriel-primary-50 rounded-lg transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gabriel-danger rounded-full" />
        </button>

        {actions}

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gabriel-primary text-white text-sm font-medium hover:bg-gabriel-primary-dark transition-colors"
          >
            A
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-gabriel-surface border border-gabriel-border rounded-lg shadow-lg py-1 z-50 animate-scale-in transition-theme">
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  router.push("/settings");
                }}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gabriel-text hover:bg-gabriel-primary-50 transition-colors"
              >
                <User className="h-4 w-4" />
                Profile & Settings
              </button>
              <div className="border-t border-gabriel-border my-1" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gabriel-danger hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
