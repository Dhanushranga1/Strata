import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Home, 
  Ticket, 
  Users, 
  MessageSquare, 
  Settings, 
  BookOpen,
  UserCheck,
  LogOut,
  Menu,
  X,
  Shield,
  BarChart3
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
  { name: "User Roles", href: "/admin/roles", icon: Users, adminOnly: true },
  { name: "Analytics", href: "/admin/analytics", icon: BarChart3, adminOnly: true },
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

  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly && userRole !== 'admin') return false;
    if (item.repOnly && !['admin', 'rep'].includes(userRole || '')) return false;
    return true;
  });

  const handleLogout = async () => {
    console.log('🚪 Sidebar: Logging out...');
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className={cn(
      "flex flex-col h-screen bg-card border-r border-border transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Ticket className="w-4 h-4 text-primary-foreground" />
              </div>
              <h1 className="font-bold text-lg">TicketPilot</h1>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 h-8 w-8"
          >
            {isCollapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* User Info */}
      {!isCollapsed && (
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-sm font-semibold text-primary">
                {userName?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userName || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              <span className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1",
                userRole === 'admin' ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" :
                userRole === 'rep' ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" :
                "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              )}>
                {userRole || 'user'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {filteredNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                isCollapsed && "justify-center"
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className={cn(
            "w-full justify-start gap-3 text-muted-foreground hover:text-foreground",
            isCollapsed && "justify-center"
          )}
          title={isCollapsed ? "Logout" : undefined}
        >
          <LogOut className="w-4 h-4" />
          {!isCollapsed && <span>Logout</span>}
        </Button>
      </div>
    </div>
  );
}