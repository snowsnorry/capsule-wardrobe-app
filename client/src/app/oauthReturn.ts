function getSafeOAuthReturnPath(location: Location): string {
  const params = new URLSearchParams(location.search);
  const rawReturnTo = params.get("oauthReturnTo") || "";
  if (!rawReturnTo.startsWith("/oauth/authorize")) {
    return "";
  }

  try {
    const target = new URL(rawReturnTo, location.origin);
    if (
      target.origin !== location.origin ||
      target.pathname !== "/oauth/authorize"
    ) {
      return "";
    }

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "";
  }
}

export function redirectToOAuthReturnIfPresent(
  assignLocation?: (url: string) => void,
): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const returnPath = getSafeOAuthReturnPath(window.location);
  if (!returnPath) {
    return false;
  }

  (assignLocation || window.location.assign.bind(window.location))(returnPath);
  return true;
}
