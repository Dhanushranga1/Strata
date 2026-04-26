"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { OrganizationSelector } from "@/components/OrganizationSelector";
import {
  Home,
  Ticket,
  BookOpen,
  UserCheck,
  Settings,
  Shield,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
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
  { name: "Knowledge Base", href: "/kb", icon: BookOpen, repOnly: true },
  { name: "Rep Console", href: "/rep", icon: UserCheck, repOnly: true },
  { name: "Admin Panel", href: "/admin", icon: Shield, adminOnly: true },
  { name: "Team Members", href: "/admin/users", icon: Users, adminOnly: true },
  { name: "Account", href: "/account", icon: Settings },
];

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
          // Base layout
          "flex flex-col h-screen bg-card border-r border-border shrink-0",
          // Desktop: relative, always visible, collapsible
          "md:relative md:translate-x-0",
          // Mobile: fixed overlay that slides in/out
          "fixed inset-y-0 left-0 z-50 md:z-auto",
          "transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          // Width
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

          {/* Desktop collapse toggle */}
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

          {/* Mobile close button */}
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
                  {userRole || "customer"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Collapsed avatar */}
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
        <div className="px-2 py-3 border-t border-border">
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
