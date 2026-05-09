export async function buildWardrobeFilters(context, email) {
  const [formalityLevels, styles, occasions, seasons, patterns] =
    await Promise.all([
      context.getFormalityLevelsImpl(email),
      context.getStylesImpl(email),
      context.getOccasionsImpl(email),
      context.getSeasonsImpl(email),
      context.getPatternOptionsImpl(email),
    ]);

  return {
    formalityLevels,
    styles,
    occasions,
    seasons,
    audience: context.getAudienceOptionsImpl(),
    patterns,
  };
}
