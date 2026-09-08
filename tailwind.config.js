/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        seam: {
          50: '#eefcfa',
          100: '#d3f7f1',
          200: '#a8eee3',
          300: '#71dfd0',
          400: '#3ec8b8',
          500: '#1fac9d',
          600: '#168a80',
          700: '#166f68',
          800: '#175854',
          900: '#164947',
          950: '#062a29',
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
    },
  },
  plugins: [],
}
