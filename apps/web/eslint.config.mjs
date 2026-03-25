import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default [
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off'
    }
  },
  {
    files: ['src/app/**/*.tsx', 'src/components/**/*.tsx'],
    rules: {
      '@next/next/no-img-element': 'error',
      '@typescript-eslint/no-unused-vars': 'error'
    }
  },
  {
    ignores: ['.next/**', 'out/**', 'next-env.d.ts', 'eslint.config.mjs', 'postcss.config.mjs']
  }
];

