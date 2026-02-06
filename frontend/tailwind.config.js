/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Roboto', 'system-ui', 'sans-serif'],
        heading: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Custom palette from coolors
        dark: '#100B00',
        lime: '#85CB33',
        cream: '#EFFFC8',
        sage: '#A5CBC3',
        olive: '#3B341F',
      },
    },
  },
  plugins: [],
}
