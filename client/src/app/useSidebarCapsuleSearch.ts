import { useCallback, useEffect, useState } from "react";
import type { SearchState } from "../screens/mainScreen/MainScreenDialogsTypes";
import type { CapsuleMeta } from "./appTypes";

type SearchCapsules = (query: string) => Promise<CapsuleMeta[]> | CapsuleMeta[];

export function useSidebarCapsuleSearch(onSearchCapsules: SearchCapsules) {
  const [state, setState] = useState<SearchState>({
    open: false,
    query: "",
    results: [],
    loading: false,
  });
  const open = useCallback(() => {
    setState((current) => ({ ...current, open: true }));
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
