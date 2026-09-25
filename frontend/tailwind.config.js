/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef7ee',
          100: '#fdedd3',
          200: '#fad7a6',
          300: '#f6bc6e',
          400: '#f19635',
          500: '#ee7a10',
          600: '#df600a',
          700: '#b9470b',
          800: '#933810',
          900: '#773010',
        },
      },
    },
  },
  plugins: [],
}
