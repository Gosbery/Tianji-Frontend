import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireAppAccess } from "@/lib/server-auth";

const ACCESS_KEY = "test-access-key-with-at-least-32-characters";
const basic = (value: string) => `Basic ${Buffer.from(value).toString("base64")}`;

beforeEach(() => {
  vi.stubEnv("APP_ACCESS_KEY", ACCESS_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("workspace access", () => {
  it.each([undefined, "", "short", " ".repeat(40), " ".repeat(20) + "short", "\u{1F512}".repeat(16)])(
    "fails closed when the access key is not configured securely: %j",
    async (value) => {
      vi.stubEnv("APP_ACCESS_KEY", value);
      const response = requireAppAccess(new Request("http://localhost/"));
      expect(response?.status).toBe(503);
      expect(response?.headers.get("cache-control")).toBe("no-store");
      await expect(response?.json()).resolves.toMatchObject({ code: "access_not_configured" });
    },
  );

  it.each<Record<string, string>>([
    {},
    { "X-Bazi-Access-Key": "incorrect" },
    { Authorization: "Bearer unrelated-token" },
    { Authorization: basic(`someone:${ACCESS_KEY}`) },
    { Authorization: basic("bazi:incorrect") },
    { Authorization: "Basic !!!" },
    { Authorization: "Basic a===" },
    { Authorization: "Basic YQ" },
    { Authorization: "Basic YR==" },
    { Authorization: basic(`bazi:${ACCESS_KEY}`) + ", Basic invalid" },
  ])("rejects absent, incorrect, or malformed credentials: %j", async (headers) => {
    const response = requireAppAccess(new Request("http://localhost/", { headers }));
    expect(response?.status).toBe(401);
    expect(response?.headers.get("www-authenticate")).toBe('Basic realm="BaZi", charset="UTF-8"');
    expect(response?.headers.get("cache-control")).toBe("no-store");
    expect(await response?.text()).not.toContain(ACCESS_KEY);
  });

  it.each<Record<string, string>>([
    { "X-Bazi-Access-Key": ACCESS_KEY },
    { Authorization: basic(`bazi:${ACCESS_KEY}`) },
    { Authorization: basic(`bazi:${ACCESS_KEY}`).replace("Basic", "basic") },
    { "X-Bazi-Access-Key": ACCESS_KEY, Authorization: "Bearer observability-token" },
  ])("accepts authorized credentials: %j", (headers) => {
    expect(requireAppAccess(new Request("http://localhost/", { headers }))).toBeNull();
  });

  it.each(["", "incorrect"])("does not replace an explicit invalid key with Basic credentials", (key) => {
    const headers = new Headers({
      "X-Bazi-Access-Key": key,
      Authorization: basic(`bazi:${ACCESS_KEY}`),
    });
    expect(requireAppAccess(new Request("http://localhost/", { headers }))?.status).toBe(401);
  });

  it.each<Record<string, string>>([
    { Origin: "https://untrusted.example" },
    { Origin: "null" },
    { Origin: "not a valid origin" },
    { "Sec-Fetch-Site": "cross-site" },
    { Origin: "http://localhost", "Sec-Fetch-Site": "cross-site" },
  ])("rejects authenticated cross-site changes: %j", async (headers) => {
    const response = requireAppAccess(new Request("http://localhost/api/v1/tasks", {
      method: "POST",
      headers: { ...headers, Authorization: basic(`bazi:${ACCESS_KEY}`) },
    }));
    expect(response?.status).toBe(403);
    expect(response?.headers.get("cache-control")).toBe("no-store");
    await expect(response?.json()).resolves.toMatchObject({ code: "cross_origin_forbidden" });
  });

  it.each<Record<string, string>>([
    {},
    { Origin: "http://localhost", "Sec-Fetch-Site": "same-origin" },
  ])("accepts authenticated same-origin changes and command-line clients: %j", (headers) => {
    const request = new Request("http://localhost/api/v1/tasks", {
      method: "POST",
      headers: { ...headers, Authorization: basic(`bazi:${ACCESS_KEY}`) },
    });
    expect(requireAppAccess(request)).toBeNull();
  });

  it.each(["untrusted.example@127.0.0.1:3000", "127.0.0.1:3000/path", "[invalid"])(
    "rejects malformed request authority during Origin validation: %s",
    (host) => {
      const response = requireAppAccess(new Request("http://localhost:3000/api/v1/tasks", {
        method: "POST",
        headers: {
          Host: host,
          Origin: "http://127.0.0.1:3000",
          "X-Bazi-Access-Key": ACCESS_KEY,
        },
      }));
      expect(response?.status).toBe(403);
    },
  );
});
