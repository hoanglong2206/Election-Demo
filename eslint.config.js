import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dist-electron', 'node_modules', '_ui-verify', 'coverage', '.gemini']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'no-empty': 'warn',
      'prefer-const': 'warn',
      'no-useless-assignment': 'warn',
      'no-useless-escape': 'warn',
      'preserve-caught-error': 'off',
      'react-refresh/only-export-components': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },

  // 1. Core layer boundary: core only imports core/types
  {
    files: ['src/app/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/features/**',
                '@/components/**',
                '@/services/**',
                '@/infrastructure/**',
                '@/hooks/**',
                '**/features/**',
                '**/components/**',
                '**/services/**',
                '**/infrastructure/**',
                '**/hooks/**',
              ],
              message: 'Core layer cannot import features, components, services, infrastructure, or hooks.',
            },
          ],
        },
      ],
    },
  },

  // 2. Infrastructure layer boundary: infrastructure -> core, common
  {
    files: ['src/app/infrastructure/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/features/**',
                '@/components/**',
                '@/services/**',
                '@/hooks/**',
                '**/features/**',
                '**/components/**',
                '**/services/**',
                '**/hooks/**',
              ],
              message: 'Infrastructure layer cannot import features, components, services, or hooks.',
            },
          ],
        },
      ],
    },
  },

  // 3. Services layer boundary: services -> core + infrastructure/ipc; NO React; NO direct window.api
  {
    files: ['src/app/services/**/*.{ts,tsx}'],
    ignores: ['src/app/services/**/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'Services layer must not import React.',
            },
            {
              name: 'react-dom',
              message: 'Services layer must not import ReactDOM.',
            },
          ],
          patterns: [
            {
              group: [
                '@/features/**',
                '@/components/**',
                '**/features/**',
                '**/components/**',
              ],
              message: 'Services layer cannot import features or components.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='window'][property.name='api']",
          message:
            "Direct access to window.api is forbidden in services. Use typed ports from '@/infrastructure/ipc'.",
        },
      ],
    },
  },

  // 4. UI & lib boundary: components/ui and lib only import lib
  {
    files: ['src/app/components/ui/**/*.{ts,tsx}', 'src/app/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/features/**',
                '@/services/**',
                '@/hooks/**',
                '@/infrastructure/**',
                '**/features/**',
                '**/services/**',
                '**/hooks/**',
                '**/infrastructure/**',
              ],
              message: 'UI and lib components must only import from lib.',
            },
          ],
        },
      ],
    },
  },
])
