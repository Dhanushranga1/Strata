// Motion tokens and variants for TicketPilot V2
export const durations = { fast: 0.12, base: 0.2, slow: 0.28 };
export const easings = { standard: [0.2, 0.8, 0.2, 1] as const };

export const v = {
  // Page transitions
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },

  // Card entry
  scaleIn: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.96 },
  },

  // Modal/dialog entry
  modal: {
    initial: { opacity: 0, scale: 0.95, y: 4 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 4 },
  },

  // Slide up (for panels/sheets)
  fadeUp: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 8 },
  },

  // List stagger animations
  list: {
    animate: {
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  },

  // List item animations
  item: {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
  },
};
