import { beforeEach, describe, expect, it, vi } from "vitest";

const { withTrustedWebToolsEndpointMock } = vi.hoisted(() => ({
  withTrustedWebToolsEndpointMock: vi.fn(),
}));

vi.mock("./web-guarded-fetch.js", () => ({
  withTrustedWebToolsEndpoint: withTrustedWebToolsEndpointMock,
}));

import { createWebSearchTool } from "./web-search.js";

function okJsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("web_search proxy routing", () => {
  beforeEach(() => {
    withTrustedWebToolsEndpointMock.mockReset();
  });

  it("passes configured proxy to guarded fetch for Brave provider", async () => {
    withTrustedWebToolsEndpointMock.mockImplementation(async (params, run) =>
      run({
        response: okJsonResponse({ web: { results: [] } }),
        finalUrl: params.url,
      }),
    );

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

    await tool?.execute?.("call-1", { query: "openclaw" });

    const braveCall = withTrustedWebToolsEndpointMock.mock.calls.find(
      ([params]) => typeof params?.url === "string" && params.url.includes("api.search.brave.com"),
    );
    expect(braveCall).toBeDefined();
    expect(braveCall?.[0]).toMatchObject({ proxy: "http://proxy.test:8080" });
  });

  it("ignores invalid configured proxy URL and falls back to env proxy behavior", async () => {
    withTrustedWebToolsEndpointMock.mockImplementation(async (params, run) =>
      run({
        response: okJsonResponse({ web: { results: [] } }),
        finalUrl: params.url,
      }),
    );

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

    const braveCall = withTrustedWebToolsEndpointMock.mock.calls.find(
      ([params]) => typeof params?.url === "string" && params.url.includes("api.search.brave.com"),
    );
    expect(braveCall).toBeDefined();
    expect(braveCall?.[0]).toMatchObject({ proxy: undefined });
  });
});
