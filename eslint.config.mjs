import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "client/dist/**",
      "server/dist/**",
      ".agents/skills/impeccable/**",
      ".dependency-cruiser.cjs"
    ]
  },
  {
    files: [
      "client/render-server.js",
      "*.config.js",
      "*.config.mjs",
      "*.config.cjs",
      "scripts/**/*.js",
      "scripts/**/*.mjs",
      "scripts/**/*.cjs"
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022
      }
    },
    rules: {
      "no-console": "off"
    }
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "unused-imports": unusedImports
    },
    languageOptions: {
      parserOptions: {
        project: [
          "./tsconfig.eslint.json",
          "./client/tsconfig.json",
          "./client/tsconfig.node.json",
          "./server/tsconfig.json",
          "./server/tsconfig.src.json",
          "./server/tsconfig.test.json",
          "./shared/tsconfig.json"
        ],
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "no-debugger": "error",
      "no-console": "warn",

      "unused-imports/no-unused-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_"
        }
      ],

      "complexity": ["warn", 12],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 5],

      "max-lines": [
        "warn",
        {
          "max": 350,
          "skipBlankLines": true,
          "skipComments": true
        }
      ],

      "max-lines-per-function": [
        "warn",
        {
          "max": 90,
          "skipBlankLines": true,
          "skipComments": true
        }
      ],

      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn"
    }
  },
  {
    files: ["shared/i18n/*.ts"],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off"
    }
  },
  {
    files: ["tests/e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off"
    }
  },
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      "complexity": "off",
      "no-console": "off"
    }
  }
);
