import { useCallback, useMemo, useState } from "react";
import {
  clearProfileOptionsCache,
  loadProfileOptions,
  primeProfileOptionsCache,
} from "../api/profileOptionsCache";
import {
  FALLBACK_AUDIENCE_OPTIONS,
  FALLBACK_OCCASION_OPTIONS,
  FALLBACK_SEASON_OPTIONS,
  FALLBACK_STYLE_OPTIONS,
} from "./appConstants";
import { sortSeasonOptions } from "./capsuleState";
import type { ProfileOptionsResult, WardrobeFiltersResponse } from "./appTypes";

export function useProfileOptions() {
  const [styleOptions, setStyleOptions] = useState(FALLBACK_STYLE_OPTIONS);
  const [occasionOptions, setOccasionOptions] = useState<string[]>([]);
  const [seasonOptions, setSeasonOptions] = useState<string[]>([]);
  const [audienceOptions, setAudienceOptions] = useState<string[]>([]);
  const [patternOptions, setPatternOptions] = useState<string[]>([]);
  const orderedSeasonOptions = useMemo(
    () => sortSeasonOptions(seasonOptions),
    [seasonOptions],
  );

  const resetProfileOptions = useCallback(() => {
    clearProfileOptionsCache();
    setStyleOptions(FALLBACK_STYLE_OPTIONS);
    setOccasionOptions([]);
    setSeasonOptions([]);
    setAudienceOptions([]);
    setPatternOptions([]);
  }, []);

  const applyFallbackOptions = useCallback(() => {
    setStyleOptions(FALLBACK_STYLE_OPTIONS);
    setOccasionOptions(FALLBACK_OCCASION_OPTIONS);
    setSeasonOptions(FALLBACK_SEASON_OPTIONS);
    setAudienceOptions(FALLBACK_AUDIENCE_OPTIONS);
    setPatternOptions([]);
  }, []);

  const applyLoadedOptions = useCallback((result: ProfileOptionsResult) => {
    setStyleOptions(result.styles);
    setOccasionOptions(result.occasions);
    setSeasonOptions(result.seasons);
    setAudienceOptions(result.audience);
    setPatternOptions(result.patterns);
  }, []);

  const applyWardrobeFilters = useCallback(
    (filters: WardrobeFiltersResponse) => {
      applyLoadedOptions(primeProfileOptionsCache(filters));
    },
    [applyLoadedOptions],
  );

  const preloadOnboardingOptions = useCallback(
    async ({ useFallback = false }: { useFallback?: boolean } = {}) => {
      try {
        const result = (await loadProfileOptions()) as ProfileOptionsResult;
        applyLoadedOptions(result);
      } catch (error) {
        if (!useFallback) {
          throw error;
        }
        applyFallbackOptions();
      }
    },
    [applyFallbackOptions, applyLoadedOptions],
  );

  const ensureOptionsLoaded = useCallback(
    async ({ useFallback = false }: { useFallback?: boolean } = {}) => {
      const optionsLoaded =
        Array.isArray(styleOptions.core) &&
        Array.isArray(styleOptions.aesthetics) &&
        occasionOptions.length > 0 &&
        seasonOptions.length > 0 &&
        audienceOptions.length > 0 &&
        Array.isArray(patternOptions);
      if (!optionsLoaded) {
        await preloadOnboardingOptions({ useFallback });
      }
    },
    [
      audienceOptions.length,
      occasionOptions.length,
      patternOptions,
      preloadOnboardingOptions,
      seasonOptions.length,
      styleOptions,
    ],
  );

  return {
    styleOptions,
    occasionOptions,
    seasonOptions,
    orderedSeasonOptions,
    audienceOptions,
    patternOptions,
    applyWardrobeFilters,
    ensureOptionsLoaded,
    preloadOnboardingOptions,
    resetProfileOptions,
  };
}
