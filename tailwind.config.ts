import { type Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Saffron / "bhagwa" — the secondary accent color.
        saffron: {
          50: "#FFF7ED",
          100: "#FFEDD5",
          200: "#FED7AA",
          300: "#FDBA74",
          400: "#FB9A3C",
          500: "#FF9933", // bhagwa
          600: "#EA7B1B",
          700: "#C2610F",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
