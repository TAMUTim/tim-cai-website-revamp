/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,svelte,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        ibm: ["IBM Plex Sans", "sans-serif"],
        nabla: ["Nabla", "sans-serif"],
      },
      width: {
        'content': '40rem'
      }
    },
  },
  plugins: [],
};

