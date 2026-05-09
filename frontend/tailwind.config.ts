import type { Config } from "tailwindcss";
import { heroui } from "@heroui/react";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/@heroui/react/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        /* V2 Semantic Tokens (Midnight Prism) */
        bg: "rgb(var(--bg))",
        surface: "rgb(var(--surface))",
        surface2: "rgb(var(--surface2))",
        text: "rgb(var(--text))",
        muted: {
          DEFAULT: "rgb(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        primary: {
          DEFAULT: "rgb(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        primary2: "rgb(var(--primary2))",
        success: "rgb(var(--success))",
        warning: "rgb(var(--warning))",
        danger: "rgb(var(--danger))",
        info: "rgb(var(--info))",
        ring: "hsl(var(--ring))",

        /* Legacy brand colors (preserve compatibility) */
        brand: {
          DEFAULT: "#3B82F6",
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A"
        },
        /* shadcn accent — hover/focus bg, NOT a brand color */
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },

        /* Legacy shadcn tokens (preserved for existing components) */
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(0,0,0,0.05)",
        cardHover: "0 8px 24px -8px rgba(0,0,0,0.15)"
      },
      transitionDuration: { 
        fast: "150ms", 
        base: "220ms" 
      },
      fontFamily: {
        geist: ["var(--font-geist)", "sans-serif"],
        inter: ["var(--font-inter)", "sans-serif"]
      }
    }
  },
  plugins: [
    require("tailwindcss-animate"),
    heroui()
  ],
};

export default config;