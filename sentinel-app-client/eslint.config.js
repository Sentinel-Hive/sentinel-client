// eslint.config.js
import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import tseslint from "typescript-eslint";

export default [
    // Ignore stuff we don’t want to lint
    {
        ignores: [
            "node_modules/",
            "dist/",
            "build/",
            "coverage/",
            "src-tauri/**", // keep ESLint out of Rust/build outputs
        ],
    },

    // Base language options for all files
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

    // JS recommended
    js.configs.recommended,

    // TypeScript (non type-aware; simpler & fast)
    ...tseslint.configs.recommended,

    // React recommended
    react.configs.flat.recommended,

    // Small rule tweaks + Prettier harmony
    {
        rules: {
            // Let TS handle unused vars
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],

            // New JSX runtime
            "react/react-in-jsx-scope": "off",
            "react/jsx-uses-react": "off",

            // Don’t fight Prettier on style
            "arrow-body-style": "off",
            "prefer-arrow-callback": "off",
        },
    },
];
