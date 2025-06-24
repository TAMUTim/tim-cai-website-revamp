/** @type {import('tailwindcss').Config} */

import typography from '@tailwindcss/typography';

export default {
  content: ['./src/**/*.{html,svelte,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        ibm: ["IBM Plex Sans", "sans-serif"],
        nabla: ["Nabla", "sans-serif"],
        ibmMono: ["IBM Plex Mono", "serif"]
      },
      width: {
        'content': '40rem',
        'hundred': '55rem'
      },
      typography: ({ theme }) => ({
        content: {
          css: {
            '--tw-prose-body': theme('colors.slate[300]'),
            '--tw-prose-headings': theme('colors.slate[300]'),
            '--tw-prose-links': theme('colors.slate[300]'),
            '--tw-prose-code': theme('colors.slate[400]'),

            h2: {
              fontSize: '2rem',
            },
            a: {
              textDecoration: 'none',
              borderBottom: '1px solid rgb(148 163 184)',
              transition: 'border 0.2s ease-in-out',
                '&:hover': {
                  borderBottom: '1px solid rgb(248 250 252)',
                }
            },
            '.ayu-dark': {
                padding: '0.6rem 0.75rem',
                borderRadius: '0.75rem',
            }
          },

        }
      }),
    },
  },
  plugins: [
    typography,
  ],
};

