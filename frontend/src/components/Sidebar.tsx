"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { OrganizationSelector } from "@/components/OrganizationSelector";
import api from "@/lib/api-client";
import {
  Home,
  Ticket,
  BookOpen,
  UserCheck,
  Settings,
  Shield,
  Users,
  Inbox,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  Bell,
  Sun,
  Moon,
  Check,
  Trash2,
  ExternalLink,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  repOnly?: boolean;
}

const navItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Tickets", href: "/tickets", icon: Ticket },
  { name: "My Tickets", href: "/rep/my-tickets", icon: Inbox, repOnly: true },
  { name: "Knowledge Base", href: "/kb", icon: BookOpen, repOnly: true },
  { name: "Rep Console", href: "/rep", icon: UserCheck, repOnly: true },
  { name: "Admin Panel", href: "/admin", icon: Shield, adminOnly: true },
  { name: "Team Members", href: "/admin/users", icon: Users, adminOnly: true },
  { name: "Account", href: "/account", icon: Settings },
];

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  ref_type: string;
  ref_id: string;
  read_at: string | null;
  created_at: string;
}

function formatRelTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const NOTIF_ICONS: Record<string, string> = {
  ticket_assigned: "🎯",
  ticket_resolved: "✅",
  new_message: "💬",
  overdue: "⚠️",
  escalation: "🚨",
};

function NotificationBell({ isCollapsed }: { isCollapsed: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await api.get<{ unread: number; items: NotificationItem[] }>("/api/notifications");
      setUnread(data.unread ?? 0);
      setItems(data.items ?? []);
    } catch {
      // silent — notifications are non-critical
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, u - 1));
    await api.post(`/api/notifications/${id}/read`, {});
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnread(0);
    await api.post("/api/notifications/read-all", {});
  };

  const deleteNotif = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const wasUnread = items.find((n) => n.id === id)?.read_at === null;
    setItems((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnread((u) => Math.max(0, u - 1));
    await api.delete(`/api/notifications/${id}`);
  };

  const handleClick = async (notif: NotificationItem) => {
    if (!notif.read_at) await markRead(notif.id);
    if (notif.ref_type === "ticket" && notif.ref_id) {
      router.push(`/tickets/${notif.ref_id}`);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); if (!open) fetchNotifications(); }}
        title="Notifications"
        className={cn(
          "relative flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
          isCollapsed && "justify-center px-2"
        )}
      >
        <Bell className="w-4 h-4 shrink-0" />
        {!isCollapsed && <span>Notifications</span>}
        {unread > 0 && (
          <span className="absolute top-1.5 left-5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full top-0 ml-2 w-80 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-sm">Notifications</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
              <button type="button" title="Close notifications" onClick={() => setOpen(false)}>
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-muted-foreground gap-2">
                <Bell className="w-8 h-8 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              items.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors border-b border-border/40 last:border-0",
                    !notif.read_at && "bg-primary/5"
                  )}
                >
                  <span className="text-lg shrink-0 mt-0.5">
                    {NOTIF_ICONS[notif.type] ?? "🔔"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm leading-snug", !notif.read_at && "font-semibold")}>
                      {notif.title}
                    </p>
                    {notif.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notif.body}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatRelTime(notif.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {notif.ref_type === "ticket" && (
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    )}
                    {!notif.read_at && (
                      <button
                        type="button"
                        title="Mark read"
                        onClick={(e) => { e.stopPropagation(); markRead(notif.id); }}
                        className="p-1 rounded hover:bg-accent"
                      >
                        <Check className="w-3 h-3 text-primary" />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Delete"
                      onClick={(e) => deleteNotif(notif.id, e)}
                      className="p-1 rounded hover:bg-accent"
                    >
                      <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DarkModeToggle({ isCollapsed }: { isCollapsed: boolean }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored === "dark" || (!stored && prefersDark);
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
        isCollapsed && "justify-center px-2"
      )}
    >
      {dark ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
      {!isCollapsed && <span>{dark ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}

interface SidebarProps {
  userRole?: string;
  userName?: string;
  userEmail?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({
  userRole,
  userName,
  userEmail,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const filteredNavItems = navItems.filter((item) => {
    if (item.adminOnly && userRole !== "admin") return false;
    if (item.repOnly && !["admin", "rep"].includes(userRole || "")) return false;
    return true;
  });

  const isItemActive = (item: NavItem) => {
    if (item.href === "/admin") return pathname === "/admin";
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleNavClick = () => {
    onMobileClose?.();
  };

  const roleBadgeClass =
    userRole === "admin"
      ? "bg-red-900/40 text-red-300"
      : userRole === "rep"
      ? "bg-blue-900/40 text-blue-300"
      : "bg-green-900/40 text-green-300";

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <div
        className={cn(
          "flex flex-col h-screen bg-card border-r border-border shrink-0",
          "md:relative md:translate-x-0",
          "fixed inset-y-0 left-0 z-50 md:z-auto",
          "transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          isCollapsed ? "md:w-[60px] w-64" : "w-64"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-4 border-b border-border min-h-[60px]">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center shrink-0">
                <Ticket className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-base tracking-tight truncate">TicketPilot</span>
            </div>
          )}
          {isCollapsed && (
            <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center mx-auto">
              <Ticket className="w-4 h-4 text-white" />
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              "hidden md:flex p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0",
              isCollapsed &&
                "absolute -right-3 top-4 bg-card border border-border shadow-sm z-10 rounded-full p-0.5"
            )}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onMobileClose}
            className="md:hidden p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Info */}
        {!isCollapsed && (
          <div className="px-3 py-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary/15 rounded-full flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">
                  {(userName || userEmail || "U").charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate leading-tight">
                  {userName || userEmail || "User"}
                </p>
                {userName && userEmail && (
                  <p className="text-xs text-muted-foreground truncate leading-tight">
                    {userEmail}
                  </p>
                )}
                <span
                  className={cn(
                    "inline-block px-1.5 py-px rounded text-[10px] font-semibold mt-0.5",
                    roleBadgeClass
                  )}
                >
                  {userRole === "customer" ? "Client" : userRole || "Client"}
                </span>
              </div>
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="flex justify-center py-3 border-b border-border">
            <div
              className="w-8 h-8 bg-primary/15 rounded-full flex items-center justify-center"
              title={userName || userEmail || "User"}
            >
              <span className="text-xs font-bold text-primary">
                {(userName || userEmail || "U").charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {/* Organization Selector */}
        {!isCollapsed && (
          <div className="px-3 py-2.5 border-b border-border">
            <OrganizationSelector />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const active = isItemActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                title={isCollapsed ? item.name : undefined}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  isCollapsed && "justify-center px-2"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-border space-y-0.5">
          <NotificationBell isCollapsed={isCollapsed} />
          <DarkModeToggle isCollapsed={isCollapsed} />
          <button
            type="button"
            onClick={handleLogout}
            title={isCollapsed ? "Logout" : undefined}
            className={cn(
              "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
              isCollapsed && "justify-center px-2"
            )}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </div>
    </>
  );
}
