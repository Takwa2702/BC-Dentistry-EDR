/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        dblue: '#000814',
        primary: '003566',
        'white-off': 'F8F8F8',
        
      }
    },
  },
  plugins: [],
}

