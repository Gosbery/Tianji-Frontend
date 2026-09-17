import { describe, expect, it } from "vitest";
import { unstable_doesMiddlewareMatch as doesProxyMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";

// 访问控制中间件已按用户决定移除：proxy.ts 现在只做 no-store 响应头与静态资源放行，
// 因此这里断言的是「哪些路径进中间件」和「进了之后设置什么头」，
// 不再断言 401/503/403 之类已被移除的凭证校验。
describe("workspace request pass-through", () => {
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
  ])("runs the proxy for %s", (url) => {
    expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(true);
    const response = proxy(new NextRequest(`http://localhost${url}`));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it.each([
    "/_next/static/chunks/app.js",
    "/_next/static/chunks/app.css",
    "/_next/image?url=%2Fimage.png&w=640&q=75",
    "/favicon.ico",
  ])("skips the proxy for static assets: %s", (url) => {
    expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(false);
  });

  it("passes any request through without inspecting or echoing credentials", () => {
    const authorization = `Basic ${Buffer.from("bazi:workspace-secret").toString("base64")}`;
    const response = proxy(
      new NextRequest("http://localhost/", {
        headers: {
          Authorization: authorization,
          "X-Bazi-Access-Key": "workspace-secret",
          Origin: "https://untrusted.example",
          "Sec-Fetch-Site": "cross-site",
        },
      }),
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const headers = [...response.headers.values()].join(" ");
    expect(headers).not.toContain(authorization);
    expect(headers).not.toContain("workspace-secret");
  });
});
