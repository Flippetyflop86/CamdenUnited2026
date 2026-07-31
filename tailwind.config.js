/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: "class",
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                /* ── Core (shadcn compatibility) ─────────────── */
                border: "hsl(var(--border) / <alpha-value>)",
                input: "hsl(var(--input) / <alpha-value>)",
                ring: "hsl(var(--ring) / <alpha-value>)",
                background: "hsl(var(--background) / <alpha-value>)",
                foreground: "hsl(var(--foreground) / <alpha-value>)",
                primary: {
                    DEFAULT: "hsl(var(--primary) / <alpha-value>)",
                    foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
                    foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
                    foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted) / <alpha-value>)",
                    foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent) / <alpha-value>)",
                    foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover) / <alpha-value>)",
                    foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
                },
                card: {
                    DEFAULT: "hsl(var(--card) / <alpha-value>)",
                    foreground: "hsl(var(--card-foreground) / <alpha-value>)",
                },

                /* ── ClubFlow Brand ─────────────────────────── */
                brand: {
                    DEFAULT: "hsl(var(--cf-brand) / <alpha-value>)",
                    hover: "hsl(var(--cf-brand-hover) / <alpha-value>)",
                    subtle: "hsl(var(--cf-brand-subtle) / <alpha-value>)",
                    foreground: "hsl(var(--cf-brand-foreground) / <alpha-value>)",
                },

                /* ── Surfaces ───────────────────────────────── */
                surface: {
                    "0": "hsl(var(--surface-0) / <alpha-value>)",
                    "1": "hsl(var(--surface-1) / <alpha-value>)",
                    "2": "hsl(var(--surface-2) / <alpha-value>)",
                    "3": "hsl(var(--surface-3) / <alpha-value>)",
                },

                /* ── Semantic Status ────────────────────────── */
                status: {
                    success: "hsl(var(--status-success) / <alpha-value>)",
                    warning: "hsl(var(--status-warning) / <alpha-value>)",
                    error: "hsl(var(--status-error) / <alpha-value>)",
                    info: "hsl(var(--status-info) / <alpha-value>)",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 1px)",
                sm: "calc(var(--radius) - 2px)",
            },
            boxShadow: {
                'cf-elevated': '0 10px 15px -3px rgba(0,0,0,0.5)',
            }
        },
    },
    plugins: [],
};
