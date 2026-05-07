import { createChannel, createSession } from "better-sse";

function createCapsuleEventKey(email, capsuleId) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const normalizedCapsuleId = String(capsuleId || "").trim();
  return normalizedCapsuleId
    ? `${normalizedEmail}::${normalizedCapsuleId}`
    : normalizedEmail;
}

function createCapsuleEventHub() {
  const channels = new Map();

  function getOrCreateChannel(key) {
    if (!channels.has(key)) {
      channels.set(key, createChannel());
    }
    return channels.get(key);
  }

  function pruneChannel(key, channel) {
    if (channels.get(key) === channel && channel.sessionCount === 0) {
      channels.delete(key);
    }
  }

  async function subscribe(req, res, { email, capsuleId, snapshot }) {
    const key = createCapsuleEventKey(email, capsuleId);
    const channel = getOrCreateChannel(key);
    const session = await createSession(req, res, {
      retry: 2000,
      keepAlive: 10000,
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });

    channel.register(session);
    session.once("disconnected", () => {
      setTimeout(() => {
        pruneChannel(key, channel);
      }, 0);
    });

    await session.push(snapshot, "snapshot");
    return session;
  }

  function publish(email, capsuleId, snapshot) {
    const key = createCapsuleEventKey(email, capsuleId);
    const channel = channels.get(key);
    if (!channel) {
      return false;
    }
    channel.broadcast(snapshot, "snapshot");
    pruneChannel(key, channel);
    return true;
  }

  function getSessionCount(email, capsuleId) {
    const channel = channels.get(createCapsuleEventKey(email, capsuleId));
    return channel?.sessionCount || 0;
  }

  return {
    getSessionCount,
    publish,
    subscribe,
  };
}

export { createCapsuleEventHub };
