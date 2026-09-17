import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest): Response {
  return NextResponse.next({
    headers: { "Cache-Control": "private, no-store" },
  });
}

export const config = {
  matcher: ["/((?!_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico$).*)"],
};
