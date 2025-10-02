// eslint.config.js
import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import tseslint from "typescript-eslint";

export default [
    {
        ignores: ["node_modules/", "dist/", "build/", "coverage/", "src-tauri/**"],
    },

    {
        files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.es2024,
            },
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
        },
        settings: { react: { version: "detect" } },
    },

    js.configs.recommended,

    ...tseslint.configs.recommended,

    react.configs.flat.recommended,

    {
        rules: {
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],

            "react/react-in-jsx-scope": "off",
            "react/jsx-uses-react": "off",

            "arrow-body-style": "off",
            "prefer-arrow-callback": "off",
        },
    },
];
