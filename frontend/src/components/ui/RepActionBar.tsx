"use client";

import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { 
  MessageSquare, 
  Phone, 
  Mail, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  MoreHorizontal,
  Bot,
  User,
  FileText
} from "lucide-react";
import { forwardRef } from "react";

interface ActionItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: "default" | "primary" | "secondary" | "outline" | "destructive" | "ghost" | "link";
  badge?: string;
  badgeVariant?: "secondary" | "outline" | "destructive";
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  onClick?: () => void;
}

interface RepActionBarProps {
  ticketId?: string;
  priority?: "low" | "normal" | "high";
  status?: "open" | "in_progress" | "escalated" | "resolved" | "closed";
  assignedTo?: string;
  lastUpdated?: Date;
  primaryActions?: ActionItem[];
  secondaryActions?: ActionItem[];
  quickActions?: QuickAction[];
  suggestions?: string[];
  className?: string;
  compact?: boolean;
}

const RepActionBar = forwardRef<HTMLDivElement, RepActionBarProps>(
  ({
    ticketId,
    priority = "normal",
    status = "open",
    assignedTo,
    lastUpdated,
    primaryActions = [],
    secondaryActions = [],
    quickActions = [],
    suggestions = [],
    className,
    compact = false,
    ...props
  }, ref) => {
    const priorityConfig: Record<string, { color: string; bg: string; label: string }> = {
      low: { color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20", label: "Low" },
      normal: { color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20", label: "Normal" },
      high: { color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/20", label: "High" },
      medium: { color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20", label: "Medium" },
      urgent: { color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20", label: "Urgent" },
      critical: { color: "text-red-700", bg: "bg-red-100 dark:bg-red-950/30", label: "Critical" },
    };

    const statusConfig = {
      open: { color: "text-blue-600", icon: AlertTriangle, label: "Open" },
      in_progress: { color: "text-purple-600", icon: ArrowRight, label: "In Progress" },
      escalated: { color: "text-red-600", icon: AlertTriangle, label: "Escalated" },
      resolved: { color: "text-green-600", icon: CheckCircle, label: "Resolved" },
      closed: { color: "text-gray-600", icon: CheckCircle, label: "Closed" }
    };

    const defaultQuickActions: QuickAction[] = [
      {
        id: "respond",
        label: "Respond",
        description: "Send message to customer",
        icon: MessageSquare,
        color: "text-blue-500"
      },
      {
        id: "call",
        label: "Call",
        description: "Start phone call",
        icon: Phone,
        color: "text-green-500"
      },
      {
        id: "email",
        label: "Email",
        description: "Send email update",
        icon: Mail,
        color: "text-purple-500"
      },
      {
        id: "ai-assist",
        label: "AI Assist",
        description: "Get AI suggestions",
        icon: Bot,
        color: "text-primary"
      }
    ];

    const allQuickActions = quickActions.length > 0 ? quickActions : defaultQuickActions;
    const currentStatusConfig = statusConfig[status] ?? statusConfig.open;
    const currentPriorityConfig = priorityConfig[String(priority).toLowerCase()] ?? priorityConfig.normal;
    const StatusIcon = currentStatusConfig.icon;

    return (
      <div
        ref={ref}
        className={cn(
          "sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
          "transition-all duration-200",
          className
        )}
        {...props}
      >
        {/* Main Action Bar */}
        <div className={cn("px-6 py-4", compact && "px-4 py-3")}>
          <div className="flex items-center justify-between gap-4">
            {/* Left Side - Ticket Info */}
            <div className="flex items-center gap-4">
              {ticketId && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-sm font-medium">#{ticketId}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <StatusIcon className={cn("h-4 w-4", currentStatusConfig.color)} />
                <Badge variant="outline" className="text-xs">
                  {currentStatusConfig.label}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn("text-xs", currentPriorityConfig.color, currentPriorityConfig.bg)}
                >
                  {currentPriorityConfig.label} Priority
                </Badge>
              </div>

              {assignedTo && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>{assignedTo}</span>
                </div>
              )}
            </div>

            {/* Right Side - Primary Actions */}
            <div className="flex items-center gap-2">
              {primaryActions.map((action) => {
                const IconComponent = action.icon;
                return (
                  <Button
                    key={action.id}
                    variant={action.variant || "primary"}
                    size={compact ? "sm" : "default"}
                    onClick={action.onClick}
                    disabled={action.disabled || action.loading}
                    className="relative"
                  >
                    {IconComponent && <IconComponent className="h-4 w-4 mr-2" />}
                    {action.label}
                    {action.badge && (
                      <Badge 
                        variant={action.badgeVariant || "secondary"} 
                        className="ml-2 h-5 px-1.5 text-xs"
                      >
                        {action.badge}
                      </Badge>
                    )}
                  </Button>
                );
              })}

              {secondaryActions.length > 0 && (
                <Button variant="ghost" size={compact ? "sm" : "default"}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Last Updated */}
          {lastUpdated && !compact && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Last updated {lastUpdated.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Quick Actions Section */}
        {!compact && allQuickActions.length > 0 && (
          <>
            <Separator />
            <div className="px-6 py-3">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-foreground">Quick Actions</h4>
                {suggestions.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {suggestions.length} AI suggestions
                  </Badge>
                )}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {allQuickActions.map((action) => {
                  const IconComponent = action.icon;
                  return (
                    <Button
                      key={action.id}
                      variant="ghost"
                      className="h-auto p-3 flex flex-col items-center gap-2 hover:bg-muted/50"
                      onClick={action.onClick}
                    >
                      <IconComponent className={cn("h-5 w-5", action.color)} />
                      <div className="text-center">
                        <div className="text-xs font-medium">{action.label}</div>
                        <div className="text-xs text-muted-foreground">{action.description}</div>
                      </div>
                    </Button>
                  );
                })}
              </div>

              {/* AI Suggestions */}
              {suggestions.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Bot className="h-3 w-3" />
                    AI Suggestions
                  </div>
                  <div className="space-y-1">
                    {suggestions.slice(0, 3).map((suggestion, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                        <span className="text-xs text-foreground">{suggestion}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }
);
RepActionBar.displayName = "RepActionBar";

export { RepActionBar, type ActionItem, type QuickAction };