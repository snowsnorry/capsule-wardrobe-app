import crypto from "node:crypto";
import { z } from "zod";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
  WebAuthnCredential,
} from "@simplewebauthn/server";
import { PASSKEY_CHALLENGE_COOKIE } from "./appConfig.js";
import { parseCookies } from "./httpCookies.js";

export type PasskeyChallengeKind = "registration" | "authentication";
export type PasskeyRecord = {
  id: string;
  profileEmail: string;
  credentialId: string;
  credentialPublicKey: string;
  counter: number | string;
  deviceType?: string | null;
  backedUp?: boolean | null;
  transports?: string[] | null;
  name?: string | null;
  aaguid?: string | null;
  lastUsedAt?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};
export type PasskeyChallengeRecord = {
  id: string;
  kind: string;
  challenge: string;
  profileEmail?: string | null;
  expiresAt?: string | Date;
  consumedAt?: string | Date | null;
  createdAt?: string | Date;
};

const webAuthnClientExtensionResultsSchema = z.object({}).passthrough();
const registrationResponseSchema = z
  .object({
    id: z.string(),
    rawId: z.string(),
    type: z.string(),
    authenticatorAttachment: z.string().optional(),
    clientExtensionResults: webAuthnClientExtensionResultsSchema,
    response: z
      .object({
        clientDataJSON: z.string(),
        attestationObject: z.string(),
        transports: z.array(z.string()).optional(),
        publicKeyAlgorithm: z.number().optional(),
        publicKey: z.string().optional(),
        authenticatorData: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();
const authenticationResponseSchema = z
  .object({
    id: z.string(),
    rawId: z.string(),
    type: z.string(),
    authenticatorAttachment: z.string().optional(),
    clientExtensionResults: webAuthnClientExtensionResultsSchema,
    response: z
      .object({
        clientDataJSON: z.string(),
        authenticatorData: z.string(),
        signature: z.string(),
        userHandle: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export function generatePasskeyChallengeId() {
  return crypto.randomBytes(32).toString("base64url");
}

export function publicKeyToBase64Url(publicKey: Uint8Array): string {
  return Buffer.from(publicKey).toString("base64url");
}

export function publicKeyFromBase64Url(
  publicKey: string,
): Uint8Array<ArrayBuffer> {
  const buffer = Buffer.from(publicKey, "base64url");
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  return new Uint8Array(arrayBuffer);
}

export function getPasskeyChallengeId(req): string {
  return String(
    parseCookies(req.headers.cookie)[PASSKEY_CHALLENGE_COOKIE] || "",
  ).trim();
}

export function toPasskeyMetadata(passkey: PasskeyRecord) {
  return {
    id: passkey.id,
    name: passkey.name || "",
    deviceType: passkey.deviceType || null,
    backedUp: passkey.backedUp ?? null,
    transports: Array.isArray(passkey.transports) ? passkey.transports : [],
    createdAt: passkey.createdAt || null,
    lastUsedAt: passkey.lastUsedAt || null,
  };
}

export function toWebAuthnCredential(
  passkey: PasskeyRecord,
): WebAuthnCredential {
  return {
    id: passkey.credentialId,
    publicKey: publicKeyFromBase64Url(passkey.credentialPublicKey),
    counter: Number(passkey.counter || 0),
    transports: Array.isArray(passkey.transports)
      ? (passkey.transports as AuthenticatorTransportFuture[])
      : [],
  };
}

export function isRegistrationResponse(
  payload: unknown,
): payload is RegistrationResponseJSON {
  return registrationResponseSchema.safeParse(payload).success;
}

export function isAuthenticationResponse(
  payload: unknown,
): payload is AuthenticationResponseJSON {
  return authenticationResponseSchema.safeParse(payload).success;
}
