/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#5B4AE6',
          light: 'rgba(91, 74, 230, 0.08)',
          50: '#EEF2FF',
          100: '#E0E7FF',
          500: '#5B4AE6',
          600: '#4F3ED4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
