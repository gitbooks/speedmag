/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#1C1C1E',
        'sidebar-hover': '#2C2C2E',
        'sidebar-active': '#3A3A3C',
        income: '#34C759',
        expense: '#FF3B30',
        transfer: '#FF9500',
        primary: '#007AFF',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
