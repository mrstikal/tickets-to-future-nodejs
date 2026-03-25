import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: [
      '**/node_modules/**',
      'apps/web/.next/**',
      'apps/web/out/**',
      'infra/postgres/**',
      'storage/**',
      'scripts/demo/output/**',
      '**/*.d.ts',
      '**/*.tsbuildinfo'
    ]
  },
  {
    files: ['apps/api/src/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    files: ['apps/api/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error'
    }
  },
  {
    files: ['apps/web/src/**/*.ts', 'apps/web/src/**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    files: ['scripts/**/*.js', 'index.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script'
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': 'off'
    }
  }
];

