import {
  useAppRefs,
  useCapsuleAppState,
  useProfileFilterAppState,
  useSessionAppState,
  useWardrobeProgressAppState,
} from "./useAppStateSections";

export function useAppState() {
  const sessionState = useSessionAppState();
  const profileFilterState = useProfileFilterAppState();
  const capsuleState = useCapsuleAppState();
  const wardrobeProgressState = useWardrobeProgressAppState();
  const refs = useAppRefs();

  return {
    ...sessionState,
    ...profileFilterState,
    ...capsuleState,
    ...wardrobeProgressState,
    ...refs,
  };
}
