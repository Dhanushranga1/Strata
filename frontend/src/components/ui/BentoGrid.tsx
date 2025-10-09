"use client";

import { cn } from "@/lib/utils";
import { Card } from "./card";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { forwardRef } from "react";

interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
}

interface BentoGridItemProps {
  title: string;
  description?: string;
  header?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive";
  className?: string;
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  interactive?: boolean;
  onClick?: () => void;
}

const BentoGrid = forwardRef<HTMLDivElement, BentoGridProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "grid auto-rows-[minmax(200px,auto)] grid-cols-1 gap-4",
          "md:grid-cols-2 lg:grid-cols-3",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
BentoGrid.displayName = "BentoGrid";

const BentoGridItem = forwardRef<HTMLDivElement, BentoGridItemProps>(
  ({
    title,
    description,
    header,
    icon,
    badge,
    badgeVariant = "default",
    className,
    children,
    size = "md",
    interactive = false,
    onClick,
    ...props
  }, ref) => {
    const sizeClasses = {
      sm: "md:col-span-1 md:row-span-1",
      md: "md:col-span-1 md:row-span-2",
      lg: "md:col-span-2 md:row-span-1",
      xl: "md:col-span-2 md:row-span-2"
    };

    return (
      <Card
        ref={ref}
        className={cn(
          "group relative overflow-hidden border border-border/50",
          "bg-card/50 backdrop-blur-sm",
          "transition-all duration-300 ease-out",
          "hover:border-border hover:bg-card/80",
          "hover:shadow-lg hover:shadow-primary/5",
          interactive && "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
          sizeClasses[size],
          className
        )}
        onClick={onClick}
        {...props}
      >
        {/* Header Content */}
        {header && (
          <div className="relative h-32 w-full overflow-hidden">
            {header}
            <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
          </div>
        )}

        {/* Content */}
        <div className="relative flex flex-1 flex-col p-6">
          {/* Title and Badge Row */}
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {icon && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  {icon}
                </div>
              )}
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {title}
              </h3>
            </div>
            {badge && (
              <Badge variant={badgeVariant} className="shrink-0">
                {badge}
              </Badge>
            )}
          </div>

          {/* Description */}
          {description && (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {description}
              </p>
              {children && <Separator className="mb-4" />}
            </>
          )}

          {/* Additional Content */}
          {children && (
            <div className="flex-1">
              {children}
            </div>
          )}

          {/* Interactive Indicator */}
          {interactive && (
            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            </div>
          )}
        </div>
      </Card>
    );
  }
);
BentoGridItem.displayName = "BentoGridItem";

export { BentoGrid, BentoGridItem };