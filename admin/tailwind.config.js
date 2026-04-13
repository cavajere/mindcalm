import designTokensPkg from '@mindcalm/design-tokens'

const { designTokens } = designTokensPkg

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: designTokens.brand.primary,
        secondary: designTokens.brand.secondary,
        accent: designTokens.brand.accent,
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        background: 'rgb(var(--color-background) / <alpha-value>)',
        'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
        'ui-border': 'rgb(var(--color-border) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
      },
      fontFamily: {
        sans: designTokens.typography.fontFamilySans,
      },
    },
  },
  plugins: [],
}
