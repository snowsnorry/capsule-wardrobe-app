import { describe, expect, test, vi } from "vitest";
import { installVitePreloadErrorReload } from "./vitePreloadErrorReload";

function createWindowDouble() {
  const listeners = new Map<string, EventListener>();
  const storage = new Map<string, string>();

  return {
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners.set(type, listener);
    }),
    dispatch(type: string, event: Event) {
      listeners.get(type)?.(event);
    },
    location: {
      reload: vi.fn(),
    },
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      if (listeners.get(type) === listener) {
        listeners.delete(type);
      }
    }),
    sessionStorage: {
      getItem: vi.fn((key: string) => storage.get(key) || null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
    },
  };
}

describe("installVitePreloadErrorReload", () => {
  test("reloads the page and prevents the preload error from being thrown", () => {
    const windowObj = createWindowDouble();
    const dispose = installVitePreloadErrorReload({
      now: () => 1_000_000,
      windowObj,
    });
    const event = new Event("vite:preloadError", { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    windowObj.dispatch("vite:preloadError", event);

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect(windowObj.sessionStorage.setItem).toHaveBeenCalledWith(
      "capsule.vitePreloadErrorReloadAt",
      "1000000",
    );
    expect(windowObj.location.reload).toHaveBeenCalledTimes(1);

    dispose();
    expect(windowObj.removeEventListener).toHaveBeenCalledWith(
      "vite:preloadError",
      expect.any(Function),
    );
  });

  test("does not reload repeatedly inside the throttle window", () => {
    const windowObj = createWindowDouble();
    let currentTime = 1_000_000;

    installVitePreloadErrorReload({
      now: () => currentTime,
      throttleMs: 30_000,
      windowObj,
    });

    windowObj.dispatch(
      "vite:preloadError",
      new Event("vite:preloadError", { cancelable: true }),
    );
    currentTime += 5_000;
    windowObj.dispatch(
      "vite:preloadError",
      new Event("vite:preloadError", { cancelable: true }),
    );

    expect(windowObj.location.reload).toHaveBeenCalledTimes(1);
  });
});
