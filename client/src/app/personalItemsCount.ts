import { useEffect, useState } from "react";
import { fetchMyWardrobeItems } from "../api/myWardrobe";

const personalItemsChangedEvent = "cw-personal-items-changed";

function getPersonalItemsCountFromResponse(response: unknown) {
  const items = (response as { items?: unknown }).items;
  return Array.isArray(items) ? items.length : null;
}

function fetchPersonalItemsCount(force: boolean) {
  return force ? fetchMyWardrobeItems({ force: true }) : fetchMyWardrobeItems();
}

export function notifyPersonalItemsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(personalItemsChangedEvent));
}

export function usePersonalItemsCount(userEmail: string) {
  const [personalItemsCount, setPersonalItemsCount] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (!userEmail) {
      setPersonalItemsCount(null);
      return;
    }

    let isActive = true;
    const loadCount = (force = false) => {
      void fetchPersonalItemsCount(force)
        .then((response) => {
          if (isActive) {
            setPersonalItemsCount(getPersonalItemsCountFromResponse(response));
          }
        })
        .catch(() => {
          if (isActive) {
            setPersonalItemsCount(null);
          }
        });
    };
    const handlePersonalItemsChanged = () => loadCount(true);

    loadCount();
    window.addEventListener(
      personalItemsChangedEvent,
      handlePersonalItemsChanged,
    );

    return () => {
      isActive = false;
      window.removeEventListener(
        personalItemsChangedEvent,
        handlePersonalItemsChanged,
      );
    };
  }, [userEmail]);

  return personalItemsCount;
}
