function normalizeWardrobeSourceParam(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return value === "uploaded" || value === "from_catalog" ? value : "";
}

export { normalizeWardrobeSourceParam };
