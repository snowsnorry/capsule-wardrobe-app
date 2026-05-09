const RELOAD_STORAGE_KEY = "capsule.vitePreloadErrorReloadAt";
const DEFAULT_RELOAD_THROTTLE_MS = 30_000;

type PreloadErrorReloadWindow = {
  addEventListener(type: "vite:preloadError", listener: EventListener): void;
  removeEventListener(type: "vite:preloadError", listener: EventListener): void;
  sessionStorage?: Pick<Storage, "getItem" | "setItem">;
  location: Pick<Location, "reload">;
};

type PreloadErrorReloadOptions = {
  now?: () => number;
  throttleMs?: number;
  windowObj?: PreloadErrorReloadWindow;
};

function readLastReloadAt(storage?: Pick<Storage, "getItem">) {
  try {
    return Number(storage?.getItem(RELOAD_STORAGE_KEY) || 0);
  } catch {
    return 0;
  }
}

function writeLastReloadAt(
  storage: Pick<Storage, "setItem"> | undefined,
  reloadAt: number,
) {
  try {
    storage?.setItem(RELOAD_STORAGE_KEY, String(reloadAt));
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function getSessionStorage(windowObj: PreloadErrorReloadWindow) {
  try {
    return windowObj.sessionStorage;
  } catch {
    return undefined;
  }
}

export function installVitePreloadErrorReload({
  now = Date.now,
  throttleMs = DEFAULT_RELOAD_THROTTLE_MS,
  windowObj = window,
}: PreloadErrorReloadOptions = {}) {
  const handlePreloadError = (event: Event) => {
    event.preventDefault();

    const reloadAt = now();
    const sessionStorage = getSessionStorage(windowObj);
    const lastReloadAt = readLastReloadAt(sessionStorage);

    if (lastReloadAt > 0 && reloadAt - lastReloadAt < throttleMs) {
      return;
    }

    writeLastReloadAt(sessionStorage, reloadAt);
    windowObj.location.reload();
  };

  windowObj.addEventListener("vite:preloadError", handlePreloadError);

  return () => {
    windowObj.removeEventListener("vite:preloadError", handlePreloadError);
  };
}
