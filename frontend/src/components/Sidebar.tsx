"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  { name: "Knowledge Base", href: "/kb", icon: BookOpen },
  { name: "Rep Console", href: "/rep", icon: UserCheck, repOnly: true },
  { name: "Admin Panel", href: "/admin", icon: Shield, adminOnly: true },
  { name: "Team Members", href: "/admin/users", icon: Users, adminOnly: true },
  { name: "Account", href: "/account", icon: Settings },
];

interface SidebarProps {
  userRole?: string;
  userName?: string;
  userEmail?: string;
}

export function Sidebar({ userRole, userName, userEmail }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const filteredNavItems = navItems.filter((item) => {
    if (item.adminOnly && userRole !== "admin") return false;
    if (item.repOnly && !["admin", "rep"].includes(userRole || "")) return false;
    return true;
  });

  const isItemActive = (item: NavItem) => {
    if (item.href === "/admin") {
      // Only highlight Admin Panel when on /admin exactly, not sub-pages
      return pathname === "/admin";
    }
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const roleBadgeClass =
    userRole === "admin"
      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      : userRole === "rep"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
      : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";

  return (
    <div
      className={cn(
        "relative flex flex-col h-screen bg-card border-r border-border transition-all duration-300 ease-in-out shrink-0",
        isCollapsed ? "w-[60px]" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-border min-h-[60px]">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center shrink-0">
              <Ticket className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-base tracking-tight">TicketPilot</span>
          </div>
        )}
        {isCollapsed && (
          <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center mx-auto">
            <Ticket className="w-4 h-4 text-primary-foreground" />
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
            isCollapsed && "absolute -right-3 top-4 bg-card border border-border shadow-sm z-10 rounded-full p-0.5"
          )}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
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
                <p className="text-xs text-muted-foreground truncate leading-tight">{userEmail}</p>
              )}
              <span className={cn("inline-block px-1.5 py-px rounded text-[10px] font-semibold mt-0.5", roleBadgeClass)}>
                {userRole || "customer"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed: just avatar */}
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
              title={isCollapsed ? item.name : undefined}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
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
  );
}
