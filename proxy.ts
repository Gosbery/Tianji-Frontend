import { NextResponse, type NextRequest } from "next/server";
import { requireAppAccess } from "@/lib/server-auth";

export function proxy(request: NextRequest): Response {
  return requireAppAccess(request) ?? NextResponse.next({
    headers: { "Cache-Control": "private, no-store" },
  });
}

export const config = {
  matcher: ["/((?!_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico$).*)"],
};
