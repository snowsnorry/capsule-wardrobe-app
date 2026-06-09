import { EventEmitter } from "node:events";
import { beforeEach, expect, test, vi } from "vitest";
import { createCapsuleEventHub } from "./capsuleEventHub.js";

const sessions: MockSession[] = [];
const channels: MockChannel[] = [];

class MockSession extends EventEmitter {
  pushed: Array<{ event: string; payload: unknown }> = [];

  async push(payload: unknown, event: string) {
    this.pushed.push({ event, payload });
  }
}

class MockChannel {
  sessions = new Set<MockSession>();
  broadcasts: Array<{ event: string; payload: unknown }> = [];

  get sessionCount() {
    return this.sessions.size;
  }

  register(session: MockSession) {
    this.sessions.add(session);
    session.once("disconnected", () => {
      this.sessions.delete(session);
    });
  }

  broadcast(payload: unknown, event: string) {
    this.broadcasts.push({ event, payload });
    for (const session of this.sessions) {
      void session.push(payload, event);
    }
  }
}

vi.mock("better-sse", () => ({
  createChannel: vi.fn(() => {
    const channel = new MockChannel();
    channels.push(channel);
    return channel;
  }),
  createSession: vi.fn(async () => {
    const session = new MockSession();
    sessions.push(session);
    return session;
  }),
}));

beforeEach(() => {
  sessions.length = 0;
  channels.length = 0;
});

test("capsule event hub normalizes keys and publishes snapshots to subscribers", async () => {
  const hub = createCapsuleEventHub();
  const initialSnapshot = { status: "pending" };
  const nextSnapshot = { status: "ready" };

  await hub.subscribe({} as never, {} as never, {
    email: " PERSON@Example.test ",
    capsuleId: " capsule-1 ",
    snapshot: initialSnapshot,
  });

  expect(hub.getSessionCount("person@example.test", "capsule-1")).toBe(1);
  expect(sessions[0].pushed).toEqual([
    { event: "snapshot", payload: initialSnapshot },
  ]);

  expect(hub.publish("person@example.test", "capsule-1", nextSnapshot)).toBe(
    true,
  );
  expect(channels[0].broadcasts).toEqual([
    { event: "snapshot", payload: nextSnapshot },
  ]);
  expect(sessions[0].pushed.at(-1)).toEqual({
    event: "snapshot",
    payload: nextSnapshot,
  });
});

test("capsule event hub returns false without subscribers and prunes disconnected channels", async () => {
  const hub = createCapsuleEventHub();

  expect(hub.publish("person@example.test", "missing", {})).toBe(false);

  await hub.subscribe({} as never, {} as never, {
    email: "person@example.test",
    capsuleId: "",
    snapshot: { status: "pending" },
  });
  expect(hub.getSessionCount(" person@example.test ", undefined)).toBe(1);

  sessions[0].emit("disconnected");
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(hub.getSessionCount("person@example.test", "")).toBe(0);
  expect(hub.publish("person@example.test", "", { status: "ready" })).toBe(
    false,
  );
});

test("capsule event hub builds lazy initial snapshots after registering sessions", async () => {
  const hub = createCapsuleEventHub();
  const readySnapshot = { status: "ready" };

  await hub.subscribe({} as never, {} as never, {
    email: "person@example.test",
    capsuleId: "capsule-1",
    snapshot: async () => {
      expect(hub.getSessionCount("person@example.test", "capsule-1")).toBe(1);
      expect(
        hub.publish("person@example.test", "capsule-1", readySnapshot),
      ).toBe(true);
      return readySnapshot;
    },
  });

  expect(channels[0].broadcasts).toEqual([
    { event: "snapshot", payload: readySnapshot },
  ]);
  expect(sessions[0].pushed).toEqual([
    { event: "snapshot", payload: readySnapshot },
    { event: "snapshot", payload: readySnapshot },
  ]);
});
