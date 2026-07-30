module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.3' } },
  plugins: ['react', 'react-hooks', 'react-refresh'],
  rules: {
    'react/jsx-no-target-blank': 'off',
    'react/prop-types': 'off',
    'no-unused-vars': 'off',
    'react-refresh/only-export-components': 'off',
    'react-hooks/exhaustive-deps': 'off',
    'react/jsx-key': 'off',
    'react/no-unescaped-entities': 'off',
    'react/no-unknown-property': 'off',
  },
}
