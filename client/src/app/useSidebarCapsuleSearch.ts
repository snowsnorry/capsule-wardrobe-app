import { useCallback, useEffect, useState } from "react";
import type { SearchState } from "../screens/mainScreen/MainScreenDialogsTypes";
import type { CapsuleLike } from "../screens/mainScreen/MainScreenTypes";

type SearchItems<T extends CapsuleLike = CapsuleLike> = (
  query: string,
) => Promise<T[]> | T[];

export function useSidebarCapsuleSearch<T extends CapsuleLike = CapsuleLike>(
  onSearchCapsules: SearchItems<T>,
) {
  const [state, setState] = useState<SearchState>({
    open: false,
    query: "",
    results: [],
    loading: false,
    onSelectComplete: null,
  });
  const open = useCallback((onSelectComplete?: () => void) => {
    setState((current) => ({
      ...current,
      open: true,
      onSelectComplete: onSelectComplete || null,
    }));
  }, []);

  useEffect(() => {
    if (!state.open) return undefined;

    let current = true;
    setState((currentState) => ({ ...currentState, loading: true }));
    Promise.resolve(onSearchCapsules(state.query))
      .then((results) => {
        if (current) {
          setState((currentState) => ({ ...currentState, results }));
        }
      })
      .finally(() => {
        if (current) {
          setState((currentState) => ({ ...currentState, loading: false }));
        }
      });

    return () => {
      current = false;
    };
  }, [onSearchCapsules, state.open, state.query]);

  return { open, setState, state };
}
