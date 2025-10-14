module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["react", "@typescript-eslint", "simple-import-sort"],
  rules: {
    "react/react-in-jsx-scope": "off",
    "simple-import-sort/imports": "error",
    "simple-import-sort/exports": "error",
    // Allow React Three Fiber properties (Three.js attributes)
    "react/no-unknown-property": ["error", { ignore: ["args", "attach", "array", "count", "itemSize", "position", "intensity", "castShadow", "metalness", "roughness", "emissive", "emissiveIntensity", "sizeAttenuation", "depthWrite", "vertexColors", "transparent", "map", "alphaTest"] }],
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
