import lightwing from '@lightwing/eslint-config'

export default lightwing(
  {
    ignores: [
      'dist',
      'node_modules',
      '*.svelte',
      '*.snap',
      '*.d.ts',
      'coverage',
      'js_test',
      'local-data',
      'release',
      'api_docs',
      'scripts',
      'deploy.md',
      'legacy',
      'bar_chart_race/minesweeper/data',
      'bar_chart_race/minesweeper/avatars',
      'bar_chart_race/web',
    ],
  },
  {
    rules: {
      'node/prefer-global/process': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['README.md'],
    rules: {
      'markdown/fenced-code-language': 'off',
    },
  },
)
