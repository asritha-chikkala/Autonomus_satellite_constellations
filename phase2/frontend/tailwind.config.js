/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          950: "#05070c",
          900: "#090d16",
          850: "#0d1320",
          800: "#121a2c",
          700: "#1b2640",
          600: "#27375a",
        },
        aerospace: {
          cyan: "#00e5ff",
          emerald: "#00ff88",
          amber: "#ffb703",
          crimson: "#ff2a55",
          blue: "#3a86ff",
        }
      },
      fontFamily: {
        mono: ["Consolas", "Courier New", "monospace"],
      }
    },
  },
  plugins: [],
}
