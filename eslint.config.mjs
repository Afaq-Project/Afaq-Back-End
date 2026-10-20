// @ts-nocheck
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'eslint.config.mjs',
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '.agents/**/*',               // تجاهل مجلد .agents بالكامل
      'src/__mocks__/**',
      'add-security-tests.js',      // ملفات الجذر التي تظهر في الأخطاء
      'fix-tests.js',
      'update-security-tests.js',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // ── TypeScript strict ────────────────────────
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'no-type-imports' },
      ],

      // ── General quality ──────────────────────────
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-return-await': 'off', // handled by @typescript-eslint/return-await
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-throw-literal': 'off',
      '@typescript-eslint/only-throw-error': 'error',
    },
  },
  // ── Relaxed rules for test files ─────────────────
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/test/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      'no-console': 'off',
    },
  },
  // ── Relaxed rules for seed/scripts ───────────────
  {
    files: ['prisma/**/*.ts', 'scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);