import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: '#090A0F',
          surface: '#11131C',
          elevated: '#181B27',
          subtle: '#222638',
        },
        border: {
          subtle: '#1E2333',
          muted: '#2A3047',
          focus: '#6366F1',
        },
        brand: {
          loom: '#6366F1',
          loomGlow: 'rgba(99, 102, 241, 0.15)',
          weave: '#A855F7',
          matrix: '#10B981',
        },
        signal: {
          verified: '#10B981',
          catchall: '#F59E0B',
          failed: '#EF4444',
          throttled: '#EC4899',
        },
        text: {
          primary: '#F8FAFC',
          secondary: '#94A3B8',
          muted: '#64748B',
          mono: '#E2E8F0',
        },
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
