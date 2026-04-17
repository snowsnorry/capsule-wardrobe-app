---
name: full-stack-contract-check
description: Use when changing API behavior, auth flows, profile flows, or other features that touch both client and server, to verify request/response contracts and avoid one-sided changes.
---

# full-stack-contract-check

Use this skill when changing API behavior, auth flows, profile flows, or any feature touching both client and server.

## Checklist
- identify server module owning the contract
- identify client caller in `client/src/api/` or nearest screen/component
- verify request shape
- verify response shape
- verify error handling
- verify locale-visible copy if UX changes
- run the narrowest client and server tests affected

## Avoid
- one-sided contract changes
- silent env/config renames