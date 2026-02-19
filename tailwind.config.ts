import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        nesema: {
          bark: "#2E2620",
          sage: "#4E7A5F",
          "sage-l": "#6B9E7A",
          "sage-p": "#EBF2EE",
          "sage-m": "#C3D9CB",
          clay: "#B5704A",
          "clay-p": "#F5EDE8",
          sky: "#4A7FA0",
          "sky-p": "#E8F2F8",
          amber: "#C27D30",
          "amb-p": "#F9F1E6",
          lav: "#7B6FA8",
          "lav-p": "#EEECf6",
          bg: "#F6F3EE",
          surf: "#FDFCFA",
          "sb-bg": "#2A2118",
          bdr: "#E6E0D8",
          t1: "#1E1A16",
          t2: "#5C5248",
          t3: "#9C9087",
          t4: "#BFB8B0",
        },
        // shadcn/ui compatible tokens mapped to Nesema palette
        background: "#F6F3EE",
        foreground: "#1E1A16",
        card: {
          DEFAULT: "#FDFCFA",
          foreground: "#1E1A16",
        },
        popover: {
          DEFAULT: "#FDFCFA",
          foreground: "#1E1A16",
        },
        primary: {
          DEFAULT: "#4E7A5F",
          foreground: "#FDFCFA",
        },
        secondary: {
          DEFAULT: "#EBF2EE",
          foreground: "#2E2620",
        },
        muted: {
          DEFAULT: "#F6F3EE",
          foreground: "#9C9087",
        },
        accent: {
          DEFAULT: "#EBF2EE",
          foreground: "#2E2620",
        },
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#FDFCFA",
        },
        border: "#E6E0D8",
        input: "#E6E0D8",
        ring: "#4E7A5F",
      },
      fontFamily: {
        serif: ["var(--font-cormorant)", "Georgia", "serif"],
        sans: ["var(--font-instrument)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
