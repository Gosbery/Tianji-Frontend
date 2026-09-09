import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/[...path]/route";

const ACCESS_KEY = "test-access-key-with-at-least-32-characters";

const context = {
  params: Promise.resolve({ path: ["v1", "chart"] }),
};

beforeEach(() => {
  vi.stubEnv("APP_ACCESS_KEY", ACCESS_KEY);
});

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
      headers: { "Content-Type": "application/json", "X-Bazi-Access-Key": ACCESS_KEY },
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
          "Cache-Control": "public, max-age=600",
          "X-Request-ID": "request-123",
        },
      },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost/api/v1/chart?preview=1", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-token",
        "X-Bazi-Access-Key": ACCESS_KEY,
        "Content-Type": "application/json",
        "X-Unrelated": "do-not-forward",
      },
      body: "{\"date\":\"1990-01-01\"}",
    }), context);

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const headers = new Headers(init.headers);
    expect(url.toString()).toBe("http://127.0.0.1:8000/api/v1/chart?preview=1");
    expect(headers.get("authorization")).toBe("Bearer test-token");
    expect(headers.get("x-bazi-access-key")).toBe(ACCESS_KEY);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.has("x-unrelated")).toBe(false);
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe(
      "{\"date\":\"1990-01-01\"}",
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
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
        "X-Bazi-Access-Key": ACCESS_KEY,
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
        "X-Bazi-Access-Key": ACCESS_KEY,
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

  it("rejects an unauthorized request before reading its body or contacting the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("http://localhost/api/v1/chart", { method: "POST", body: "{}" });
    const readBody = vi.spyOn(request, "arrayBuffer");

    const response = await POST(request, context);

    expect(response.status).toBe(401);
    expect(readBody).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([undefined, "incorrect"])("protects event streams independently of the page proxy: %j", async (key) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const headers = new Headers({ Accept: "text/event-stream" });
    if (key !== undefined) headers.set("X-Bazi-Access-Key", key);
    const response = await GET(new Request("http://localhost/api/v1/tasks/events", { headers }), {
      params: Promise.resolve({ path: ["v1", "tasks", "events"] }),
    });
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards authenticated event streams with browser Basic credentials", async () => {
    const authorization = `Basic ${Buffer.from(`bazi:${ACCESS_KEY}`).toString("base64")}`;
    const frame = 'event: ready\ndata: {"type":"ready"}\n\n';
    const fetchMock = vi.fn().mockResolvedValue(new Response(frame, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("http://localhost/api/v1/tasks/events", {
      headers: { Accept: "text/event-stream", Authorization: authorization },
    }), { params: Promise.resolve({ path: ["v1", "tasks", "events"] }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("private, no-store, no-transform");
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("authorization")).toBe(authorization);
    await expect(response.text()).resolves.toBe(frame);
  });

  it("fails closed before forwarding when the access key is missing", async () => {
    vi.stubEnv("APP_ACCESS_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(new Request("http://localhost/api/v1/chart", {
      method: "POST",
      headers: { "X-Bazi-Access-Key": ACCESS_KEY },
      body: "{}",
    }), context);
    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["v1", "tasks", "task-id", "archive"],
    ["v1", "tasks", "task-id", "jobs", "job-id", "cancel"],
  ])("rejects cross-site Basic-authenticated changes to %j", async (...path) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(new Request(`http://localhost/api/${path.join("/")}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`bazi:${ACCESS_KEY}`).toString("base64")}`,
        Origin: "https://untrusted.example",
        "Sec-Fetch-Site": "cross-site",
        "Content-Type": "text/plain",
      },
      body: "",
    }), { params: Promise.resolve({ path }) });
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards same-origin browser changes with Basic credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(new Request("http://localhost/api/v1/tasks/task-id/archive", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`bazi:${ACCESS_KEY}`).toString("base64")}`,
        Origin: "http://localhost",
        "Sec-Fetch-Site": "same-origin",
      },
    }), { params: Promise.resolve({ path: ["v1", "tasks", "task-id", "archive"] }) });
    expect(response.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
