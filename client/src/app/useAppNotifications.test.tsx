import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAppNotifications } from "./useAppNotifications";

const notificationApi = {
  created: vi.fn(),
  permission: "default",
  requestPermission: vi.fn()
};

function installNotificationMock() {
  function MockNotification(title: string, options?: NotificationOptions) {
    notificationApi.created(title, options);
  }

  Object.defineProperty(MockNotification, "permission", {
    configurable: true,
    get() {
      return notificationApi.permission;
    }
  });
  MockNotification.requestPermission = notificationApi.requestPermission;
  window.Notification = MockNotification as unknown as typeof Notification;
}

function Harness({ llm = "openai:gpt-5.5" }: { llm?: string }) {
  const notifications = useAppNotifications((key) => ({
    "notifications.ready.fullBody": "Your new capsule is ready to review. Open the app to see the result.",
    "notifications.ready.imageBody": "Your outfit image is ready. Open the app to see the result.",
    "notifications.ready.partialBody": "Your updated selection is ready. Open the app to see the result.",
    "notifications.ready.title": "Your capsule is ready"
  }[key] || key), llm);

  return (
    <div>
      <div data-testid="prompt-open">{String(notifications.notificationPrompt.open)}</div>
      <button type="button" onClick={() => notifications.openPendingNotificationPrompt()}>
        open-prompt
      </button>
      <button type="button" onClick={() => notifications.requestBrowserNotificationPermission()}>
        request-permission
      </button>
      <button type="button" onClick={() => notifications.sendReadyNotification("partial")}>
        send-partial
      </button>
    </div>
  );
}

describe("useAppNotifications", () => {
  beforeEach(() => {
    notificationApi.created.mockReset();
    notificationApi.permission = "default";
    notificationApi.requestPermission.mockReset();
    installNotificationMock();
  });

  afterEach(() => {
    cleanup();
  });

  test("shows the pending notification prompt only when LLM is enabled and permission is default", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "open-prompt" }));

    expect(screen.getByTestId("prompt-open")).toHaveTextContent("true");
  });

  test.each(["none", "openai:gpt-5.5"])("does not show prompt when llm/permission combination is blocked: %s", (llm) => {
    if (llm !== "none") {
      notificationApi.permission = "denied";
    }
    render(<Harness llm={llm} />);

    fireEvent.click(screen.getByRole("button", { name: "open-prompt" }));

    expect(screen.getByTestId("prompt-open")).toHaveTextContent("false");
  });

  test("requests permission and closes prompt when browser leaves default state", async () => {
    notificationApi.requestPermission.mockImplementation(async () => {
      notificationApi.permission = "granted";
      return "granted";
    });
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "open-prompt" }));
    fireEvent.click(screen.getByRole("button", { name: "request-permission" }));

    await waitFor(() => {
      expect(notificationApi.requestPermission).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId("prompt-open")).toHaveTextContent("false");
  });

  test("sends ready notification body for partial generation when permission is granted", () => {
    notificationApi.permission = "granted";
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "send-partial" }));

    expect(notificationApi.created).toHaveBeenCalledWith("Your capsule is ready", {
      body: "Your updated selection is ready. Open the app to see the result."
    });
  });
});
