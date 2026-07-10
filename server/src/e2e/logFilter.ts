function shouldMuteExpectedE2eWarning(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  return (
    (value.includes("event=http.request.failed") &&
      value.includes("method=GET") &&
      value.includes("path=/auth/me") &&
      value.includes("statusCode=401")) ||
    (value.includes("event=http.request.slow") &&
      value.includes("method=POST") &&
      value.includes("path=/wardrobe/items/upload") &&
      /\bstatusCode=2\d{2}\b/.test(value))
  );
}

function installE2eLogFilter(consoleObject = globalThis.console) {
  const originalWarn = consoleObject.warn.bind(consoleObject);
  consoleObject.warn = (...args: unknown[]) => {
    if (shouldMuteExpectedE2eWarning(args[0])) {
      return;
    }

    originalWarn(...args);
  };
}

export { installE2eLogFilter, shouldMuteExpectedE2eWarning };
