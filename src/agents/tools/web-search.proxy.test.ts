import { afterEach, describe, expect, it, vi } from "vitest";

const { ProxyAgent, undiciFetch, proxyAgentSpy, getLastAgent } = vi.hoisted(() => {
  const undiciFetch = vi.fn();
  const proxyAgentSpy = vi.fn();

  class ProxyAgent {
    static lastCreated: ProxyAgent | undefined;
    proxyUrl: string;

    constructor(proxyUrl: string) {
      if (proxyUrl === "bad-proxy") {
        throw new Error("bad proxy");
      }
      this.proxyUrl = proxyUrl;
      ProxyAgent.lastCreated = this;
      proxyAgentSpy(proxyUrl);
    }
  }

  return {
    ProxyAgent,
    undiciFetch,
    proxyAgentSpy,
    getLastAgent: () => ProxyAgent.lastCreated,
  };
});

vi.mock("undici", () => ({
  ProxyAgent,
  fetch: undiciFetch,
}));

import { withFetchPreconnect } from "../../test-utils/fetch-mock.js";
import { createWebSearchTool } from "./web-tools.js";

function okBraveResponse(): Response {
  return {
    ok: true,
    json: async () => ({ web: { results: [] } }),
  } as Response;
}

describe("web_search brave proxy", () => {
  const priorFetch = global.fetch;

  afterEach(() => {
    global.fetch = priorFetch;
    proxyAgentSpy.mockReset();
    undiciFetch.mockReset();
  });

  it("uses undici ProxyAgent when tools.web.search.proxy is set", async () => {
    undiciFetch.mockResolvedValue(okBraveResponse());
    const globalFetch = vi.fn(async () => okBraveResponse());
    global.fetch = withFetchPreconnect(globalFetch);

    const tool = createWebSearchTool({
      config: {
        tools: {
          web: {
            search: {
              provider: "brave",
              apiKey: "brave-key",
              proxy: "http://proxy.test:8080",
            },
          },
        },
      },
      sandboxed: true,
    });

    await tool?.execute?.("call-1", { query: "openclaw-fallback" });

    expect(proxyAgentSpy).toHaveBeenCalledWith("http://proxy.test:8080");
    expect(undiciFetch).toHaveBeenCalledOnce();
    expect(undiciFetch.mock.calls[0]?.[0]).toContain("api.search.brave.com");
    expect(undiciFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        dispatcher: getLastAgent(),
        method: "GET",
      }),
    );
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it("falls back to global fetch when proxy URL is invalid", async () => {
    undiciFetch.mockResolvedValue(okBraveResponse());
    const globalFetch = vi.fn(async () => okBraveResponse());
    global.fetch = withFetchPreconnect(globalFetch);

    const tool = createWebSearchTool({
      config: {
        tools: {
          web: {
            search: {
              provider: "brave",
              apiKey: "brave-key",
              proxy: "bad-proxy",
            },
          },
        },
      },
      sandboxed: true,
    });

    await tool?.execute?.("call-1", { query: "openclaw" });

    expect(undiciFetch).not.toHaveBeenCalled();
    expect(globalFetch).toHaveBeenCalledOnce();
  });
});
