/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"  // ← Questo è corretto per la tua struttura
  ],
  theme: {
    extend: {
      colors: {
        blue: {
          50: '#E8F2F5',
          100: '#C5E0E8',
          200: '#8FC1D0',
          300: '#5AA2B8',
          400: '#3A7D95',
          500: '#1A5367',
          600: '#2A6B82',
          700: '#3A829D',
        },
        cyan: {
          50: '#EBF4F7',
          600: '#2A6B82',
          700: '#3A829D',
        },
        green: {
          50: '#EFF4E9',
          100: '#D4E2C1',
          600: '#6B8E4E',
        },
        yellow: {
          50: '#FCF5EE',
          600: '#D4A574',
        },
        red: {
          50: '#F9F1ED',
          500: '#C4825D',
        },
        gray: {
          50: '#F7F3EE',
          100: '#F5F1E8',
          200: '#E8E6E0',
          500: '#6B6760',
          600: '#4A4845',
          700: '#2C2B28',
          900: '#111827',
        }
      }
    },
  },
  plugins: [],
}