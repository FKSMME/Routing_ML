/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 미래지향적 색상 팔레트
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        accent: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
        cyber: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        dark: {
          bg: '#0a0e1a',
          surface: '#131827',
          elevated: '#1e2438',
          border: '#2d3548',
          text: {
            primary: '#e4e7eb',
            secondary: '#9ca3af',
            muted: '#6b7280',
          }
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-cyber': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'gradient-future': 'linear-gradient(135deg, #0ea5e9 0%, #a855f7 100%)',
        'gradient-neon': 'linear-gradient(135deg, #10b981 0%, #0ea5e9 100%)',
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(14, 165, 233, 0.3)',
        'glow': '0 0 20px rgba(14, 165, 233, 0.4)',
        'glow-lg': '0 0 30px rgba(14, 165, 233, 0.5)',
        'glow-purple': '0 0 20px rgba(168, 85, 247, 0.4)',
        'glow-green': '0 0 20px rgba(16, 185, 129, 0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-in': 'slideIn 0.3s ease-out forwards',
        'slide-in-delayed-1': 'slideIn 0.3s ease-out 0.1s forwards',
        'slide-in-delayed-2': 'slideIn 0.3s ease-out 0.2s forwards',
        'slide-in-delayed-3': 'slideIn 0.3s ease-out 0.3s forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'drop-in': 'dropIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'particle-float': 'particleFloat 4s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'bounce-in': 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards',
        'bounce-in-1': 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.05s forwards',
        'bounce-in-2': 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.1s forwards',
        'bounce-in-3': 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.15s forwards',
        'bounce-in-4': 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.2s forwards',
        'dust-particle': 'dustParticle 3s ease-in-out infinite',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'slide-down': 'slideDown 0.4s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(14, 165, 233, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(14, 165, 233, 0.6)' },
        },
        slideIn: {
          '0%': {
            opacity: '0',
            transform: 'translateX(-20px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': {
            opacity: '0',
            transform: 'scale(0.9)',
          },
          '100%': {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
        dropIn: {
          '0%': {
            opacity: '0',
            transform: 'translateY(-50px) scale(0.8)',
            filter: 'blur(10px)',
          },
          '60%': {
            transform: 'translateY(5px) scale(1.02)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0) scale(1)',
            filter: 'blur(0px)',
          },
        },
        particleFloat: {
          '0%, 100%': {
            transform: 'translate(0, 0) rotate(0deg)',
            opacity: '0.3',
          },
          '25%': {
            transform: 'translate(10px, -20px) rotate(90deg)',
            opacity: '0.6',
          },
          '50%': {
            transform: 'translate(-5px, -40px) rotate(180deg)',
            opacity: '0.3',
          },
          '75%': {
            transform: 'translate(-15px, -20px) rotate(270deg)',
            opacity: '0.6',
          },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        bounceIn: {
          '0%': {
            opacity: '0',
            transform: 'scale(0.3) translateY(-100px)',
          },
          '50%': {
            opacity: '0.9',
            transform: 'scale(1.05)',
          },
          '70%': {
            transform: 'scale(0.95)',
          },
          '100%': {
            opacity: '1',
            transform: 'scale(1) translateY(0)',
          },
        },
        dustParticle: {
          '0%': {
            transform: 'translate(0, 0) rotate(0deg)',
            opacity: '0',
          },
          '10%': {
            opacity: '1',
          },
          '90%': {
            opacity: '1',
          },
          '100%': {
            transform: 'translate(var(--tx, 100px), var(--ty, -100px)) rotate(360deg)',
            opacity: '0',
          },
        },
        slideUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(30px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        slideDown: {
          '0%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
          '100%': {
            opacity: '0',
            transform: 'translateY(30px)',
          },
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        '4xl': '2rem',
      }
    },
  },
  plugins: [],
};
