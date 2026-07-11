/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      boxShadow: {
        'glow-primary': '0 0 25px -5px rgba(99, 102, 241, 0.4)',
        'glow-success': '0 0 25px -5px rgba(34, 197, 94, 0.4)'
      }
    }
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: ['dark', 'light', 'night', 'emerald'],
    darkTheme: 'dark',
    logs: false
  }
};
