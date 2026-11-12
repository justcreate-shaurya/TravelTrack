import type { Config } from "tailwindcss";

// Colours are CSS variables (see globals.css) so light/dark swap without `dark:` variants.
// Each token is stored as RGB channels, so opacity modifiers work: `bg-accent/20`, `text-ink/60`.
const token = (name: string) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        surface: token("surface"),
        soft: token("surface-soft"),
        ink: token("ink"),
        ink2: token("ink-2"),
        ink3: token("ink-3"),
        line: "var(--line)",
        dark: token("dark-card"),
        ondark: token("on-dark"),
        ondark2: token("on-dark-2"),
        darkline: "var(--line-on-dark)",
        accent: token("accent"),
        accentInk: token("accent-ink"),
        accentDeep: token("accent-deep"),
        warn: token("warn"),
        warnInk: token("warn-ink"),
        danger: token("danger"),
      },
      fontFamily: {
        sans: ["var(--font-outfit)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "28px",
        inner: "20px",
        input: "16px",
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
        label: ["0.8125rem", { lineHeight: "1.125rem" }],
        title: ["2rem", { lineHeight: "2.25rem", letterSpacing: "-0.02em", fontWeight: "600" }],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        float: "var(--shadow-float)",
        nav: "var(--shadow-nav)",
        glow: "0 8px 24px -6px rgb(var(--accent-rgb) / 0.55)",
      },
      maxWidth: {
        phone: "440px",
      },
      spacing: {
        nav: "var(--nav-space)",
      },
    },
  },
  plugins: [],
} satisfies Config;
