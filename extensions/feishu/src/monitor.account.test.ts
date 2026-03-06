import { describe, expect, it } from "vitest";
import { resolveFeishuChatQueueKey } from "./monitor.account.js";

describe("resolveFeishuChatQueueKey", () => {
  it("keeps normal messages on the per-chat queue", () => {
    const key = resolveFeishuChatQueueKey({
      chatId: "oc_chat",
      text: "hello there",
      hasControlCommand: () => false,
    });

    expect(key).toBe("oc_chat");
  });

  it("routes control commands to a dedicated control queue", () => {
    const key = resolveFeishuChatQueueKey({
      chatId: "oc_chat",
      text: "/stop",
      hasControlCommand: () => true,
    });

    expect(key).toBe("oc_chat:control");
  });

  it("keeps topic control commands scoped to the topic", () => {
    const key = resolveFeishuChatQueueKey({
      chatId: "oc_chat",
      rootId: "om_root",
      text: "/status",
      hasControlCommand: () => true,
    });

    expect(key).toBe("oc_chat:control:thread:om_root");
  });
});
