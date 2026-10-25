/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Azul oscuro de la card de SEAM (T_Logo_SEAM.png, el fondo de la tarjeta de carga del juego): #080936 = seam-900. Es también el fondo opaco de
        // seam-heart.webp y seam-logo-full.webp, así que donde un logo se apoye sobre un degradado, la zona detrás del logo debe ser seam-900 liso (ver Login.tsx).
        seam: {
          50: '#f1f2fd',
          100: '#dfe0fb',
          200: '#b6baf6',
          300: '#767eee',
          400: '#323de6',
          500: '#1721be',
          600: '#101888',
          700: '#0c1164',
          800: '#090d4d',
          900: '#080936',
          950: '#04061e',
        },
        ink: {
          50: '#f5f7f8',
          100: '#e9edef',
          200: '#cfd8dc',
          300: '#a6b6bd',
          400: '#758c96',
          500: '#59717b',
          600: '#4c5f68',
          700: '#414f57',
          800: '#3a444a',
          900: '#242b2f',
          950: '#15191c',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.05), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.35s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.15s ease-out',
        shimmer: 'shimmer 1.6s infinite',
        'slide-in-right': 'slide-in-right 0.25s ease-out',
        'slide-in-left': 'slide-in-left 0.25s ease-out',
      },
    },
  },
  plugins: [],
}
