import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const TS_FILES = ['**/*.ts', '**/*.mts'];
const JS_FILES = ['**/*.js', '**/*.mjs'];
const TEST_FILES = ['tests/**/*.ts', 'tests/**/*.mts'];

const RELATIVE_JS = '^\\.{1,2}/.*\\.m?js$';

const syntaxRules = {
  curly: ['error', 'all'],
  'no-var': 'error',
  yoda: 'error',
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-fallthrough': 'error',
  'max-statements-per-line': ['error', { max: 1 }],
  'no-restricted-properties': [
    'error',
    { property: 'forEach', message: 'for...of を使う（規約 §5.1）' },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: 'Decorator',
      message: 'デコレータ構文は Node で実行できない（規約 §4.8）',
    },
    {
      selector: 'AccessorProperty',
      message: 'accessor フィールドは Node で実行できない（規約 §4.8）',
    },
    {
      selector:
        'CallExpression > MemberExpression:matches([property.name="then"], [property.value="then"])',
      message: '.then() チェーンではなく async / await を使う（規約 §5.3）',
    },
  ],
};

export default defineConfig(
  { ignores: ['dist/'] },

  { linterOptions: { reportUnusedDisableDirectives: 'error' } },

  {
    files: JS_FILES,
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.nodeBuiltin },
    rules: syntaxRules,
  },

  {
    files: TS_FILES,
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked],
    languageOptions: {
      globals: globals.nodeBuiltin,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...syntaxRules,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: RELATIVE_JS,
              message: '相対 import には実ファイルの拡張子を書く（規約 §2.2）',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        ...syntaxRules['no-restricted-syntax'],
        {
          selector: `ImportExpression > Literal[value=/${RELATIVE_JS.replaceAll('/', '\\/')}/]`,
          message: '相対 import には実ファイルの拡張子を書く（規約 §2.2）',
        },
        {
          selector: 'ImportExpression > TemplateLiteral',
          message:
            '動的 import の指定子はリテラルで書く（規約 §2.2 の検査を効かせるため）',
        },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [
            {
              from: 'package',
              package: 'node:test',
              name: ['describe', 'it', 'test', 'suite'],
            },
          ],
        },
      ],
    },
  },

  {
    files: TEST_FILES,
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },

  prettier,

  // eslint-config-prettier が curly と max-statements-per-line を無効にするため戻す（規約 §8.1「整形」）
  {
    files: [...TS_FILES, ...JS_FILES],
    rules: {
      curly: syntaxRules.curly,
      'max-statements-per-line': syntaxRules['max-statements-per-line'],
    },
  },
);
