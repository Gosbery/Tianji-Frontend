import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { unstable_doesMiddlewareMatch as doesProxyMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";

const ACCESS_KEY = "test-access-key-with-at-least-32-characters";

beforeEach(() => {
  vi.stubEnv("APP_ACCESS_KEY", ACCESS_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("workspace request protection", () => {
  it.each([
    "/",
    "/api/v1/tasks",
    "/api/v1/tasks/events",
    "/api/v1/conversations/session-id",
    "/api/v1/observability/traces",
    "/api/v1/tasks/file.png",
    "/_next/static-private",
    "/_next/image-private",
    "/favicon.ico/private",
  ])("protects %s", (url) => {
    expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(true);
    expect(proxy(new NextRequest(`http://localhost${url}`)).status).toBe(401);
  });

  it.each([
    "/_next/static/chunks/app.js",
    "/_next/static/chunks/app.css",
    "/_next/image?url=%2Fimage.png&w=640&q=75",
    "/favicon.ico",
  ])("allows static assets without access credentials: %s", (url) => {
    expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(false);
  });

  it("allows a browser Basic login without exposing credentials in response headers", () => {
    const authorization = `Basic ${Buffer.from(`bazi:${ACCESS_KEY}`).toString("base64")}`;
    const response = proxy(new NextRequest("http://localhost/", {
      headers: { Authorization: authorization },
    }));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect([...response.headers.values()].join(" ")).not.toContain(ACCESS_KEY);
    expect([...response.headers.values()].join(" ")).not.toContain(authorization);
  });

  it("fails closed on pages and event streams when access is unconfigured", () => {
    vi.stubEnv("APP_ACCESS_KEY", "");
    for (const path of ["/", "/api/v1/tasks/events"]) {
      expect(proxy(new NextRequest(`http://localhost${path}`)).status).toBe(503);
    }
  });

  it("accepts the browser's request Host when Next uses an internal listen hostname", () => {
    const response = proxy(new NextRequest("http://localhost:3000/api/v1/chart", {
      method: "POST",
      headers: {
        Host: "127.0.0.1:3000",
        Origin: "http://127.0.0.1:3000",
        "Sec-Fetch-Site": "same-origin",
        "X-Bazi-Access-Key": ACCESS_KEY,
      },
    }));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("does not trust a forwarded hostname to authorize a cross-origin request", () => {
    const response = proxy(new NextRequest("http://localhost:3000/api/v1/chart", {
      method: "POST",
      headers: {
        Host: "127.0.0.1:3000",
        Origin: "https://untrusted.example",
        "X-Forwarded-Host": "untrusted.example",
        "X-Bazi-Access-Key": ACCESS_KEY,
      },
    }));
    expect(response.status).toBe(403);
  });
});
