export function passkeyRegistrationResponse(
  overrides: Record<string, unknown> = {},
) {
  const responseOverrides: Record<string, unknown> =
    overrides.response &&
    typeof overrides.response === "object" &&
    !Array.isArray(overrides.response)
      ? (overrides.response as Record<string, unknown>)
      : {};
  const { response: _response, ...topLevelOverrides } = overrides;
  return {
    id: "credential-1",
    rawId: "credential-1",
    type: "public-key",
    authenticatorAttachment: "platform",
    clientExtensionResults: {},
    response: {
      clientDataJSON: "client-data",
      attestationObject: "attestation-object",
      transports: ["internal"],
      publicKeyAlgorithm: -7,
      publicKey: "public-key",
      authenticatorData: "authenticator-data",
      ...responseOverrides,
    },
    ...topLevelOverrides,
  };
}

export function passkeyAuthenticationResponse(
  overrides: Record<string, unknown> = {},
) {
  const responseOverrides: Record<string, unknown> =
    overrides.response &&
    typeof overrides.response === "object" &&
    !Array.isArray(overrides.response)
      ? (overrides.response as Record<string, unknown>)
      : {};
  const { response: _response, ...topLevelOverrides } = overrides;
  return {
    id: "credential-1",
    rawId: "credential-1",
    type: "public-key",
    authenticatorAttachment: "platform",
    clientExtensionResults: {},
    response: {
      clientDataJSON: "client-data",
      authenticatorData: "authenticator-data",
      signature: "signature",
      userHandle: "person@example.com",
      ...responseOverrides,
    },
    ...topLevelOverrides,
  };
}
