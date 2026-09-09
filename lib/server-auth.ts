import { createHash, timingSafeEqual } from "node:crypto";

export const ACCESS_KEY_HEADER = "x-bazi-access-key";

function constantTimeEqual(actual: string | Buffer, expected: string): boolean {
  const actualHash = createHash("sha256").update(actual).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

function basicCredentials(authorization: string | null): Buffer | null {
  const match = authorization?.match(/^Basic[ \t]+([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) return null;
  const decoded = Buffer.from(match[1], "base64");
  // Buffer's decoder accepts malformed input, so require canonical Base64.
  return decoded.toString("base64") === match[1] ? decoded : null;
}

function requestOrigin(request: Pick<Request, "headers" | "url">): string | null {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (host === null) return url.origin;
  if (!host || /[\\/?#@,\s]/.test(host)) return null;
  try {
    // Next may build request.url from its listen hostname instead of the browser's Host.
    return new URL(`${url.protocol}//${host}`).origin;
  } catch {
    return null;
  }
}

export function requireAppAccess(request: Pick<Request, "headers" | "method" | "url">): Response | null {
  const expected = process.env.APP_ACCESS_KEY ?? "";
  if (Array.from(expected.trim()).length < 32) {
    return Response.json(
      {
        code: "access_not_configured",
        detail: "Workspace access is not configured. Set APP_ACCESS_KEY to at least 32 characters.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const accessKey = request.headers.get(ACCESS_KEY_HEADER);
  const credentials = basicCredentials(request.headers.get("authorization"));
  const authorized = accessKey !== null
    ? constantTimeEqual(accessKey, expected)
    : credentials !== null && constantTimeEqual(credentials, `bazi:${expected}`);
  if (authorized) {
    const origin = request.headers.get("origin");
    const crossSite = request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site";
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)
      && (crossSite || (origin !== null && origin !== requestOrigin(request)))) {
      return Response.json(
        { code: "cross_origin_forbidden", detail: "Cross-origin workspace changes are not allowed." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    return null;
  }

  return Response.json(
    { code: "unauthorized", detail: "Workspace authentication required." },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "WWW-Authenticate": 'Basic realm="BaZi", charset="UTF-8"',
      },
    },
  );
}
