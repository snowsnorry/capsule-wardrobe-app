---
name: i18n-parity
description: Use when changing user-visible UI text or accessibility-only text to keep locale keys consistent and preserve EN/RU parity across the frontend.
---

# i18n-parity

Use this skill when changing visible UI text or accessibility-only text such as `aria-label`, `aria-labelledby`, `aria-describedby`, image alt text, tooltips, progress labels, live region messages, and screen-reader-only copy.

## Checklist
- locate the EN and RU resources
- update both languages in the same change
- preserve key naming consistency
- check tests covering locale helpers/parity
- avoid embedding untranslated visible or accessibility-only strings directly in components
- include dynamic a11y labels in locale resources with interpolation params instead of template literals

## Validation
- `npm run test:client`
- `npm run test:shared`
