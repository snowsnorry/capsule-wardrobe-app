const personalItemsChangedEvent = "cw-personal-items-changed";

export function notifyPersonalItemsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(personalItemsChangedEvent));
}

export function addPersonalItemsChangedListener(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener(personalItemsChangedEvent, listener);
  return () => window.removeEventListener(personalItemsChangedEvent, listener);
}
