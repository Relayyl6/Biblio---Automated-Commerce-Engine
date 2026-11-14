/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          0: '#FFFFFF',
          50: '#FAF8F4',
          100: '#F2EEE7',
          200: '#E8E2D9',
        },
        ink: {
          950: '#0F1115',
          700: '#3B404A',
          400: '#8A909C',
          200: '#D1D5DB',
        },
        ember: {
          50: '#FDEEE9',
          500: '#E8552D',
          600: '#C94420',
        },
        settled: {
          50: '#E7F5EE',
          600: '#14865B',
        },
        review: {
          50: '#FBF3E4',
          600: '#B7791F',
        },
        alert: {
          50: '#FBE9E8',
          600: '#C8322B',
        },
        signal: {
          50: '#E9F0FD',
          600: '#2F6FDB',
        },
        biblio: {
          50: '#FDEEE9',
          100: '#FBDCD3',
          200: '#F7B9A7',
          300: '#F3967B',
          400: '#EE734F',
          500: '#E8552D',
          600: '#C94420',
          700: '#AA3516',
          800: '#8A270F',
          900: '#6B1B0A',
          950: '#0F1115',
        }
      },
      borderRadius: {
        'xs': '6px',
        'sm': '10px',
        'md': '16px',
        'lg': '24px',
        'pill': '9999px',
      },
      boxShadow: {
        'elev-1': '0 1px 2px rgba(15,17,21,0.06)',
        'elev-2': '0 8px 24px rgba(15,17,21,0.10)',
        'elev-3': '0 16px 48px rgba(15,17,21,0.16)',
        'elev-glass': '0 20px 50px rgba(15,17,21,0.12)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Hanken Grotesk', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-slow': 'float 6s ease-in-out infinite',
        'entrance': 'entrance 0.7s cubic-bezier(0.0, 0.0, 0.2, 1.0) forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        entrance: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
