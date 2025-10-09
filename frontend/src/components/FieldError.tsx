export function FieldError({ id, children }: { id: string; children?: React.ReactNode }) {
  if (!children) return null;
  return <p id={id} className="mt-1 text-xs text-danger">{children}</p>;
}