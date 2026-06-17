import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
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
      // Intentional patterns: auth bootstrap, pagination reset on filter change, form sync from props.
      'react-hooks/set-state-in-effect': 'off',
      // Ref sync during render (e.g. sound mute flag) and memo edge cases in data tables.
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      // Utility exports alongside components (DocumentViewer helpers, context hooks).
      'react-refresh/only-export-components': 'warn',
    },
  },
])
