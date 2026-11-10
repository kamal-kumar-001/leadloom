import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: 'var(--bg-canvas)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
          subtle: 'var(--bg-subtle)',
          overlay: 'var(--bg-overlay)',
        },
        border: {
          DEFAULT: 'var(--border-subtle)',
          subtle: 'var(--border-subtle)',
          muted: 'var(--border-muted)',
          focus: 'var(--border-focus)',
        },
        brand: {
          loom: 'var(--accent-loom)',
          loomGlow: 'var(--accent-loom-glow)',
          loomHover: 'var(--accent-hover)',
          weave: 'var(--accent-weave)',
          matrix: 'var(--accent-matrix)',
        },
        signal: {
          verified: 'var(--signal-verified)',
          catchall: 'var(--signal-catchall)',
          failed: 'var(--signal-failed)',
          throttled: 'var(--signal-throttled)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          inverse: 'var(--text-inverse)',
          onAccent: 'var(--on-accent)',
          mono: 'var(--text-mono)',
        },
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
