/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,html}"
  ],
  theme: {
    extend: {
      colors: {
        lava: {
          50:  "#fff1f0",
          100: "#ffe0db",
          200: "#ffc5bd",
          300: "#ff9e91",
          400: "#ff6655",
          500: "#ff3621",
          600: "#ed1a04",
          700: "#c81202",
          800: "#a51308",
          900: "#88160d",
          950: "#4b0704"
        },
        neon: {
          pink:   "#ff2d78",
          blue:   "#00d4ff",
          green:  "#39ff14",
          purple: "#bf00ff",
          orange: "#ff6b00",
          yellow: "#ffe600"
        }
      },
      fontFamily: {
        display: ["'Orbitron'", "sans-serif"],
        body:    ["'Exo 2'",   "sans-serif"]
      },
      boxShadow: {
        "neon-pink":   "0 0 8px #ff2d78, 0 0 20px #ff2d78, 0 0 40px #ff2d7844",
        "neon-blue":   "0 0 8px #00d4ff, 0 0 20px #00d4ff, 0 0 40px #00d4ff44",
        "neon-green":  "0 0 8px #39ff14, 0 0 20px #39ff14, 0 0 40px #39ff1444",
        "neon-purple": "0 0 8px #bf00ff, 0 0 20px #bf00ff, 0 0 40px #bf00ff44",
        "neon-orange": "0 0 8px #ff6b00, 0 0 20px #ff6b00, 0 0 40px #ff6b0044"
      },
      backgroundImage: {
        "lava-gradient":   "linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 50%, #0f0f1a 100%)",
        "neon-gradient":   "linear-gradient(90deg, #ff2d78, #bf00ff, #00d4ff)",
        "fire-gradient":   "linear-gradient(135deg, #ff6b00, #ff2d78, #bf00ff)"
      }
    }
  },
  plugins: []
};
