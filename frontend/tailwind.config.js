/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      backgroundImage:{
        'boxChild': "url(./src/assets/patron 5.webp)"
      }
    },
  },
  plugins: [],
}