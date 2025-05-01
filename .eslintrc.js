module.exports = {
    parser: '@typescript-eslint/parser',
    plugins: [
      'react',
      'react-hooks',
      '@typescript-eslint'
    ],
    extends: [
      'eslint:recommended',
      'plugin:react/recommended',
      'plugin:react-hooks/recommended',
      'plugin:@typescript-eslint/recommended'
    ],
    env: {
      browser: true,
      es2021: true,
      node: true
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      // Désactive l'obligation d'importer React avec React 17+
      "react/react-in-jsx-scope": "off",
      // Préviens sur les variables non utilisées
      "no-unused-vars": "warn",
      "@typescript-eslint/no-unused-vars": "warn"
    }
  };