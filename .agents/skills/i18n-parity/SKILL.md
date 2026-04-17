---
name: i18n-parity
description: Use when changing user-visible UI text to keep locale keys consistent and preserve EN/RU parity across the frontend.
---

# i18n-parity

Use this skill when changing visible UI text.

## Checklist
- locate the EN and RU resources
- update both languages in the same change
- preserve key naming consistency
- check tests covering locale helpers/parity
- avoid embedding untranslated strings directly in components

## Validation
- `npm run test:client`
- `npm run test:shared`