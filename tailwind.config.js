/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Bricolage Grotesque Variable"', '"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        mono: ['"B612 Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          950: '#07090A',
          900: '#0C0F10',
          800: '#14181A',
          700: '#1E2426',
        },
        paper: {
          DEFAULT: '#F3EFE6',
          dim: '#E6E0D2',
        },
        'on-paper': {
          DEFAULT: '#0E1210',
          green: '#0B7A4B',
          amber: '#8A5A00',
        },
        amber: {
          DEFAULT: '#FFB020',
          ink: '#8A5A00',
        },
        green: {
          DEFAULT: '#3DDC97',
          ink: '#0B7A4B',
        },
        red: {
          DEFAULT: '#FF5C4D',
        },
        primary: '#ECEFEA',
        secondary: '#A7B0AB',
      },
      spacing: {
        '18': '4.5rem',
        '30': '7.5rem',
      },
      boxShadow: {
        'ticket': '0 8px 32px -4px rgba(0, 0, 0, 0.4)',
        'glow-amber': '0 0 60px 20px rgba(255, 176, 32, 0.08)',
      },
    },
  },
  plugins: [],
}
