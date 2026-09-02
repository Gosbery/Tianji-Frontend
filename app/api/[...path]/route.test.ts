import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/[...path]/route";

const context = {
  params: Promise.resolve({ path: ["v1", "chart"] }),
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("backend API proxy", () => {
  it("returns an actionable structured error when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(new Request("http://localhost/api/v1/chart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }), context);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      detail: "无法连接本地后端服务，请确认 API 已启动",
    });
  });

  it("forwards the request body, query, authentication, status, and trace header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ day_master: "庚" }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": "request-123",
        },
      },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost/api/v1/chart?preview=1", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-token",
        "Content-Type": "application/json",
        "X-Unrelated": "do-not-forward",
      },
      body: "{\"date\":\"1990-01-01\"}",
    }), context);

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const headers = new Headers(init.headers);
    expect(url.toString()).toBe("http://127.0.0.1:8000/api/v1/chart?preview=1");
    expect(headers.get("authorization")).toBe("Bearer test-token");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.has("x-unrelated")).toBe(false);
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe(
      "{\"date\":\"1990-01-01\"}",
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("x-request-id")).toBe("request-123");
    await expect(response.json()).resolves.toEqual({ day_master: "庚" });
  });

  it("replaces forged internal identity headers with a trusted ingress address", async () => {
    vi.stubEnv("INTERNAL_PROXY_SECRET", "shared-proxy-secret");
    vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", "cf-connecting-ip");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await POST(new Request("http://localhost/api/v1/feedback", {
      method: "POST",
      headers: {
        "CF-Connecting-IP": "2001:db8::9",
        "X-Bazi-Client-IP": "198.51.100.200",
        "X-Bazi-Proxy-Secret": "forged",
      },
      body: "{}",
    }), {
      params: Promise.resolve({ path: ["v1", "feedback"] }),
    });

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("x-bazi-client-ip")).toBe("2001:db8::9");
    expect(headers.get("x-bazi-proxy-secret")).toBe("shared-proxy-secret");
    expect(headers.has("cf-connecting-ip")).toBe(false);
  });

  it("does not sign spoofable or ambiguous client address headers", async () => {
    vi.stubEnv("INTERNAL_PROXY_SECRET", "shared-proxy-secret");
    vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", "x-forwarded-for");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await POST(new Request("http://localhost/api/v1/feedback", {
      method: "POST",
      headers: {
        "X-Forwarded-For": "198.51.100.7, 10.0.0.4",
        "X-Bazi-Client-IP": "198.51.100.200",
        "X-Bazi-Proxy-Secret": "forged",
      },
      body: "{}",
    }), {
      params: Promise.resolve({ path: ["v1", "feedback"] }),
    });

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.has("x-bazi-client-ip")).toBe(false);
    expect(headers.has("x-bazi-proxy-secret")).toBe(false);
  });
});
