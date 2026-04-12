/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#4A90D9', light: '#6BAAE8', dark: '#3570B0' },
        secondary: { DEFAULT: '#50B860', light: '#70D080', dark: '#3A9048' },
        accent: { DEFAULT: '#E8A040', light: '#F0B860', dark: '#C88028' },
        surface: '#FFFFFF',
        background: '#F5F7FA',
        'text-primary': '#1A2B3C',
        'text-secondary': '#6B7C8D',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
