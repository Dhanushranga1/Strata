"use client";

import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Badge } from "./badge";
import { Label } from "./label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { 
  Shield, 
  User, 
  Crown, 
  Settings, 
  Eye,
  AlertTriangle,
  CheckCircle,
  Info
} from "lucide-react";
import { forwardRef, useState } from "react";

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  level: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  canAssign?: boolean;
  restricted?: boolean;
}

interface RoleSelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  currentUserRole?: string;
  targetUserEmail?: string;
  availableRoles?: Role[];
  disabled?: boolean;
  showPermissions?: boolean;
  showDescription?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  variant?: "default" | "compact" | "detailed";
}

const defaultRoles: Role[] = [
  {
    id: "admin",
    name: "Administrator",
    description: "Full system access with user management privileges",
    permissions: ["user.manage", "role.manage", "system.configure", "data.access", "ticket.manage"],
    level: 100,
    icon: Crown,
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950/20",
    restricted: true
  },
  {
    id: "manager",
    name: "Manager",
    description: "Team management and advanced ticket handling",
    permissions: ["team.manage", "ticket.assign", "report.view", "data.access"],
    level: 75,
    icon: Shield,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/20"
  },
  {
    id: "rep",
    name: "Representative",
    description: "Handle tickets and customer interactions",
    permissions: ["ticket.handle", "customer.contact", "kb.access"],
    level: 50,
    icon: User,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/20"
  },
  {
    id: "viewer",
    name: "Viewer",
    description: "Read-only access to tickets and reports",
    permissions: ["ticket.view", "report.view"],
    level: 25,
    icon: Eye,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/20"
  }
];

const RoleSelect = forwardRef<HTMLDivElement, RoleSelectProps>(
  ({
    value,
    onValueChange,
    currentUserRole = "rep",
    targetUserEmail,
    availableRoles = defaultRoles,
    disabled = false,
    showPermissions = true,
    showDescription = true,
    label = "Role",
    placeholder = "Select a role...",
    required = false,
    className,
    variant = "default",
    ...props
  }, ref) => {
    const [selectedRole, setSelectedRole] = useState<Role | undefined>(
      value ? availableRoles.find(r => r.id === value) : undefined
    );

    const currentRole = availableRoles.find(r => r.id === currentUserRole);
    const currentUserLevel = currentRole?.level || 0;

    // Filter roles based on current user's permissions
    const selectableRoles = availableRoles.filter(role => {
      // Admins can assign any role
      if (currentUserLevel >= 100) return true;
      
      // Users can only assign roles lower than their own
      if (role.level >= currentUserLevel) return false;
      
      // Check if role is restricted
      if (role.restricted && currentUserLevel < 100) return false;
      
      return role.canAssign !== false;
    });

    const handleValueChange = (newValue: string) => {
      const role = availableRoles.find(r => r.id === newValue);
      setSelectedRole(role);
      onValueChange?.(newValue);
    };

    const getStatusIcon = () => {
      if (!selectedRole) return null;
      
      if (selectedRole.restricted && currentUserLevel < 100) {
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      }
      
      if (selectedRole.level > currentUserLevel) {
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      }
      
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    };

    const getStatusMessage = () => {
      if (!selectedRole) return null;
      
      if (selectedRole.restricted && currentUserLevel < 100) {
        return "This role has restricted permissions that require admin approval";
      }
      
      if (selectedRole.level > currentUserLevel) {
        return "You cannot assign a role higher than your own";
      }
      
      return "Role assignment is valid";
    };

    if (variant === "compact") {
      return (
        <div ref={ref} className={cn("space-y-2", className)} {...props}>
          <Select value={value} onValueChange={handleValueChange} disabled={disabled}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {selectableRoles.map((role) => {
                const IconComponent = role.icon;
                return (
                  <SelectItem key={role.id} value={role.id}>
                    <div className="flex items-center gap-2">
                      <IconComponent className={cn("h-4 w-4", role.color)} />
                      <span>{role.name}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div ref={ref} className={cn("space-y-4", className)} {...props}>
        {/* Label and Status */}
        <div className="flex items-center justify-between">
          <Label htmlFor="role-select" className="text-sm font-medium">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {selectedRole && getStatusIcon() && (
            <div className="flex items-center gap-1">
              {getStatusIcon()}
              <span className="text-xs text-muted-foreground">
                {selectedRole.level > currentUserLevel ? "Cannot assign" : "Can assign"}
              </span>
            </div>
          )}
        </div>

        {/* Target User Info */}
        {targetUserEmail && (
          <div className="text-sm text-muted-foreground">
            Assigning role to: <span className="font-medium">{targetUserEmail}</span>
          </div>
        )}

        {/* Role Selection */}
        <Select value={value} onValueChange={handleValueChange} disabled={disabled}>
          <SelectTrigger id="role-select" className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {selectableRoles.map((role) => {
              const IconComponent = role.icon;
              const canAssign = role.level < currentUserLevel || currentUserLevel >= 100;
              
              return (
                <SelectItem 
                  key={role.id} 
                  value={role.id}
                  disabled={!canAssign}
                >
                  <div className="flex items-center gap-3 py-1">
                    <div className={cn("p-2 rounded-md", role.bgColor)}>
                      <IconComponent className={cn("h-4 w-4", role.color)} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{role.name}</span>
                        <Badge variant="outline" className="text-xs">
                          Level {role.level}
                        </Badge>
                        {role.restricted && (
                          <Badge variant="destructive" className="text-xs">
                            Restricted
                          </Badge>
                        )}
                      </div>
                      {showDescription && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {role.description}
                        </p>
                      )}
                    </div>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Selected Role Details */}
        {selectedRole && variant === "detailed" && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            {/* Role Header */}
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-md", selectedRole.bgColor)}>
                <selectedRole.icon className={cn("h-5 w-5", selectedRole.color)} />
              </div>
              <div>
                <h4 className="font-medium">{selectedRole.name}</h4>
                <p className="text-sm text-muted-foreground">{selectedRole.description}</p>
              </div>
            </div>

            {/* Permissions */}
            {showPermissions && selectedRole.permissions.length > 0 && (
              <div>
                <h5 className="text-sm font-medium mb-2">Permissions</h5>
                <div className="flex flex-wrap gap-1">
                  {selectedRole.permissions.map((permission) => (
                    <Badge key={permission} variant="outline" className="text-xs">
                      {permission}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Status Message */}
            {getStatusMessage() && (
              <div className="flex items-start gap-2 p-3 bg-background rounded-md">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  {getStatusMessage()}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);
RoleSelect.displayName = "RoleSelect";

export { RoleSelect, type Role };