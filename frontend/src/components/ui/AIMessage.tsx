"use client";

import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import { Card } from "./card";
import { Separator } from "./separator";
import { Button } from "./button";
import { Bot, Copy, ThumbsUp, ThumbsDown, RefreshCw, Sparkles } from "lucide-react";
import { forwardRef, useState } from "react";

interface AIMessageProps {
  content: string;
  timestamp?: Date;
  type?: "suggestion" | "analysis" | "response" | "error";
  confidence?: number;
  sources?: string[];
  className?: string;
  onCopy?: () => void;
  onFeedback?: (positive: boolean) => void;
  onRegenerate?: () => void;
  isLoading?: boolean;
  showActions?: boolean;
}

const AIMessage = forwardRef<HTMLDivElement, AIMessageProps>(
  ({
    content,
    timestamp,
    type = "response",
    confidence,
    sources = [],
    className,
    onCopy,
    onFeedback,
    onRegenerate,
    isLoading = false,
    showActions = true,
    ...props
  }, ref) => {
    const [copied, setCopied] = useState(false);
    const [feedback, setFeedback] = useState<boolean | null>(null);

    const typeConfig = {
      suggestion: {
        icon: Sparkles,
        color: "text-amber-500",
        bg: "bg-amber-50 dark:bg-amber-950/20",
        border: "border-amber-200 dark:border-amber-800/30",
        badge: "Suggestion"
      },
      analysis: {
        icon: Bot,
        color: "text-blue-500",
        bg: "bg-blue-50 dark:bg-blue-950/20", 
        border: "border-blue-200 dark:border-blue-800/30",
        badge: "Analysis"
      },
      response: {
        icon: Bot,
        color: "text-primary",
        bg: "bg-primary/5",
        border: "border-primary/20",
        badge: "AI Response"
      },
      error: {
        icon: Bot,
        color: "text-destructive",
        bg: "bg-destructive/5",
        border: "border-destructive/20",
        badge: "Error"
      }
    };

    const config = typeConfig[type];
    const IconComponent = config.icon;

    const handleCopy = async () => {
      if (onCopy) {
        onCopy();
      } else {
        await navigator.clipboard.writeText(content);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const handleFeedback = (positive: boolean) => {
      setFeedback(positive);
      onFeedback?.(positive);
    };

    return (
      <Card
        ref={ref}
        className={cn(
          "relative p-0 overflow-hidden",
          "border-l-4",
          config.border,
          config.bg,
          "transition-all duration-200",
          isLoading && "animate-pulse",
          className
        )}
        {...props}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-md bg-background/50", config.color)}>
              <IconComponent className="h-4 w-4" />
            </div>
            <Badge variant="outline" className="text-xs">
              {config.badge}
            </Badge>
            {confidence && (
              <Badge 
                variant={confidence > 0.8 ? "secondary" : confidence > 0.6 ? "secondary" : "outline"}
                className="text-xs"
              >
                {Math.round(confidence * 100)}% confidence
              </Badge>
            )}
          </div>
          {timestamp && (
            <span className="text-xs text-muted-foreground">
              {timestamp.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="px-4 pb-4">
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-4 bg-muted animate-pulse rounded" />
              <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
              <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
            </div>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {content}
              </p>
            </div>
          )}

          {/* Sources */}
          {sources.length > 0 && !isLoading && (
            <>
              <Separator className="my-3" />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Sources:
                </p>
                <div className="flex flex-wrap gap-1">
                  {sources.map((source, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {source}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          {showActions && !isLoading && (
            <>
              <Separator className="my-3" />
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-8 px-2 text-xs"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  {copied ? "Copied!" : "Copy"}
                </Button>

                {onFeedback && (
                  <>
                    <Button
                      variant={feedback === true ? "primary" : "ghost"}
                      size="sm"
                      onClick={() => handleFeedback(true)}
                      className="h-8 px-2 text-xs"
                    >
                      <ThumbsUp className="h-3 w-3 mr-1" />
                      Helpful
                    </Button>
                    <Button
                      variant={feedback === false ? "destructive" : "ghost"}
                      size="sm"
                      onClick={() => handleFeedback(false)}
                      className="h-8 px-2 text-xs"
                    >
                      <ThumbsDown className="h-3 w-3 mr-1" />
                      Not helpful
                    </Button>
                  </>
                )}

                {onRegenerate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRegenerate}
                    className="h-8 px-2 text-xs ml-auto"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Regenerate
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </Card>
    );
  }
);
AIMessage.displayName = "AIMessage";

export { AIMessage };