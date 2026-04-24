# PLAN.md — Add passkey login

## Decision

Store passkeys in a separate `profile_passkeys` table.

Do not store passkey credentials in `profiles`.

Reason: one profile may have multiple passkeys. Credentials are separate auth artifacts with their own `credential_id`, public key, counter, transports, metadata, and lifecycle.

Optional: add only UX prompt state to `profiles`, for example `passkey_prompt_dismissed_at`, if needed.

## Goal

Add passkey authentication alongside existing email-code and Google login.

User flow:
- existing users log in via email-code or Google
- if they have no passkey, show snackbar suggesting passkey setup
- Account settings page allows adding/removing passkeys
- Login page allows signing in with passkey

## Dependencies

Install:

```bash
npm --workspace server install @simplewebauthn/server
npm --workspace client install @simplewebauthn/browser
```

## Environment

Add server env config:

```env
PASSKEY_RP_NAME=Capsule Wardrobe
PASSKEY_RP_ID=localhost
PASSKEY_ORIGIN=http://localhost:3000
```

Production values must match the deployed domain:

```env
PASSKEY_RP_ID=your-domain.com
PASSKEY_ORIGIN=https://your-domain.com
```

## Database

Add migration:

```sql
create table if not exists profile_passkeys (
  id uuid primary key default gen_random_uuid(),

  profile_email text not null references profiles(email) on delete cascade,

  credential_id text not null unique,
  credential_public_key text not null,

  counter bigint not null default 0,

  device_type text,
  backed_up boolean,
  transports text[] not null default '{}',

  name text,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists profile_passkeys_profile_email_idx
  on profile_passkeys(profile_email);
```

Optional only if needed:

```sql
alter table profiles
  add column if not exists passkey_prompt_dismissed_at timestamp with time zone,
  add column if not exists passkey_prompt_last_shown_at timestamp with time zone;
```

## Server API

Add passkey routes.

Authenticated management routes:

```txt
GET    /api/auth/passkeys
POST   /api/auth/passkeys/register/options
POST   /api/auth/passkeys/register/verify
DELETE /api/auth/passkeys/:id
```

Public login routes:

```txt
POST /api/auth/passkeys/authenticate/options
POST /api/auth/passkeys/authenticate/verify
```

## Server implementation

Create a passkey auth module following existing server conventions.

Responsibilities:
- load RP config
- generate registration options
- verify registration response
- generate authentication options
- verify authentication response
- list passkeys
- delete passkeys

Use the existing session mechanism.

Store short-lived WebAuthn challenges in session:

```ts
req.session.passkeyRegistrationChallenge = options.challenge;
req.session.passkeyAuthenticationChallenge = options.challenge;
```

Delete challenge after successful verification.

After successful passkey login, create the same app session as email-code/Google login.

Do not create a separate passkey session model.

## Registration flow

Authenticated user only.

1. Client calls `/api/auth/passkeys/register/options`.
2. Server generates registration options.
3. Server stores challenge in session.
4. Client calls `startRegistration`.
5. Client sends result to `/api/auth/passkeys/register/verify`.
6. Server verifies result.
7. Server stores passkey in `profile_passkeys`.

Use:
- `attestationType: 'none'`
- `residentKey: 'preferred'`
- `userVerification: 'preferred'`
- `excludeCredentials` for already registered credentials

## Authentication flow

Logged-out user.

1. Client calls `/api/auth/passkeys/authenticate/options`.
2. Server generates authentication options.
3. Server stores challenge in session.
4. Client calls `startAuthentication`.
5. Client sends result to `/api/auth/passkeys/authenticate/verify`.
6. Server finds passkey by `credential_id`.
7. Server verifies assertion.
8. Server updates counter and `last_used_at`.
9. Server creates normal app session.

## Client implementation

Add API wrapper:

```txt
client/src/api/passkeys.ts
```

Functions:
- `listPasskeys`
- `getPasskeyRegistrationOptions`
- `verifyPasskeyRegistration`
- `getPasskeyAuthenticationOptions`
- `verifyPasskeyAuthentication`
- `deletePasskey`

Add browser helper:

```txt
client/src/auth/passkeys.ts
```

Responsibilities:
- call API options endpoint
- call `startRegistration` / `startAuthentication`
- call API verify endpoint
- normalize browser/WebAuthn errors

## Login UI

Add button:

```txt
Sign in with passkey
```

Flow:
- call authentication helper
- on success refresh current user/profile state
- navigate into app
- on cancel show mild message
- on verification failure show generic login error

## Post-login snackbar

After successful email-code or Google login, show snackbar if:
- browser supports WebAuthn
- user has zero passkeys
- prompt was not recently dismissed

Text:

```txt
Add a passkey for faster sign-in?
```

Actions:
- `Add`
- `Not now`

`Add` starts registration flow.

`Not now` dismisses prompt locally or via profile prompt fields if implemented.

## Account settings UI

On Account page add section:

```txt
Passkeys
```

Features:
- list registered passkeys
- add passkey
- delete passkey
- show empty state

Deletion must be confirmed.

Do not prevent deleting the last passkey because email-code and Google login remain available.

## i18n

Add EN/RU strings for:
- Sign in with passkey
- Add passkey
- Remove passkey
- Passkeys
- Add a passkey for faster sign-in?
- Not now
- Passkey added
- Passkey removed
- Passkey setup failed
- Passkey login failed
- Passkeys are not supported in this browser/device

## Security

Required:
- never store private keys
- never return stored public keys to client
- challenges must be single-use
- validate origin
- validate RP ID
- passkey deletion must be scoped to current profile
- passkey registration requires active session
- passkey authentication creates the existing normal app session
- no user enumeration through passkey errors

## Tests

Server tests:
- registration options require session
- registration options store challenge
- registration verify rejects missing challenge
- registration verify stores passkey
- authentication options store challenge
- authentication verify rejects unknown credential
- authentication verify updates counter
- authentication verify creates session
- delete requires session
- delete only removes current user’s passkey

Client tests:
- login button starts passkey flow
- account page lists passkeys
- account page can add passkey
- account page can delete passkey
- snackbar appears only when user has no passkeys
- browser WebAuthn cancel is handled gracefully

Mock `@simplewebauthn/browser` in client tests.

## Validation

Run:

```bash
npm run typecheck
npm run test
npm run build
```

## Implementation batches

### Batch 1 — DB and dependencies

- install dependencies
- add passkey DB migration
- add RP config
- add passkey DB helpers

Commit:

```bash
git add .
git commit -m "Add passkey storage schema"
```

### Batch 2 — Server registration API

- add registration options endpoint
- add registration verify endpoint
- store/delete challenge in session
- save verified passkey
- add tests

Commit:

```bash
git add .
git commit -m "Add passkey registration API"
```

### Batch 3 — Server authentication API

- add authentication options endpoint
- add authentication verify endpoint
- verify credential
- update counter and last used timestamp
- create existing app session
- add tests

Commit:

```bash
git add .
git commit -m "Add passkey authentication API"
```

### Batch 4 — Client passkey helpers

- add API wrapper
- add browser WebAuthn helper
- add tests

Commit:

```bash
git add .
git commit -m "Add client passkey helpers"
```

### Batch 5 — Login UI

- add passkey login button
- wire authentication flow
- handle errors
- add i18n
- add tests

Commit:

```bash
git add .
git commit -m "Add passkey login UI"
```

### Batch 6 — Snackbar prompt

- show prompt after email/Google login
- wire Add action to registration flow
- wire Not now dismissal
- add tests

Commit:

```bash
git add .
git commit -m "Prompt users to add passkeys after login"
```

### Batch 7 — Account settings

- add Passkeys section
- list passkeys
- add passkey
- delete passkey
- add tests

Commit:

```bash
git add .
git commit -m "Add passkey management settings"
```

### Batch 8 — Final validation

- run full validation
- fix typecheck/test/build issues
- ensure no sensitive credential material is logged

Commit:

```bash
git add .
git commit -m "Finalize passkey login support"
```

## Acceptance criteria

- Email-code login still works.
- Google login still works.
- Logged-in user can add passkey.
- Logged-in user can delete own passkey.
- Logged-out user can sign in with passkey.
- Passkey login creates normal app session.
- User cannot delete another user’s passkey.
- User cannot register passkey while logged out.
- Full validation passes.