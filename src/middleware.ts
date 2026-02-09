import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#4a4a4a" rx="4"/></svg>';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/favicon.ico") {
    return new NextResponse(FAVICON_SVG, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }
  return NextResponse.next();
}
