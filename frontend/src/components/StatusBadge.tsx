export function StatusBadge({ status }: { status: "open"|"in_progress"|"resolved"|"closed"|"escalated" }) {
  const map: Record<string, string> = {
    open: "bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400",
    in_progress: "bg-warning/15 text-warning dark:bg-warning/20 dark:text-warning",
    resolved: "bg-success/15 text-success dark:bg-success/20 dark:text-success",
    closed: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    escalated: "bg-danger/15 text-danger dark:bg-danger/20 dark:text-danger"
  };
  return (
    <span className={`px-2.5 py-1 text-xs rounded-full capitalize font-medium ${map[status] || ""}`}>
      {status.replace("_", " ")}
    </span>
  );
}