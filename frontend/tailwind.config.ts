import type { Config } from "tailwindcss";
import animatePlugin from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        ring:       "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT:    "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT:    "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT:    "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        brand: {
          blue:    '#0052A5',
          red:     '#E31837',
          navy:    '#00285A',
          light:   '#EBF3FB',
          surface: '#FFFFFF',
        },
      },
      boxShadow: {
        glow:        '0 4px 24px -4px rgba(0, 82, 165, 0.30)',
        'glow-red':  '0 4px 24px -4px rgba(227, 24, 55, 0.28)',
        card:        '0 1px 3px 0 rgba(0,82,165,0.06), 0 1px 2px -1px rgba(0,82,165,0.04)',
        'card-md':   '0 4px 16px -2px rgba(0,82,165,0.10), 0 2px 6px -2px rgba(0,82,165,0.06)',
        'card-lg':   '0 8px 32px -4px rgba(0,82,165,0.12), 0 4px 12px -4px rgba(0,82,165,0.08)',
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #0052A5 0%, #E31837 100%)',
        'sidebar-gradient':'linear-gradient(180deg, #00285A 0%, #001635 100%)',
        'card-shine':      'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 100%)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "33%":       { transform: "translateY(-18px) rotate(3deg)" },
          "66%":       { transform: "translateY(-8px) rotate(-2deg)" },
        },
        "float-delayed": {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "40%":       { transform: "translateY(-22px) rotate(-3deg)" },
          "70%":       { transform: "translateY(-10px) rotate(2deg)" },
        },
        "pulse-ring": {
          "0%":   { transform: "scale(0.9)", opacity: "0.7" },
          "50%":  { transform: "scale(1.05)", opacity: "0.4" },
          "100%": { transform: "scale(0.9)", opacity: "0.7" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%":   { opacity: "0", transform: "translateX(32px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%":       { backgroundPosition: "100% 50%" },
        },
        "orbit": {
          "0%":   { transform: "rotate(0deg) translateX(0)" },
          "100%": { transform: "rotate(360deg) translateX(0)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to:   { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "accordion-down":  "accordion-down 0.2s ease-out",
        "accordion-up":    "accordion-up 0.2s ease-out",
        "float":           "float 7s ease-in-out infinite",
        "float-delayed":   "float-delayed 9s ease-in-out infinite 1.5s",
        "float-slow":      "float 11s ease-in-out infinite 3s",
        "pulse-ring":      "pulse-ring 3s ease-in-out infinite",
        "shimmer":         "shimmer 3s linear infinite",
        "fade-up":         "fade-up 0.6s ease-out both",
        "fade-up-delayed": "fade-up 0.6s ease-out 0.15s both",
        "slide-in-right":  "slide-in-right 0.5s ease-out both",
        "gradient-x":      "gradient-x 8s ease infinite",
        "spin-slow":       "spin-slow 20s linear infinite",
      },
    },
  },
  plugins: [animatePlugin],
};

export default config;
