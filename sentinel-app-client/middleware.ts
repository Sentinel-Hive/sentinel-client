// import { NextResponse, type NextRequest } from "next/server";

// const COOKIE_NAME = "svh.sid";
// const PUBLIC = new Set(["/login", "/signup", "/forgot-password"]);

// export function middleware(req: NextRequest) {
//   const { pathname, search } = req.nextUrl;

//   if (
//     pathname.startsWith("/_next/") ||
//     pathname.startsWith("/api/") ||
//     pathname === "/favicon.ico" ||
//     pathname.startsWith("/icons/") ||
//     pathname.startsWith("/images/") ||
//     pathname.startsWith("/fonts/")
//   ) {
//     return NextResponse.next();
//   }

//   if (PUBLIC.has(pathname)) return NextResponse.next();

//   const hasSession = Boolean(req.cookies.get(COOKIE_NAME)?.value);
//   if (!hasSession) {
//     const loginUrl = new URL("/login", req.url);
//     if (pathname !== "/") loginUrl.searchParams.set("next", pathname + search);
//     return NextResponse.redirect(loginUrl);
//   }

//   return NextResponse.next();
// }

// export const config = {
//   matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
// };
