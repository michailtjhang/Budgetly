import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/api/telegram(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) {
    return;
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|.*\\..*).*)",
    // Protect API routes
    "/(api|trpc)(.*)",
  ],
};

