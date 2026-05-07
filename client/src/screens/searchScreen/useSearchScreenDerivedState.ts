import { useMemo } from "react";
import { translateOption } from "../../i18n";
import { buildActiveFilterChips } from "../../search/searchState";
import type { SearchDraftState, SearchOptions } from "../../search/searchState";
import type { SearchResultItem } from "./searchTypes";

function useSearchScreenDerivedState({
  draftState,
  locale,
  options,
  results,
  selectedResultId,
  t,
  total,
}: {
  draftState: SearchDraftState;
  locale: string;
  options: SearchOptions;
  results: SearchResultItem[];
  selectedResultId: string | number | null;
  t: (key: string, params?: Record<string, unknown>) => string;
  total: number;
}) {
  const formattedTotal = useMemo(
    () => new Intl.NumberFormat(locale).format(total),
    [locale, total],
  );
  const activeChips = useMemo(
    () =>
      buildActiveFilterChips({
        state: draftState,
        options,
        locale,
        t,
        translateOption,
      }),
    [draftState, locale, options, t],
  );
  const selectedItem = useMemo(
    () =>
      results.find((item) => String(item.id) === String(selectedResultId)) ||
      results[0] ||
      null,
    [results, selectedResultId],
  );

  return { activeChips, formattedTotal, selectedItem };
}

export default useSearchScreenDerivedState;
