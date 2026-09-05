import { isIP } from "node:net";

const BACKEND_API_BASE = (process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);

const INTERNAL_CLIENT_IP_HEADER = "x-bazi-client-ip";
const INTERNAL_PROXY_SECRET_HEADER = "x-bazi-proxy-secret";

const REQUEST_HEADERS = [
  "accept",
  "authorization",
  "content-type",
  "x-api-key",
  "x-request-id",
] as const;

const RESPONSE_HEADERS = [
  "cache-control",
  "content-type",
  "deprecation",
  "etag",
  "link",
  "retry-after",
  "sunset",
  "www-authenticate",
  "x-request-id",
] as const;

type ProxyContext = {
  params: Promise<{ path: string[] }>;
};

function selectedHeaders(source: Headers, names: readonly string[]): Headers {
  const result = new Headers();
  for (const name of names) {
    const value = source.get(name);
    if (value !== null) result.set(name, value);
  }
  return result;
}

function attachTrustedClientIdentity(source: Headers, destination: Headers): void {
  const secret = process.env.INTERNAL_PROXY_SECRET;
  const sourceHeader = process.env.TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase();
  if (!secret || !sourceHeader || !/^[a-z0-9-]+$/.test(sourceHeader)) return;
  if (sourceHeader === INTERNAL_CLIENT_IP_HEADER || sourceHeader === INTERNAL_PROXY_SECRET_HEADER) {
    return;
  }

  // The configured ingress must overwrite this header. A comma-separated proxy
  // chain is intentionally rejected because the route cannot establish which hop is trusted.
  const clientIp = source.get(sourceHeader)?.trim();
  if (!clientIp || clientIp.includes(",") || isIP(clientIp) === 0) return;

  destination.set(INTERNAL_CLIENT_IP_HEADER, clientIp);
  destination.set(INTERNAL_PROXY_SECRET_HEADER, secret);
}

export async function proxyRequest(request: Request, context: ProxyContext): Promise<Response> {
  const { path } = await context.params;
  const upstreamUrl = new URL(
    `/api/${path.map((segment) => encodeURIComponent(segment)).join("/")}`,
    BACKEND_API_BASE,
  );
  upstreamUrl.search = new URL(request.url).search;

  const body = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : await request.arrayBuffer();

  try {
    const headers = selectedHeaders(request.headers, REQUEST_HEADERS);
    attachTrustedClientIdentity(request.headers, headers);
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
      signal: request.signal,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: selectedHeaders(upstream.headers, RESPONSE_HEADERS),
    });
  } catch (reason) {
    console.error("Backend proxy request failed", reason);
    return Response.json(
      { detail: "无法连接本地后端服务，请确认 API 已启动" },
      { status: 502 },
    );
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export { proxyRequest as GET, proxyRequest as HEAD, proxyRequest as PATCH, proxyRequest as POST };
