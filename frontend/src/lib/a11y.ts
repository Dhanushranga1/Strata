import { useEffect, useState } from "react";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const l = () => setReduced(m.matches);
    m.addEventListener?.("change", l); 
    return () => m.removeEventListener?.("change", l);
  }, []);
  return reduced;
}