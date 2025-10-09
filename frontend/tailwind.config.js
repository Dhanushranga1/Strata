/** @type {import('tailwindcss').Config} */
const { heroui } = require("@heroui/react");

module.exports = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/@heroui/react/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
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
        accent: { DEFAULT: "#EC4899" },
        success: { DEFAULT: "#22C55E" },
        warning: { DEFAULT: "#F97316" },
        danger: { DEFAULT: "#EF4444" },
        surface: { light: "#FFFFFF", dark: "#1A1B1E" },
        canvas: { light: "#F8F9FA", dark: "#111214" },
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
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
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