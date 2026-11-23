import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/api/telegram(.*)",
  "/api/cron(.*)", // dilindungi CRON_SECRET di dalam route
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

