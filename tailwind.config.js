import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': theme('colors.gray.800'),
            '--tw-prose-headings': theme('colors.black'),
            '--tw-prose-links': theme('colors.black'),
            '--tw-prose-bold': theme('colors.black'),
            '--tw-prose-hr': theme('colors.black'),
            '--tw-prose-quotes': theme('colors.gray.700'),
            '--tw-prose-code': theme('colors.gray.800'),
            '--tw-prose-th-borders': theme('colors.black'),
            '--tw-prose-td-borders': theme('colors.black'),
            a: { textDecoration: 'underline' },
            hr: { borderTopWidth: '2px' },
            pre: {
              backgroundColor: theme('colors.white'),
              borderWidth: '2px',
              borderColor: theme('colors.black'),
              borderRadius: theme('borderRadius.lg'),
              padding: theme('spacing.3'),
            },
            code: {
              backgroundColor: theme('colors.gray.100'),
              borderWidth: '1px',
              borderColor: theme('colors.black'),
              borderRadius: theme('borderRadius.md'),
              padding: '0 0.25rem',
            },
            table: {
              borderWidth: '2px',
              borderColor: theme('colors.black'),
            },
            'th, td': {
              borderWidth: '2px',
              borderColor: theme('colors.black'),
              padding: `${theme('spacing.2')} ${theme('spacing.3')}`,
            },
          },
        },
      }),
    },
  },
  plugins: [typography],
}
