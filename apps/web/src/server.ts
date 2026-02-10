import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";

const handler = createStartHandler(defaultStreamHandler);

const DASHBOARD_PREFIXES = [
  "/newsletters",
  "/settings",
  "/import",
  "/community",
  "/admin",
];

function isDashboardRoute(pathname: string): boolean {
  return DASHBOARD_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

function getCookieLocale(req: Request): string {
  const cookie = req.headers.get("cookie");
  const match = cookie
    ?.split("; ")
    .find((c) => c.startsWith("PARAGLIDE_LOCALE="));
  return match?.split("=")[1] || "en";
}

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/api/")) {
      return handler(req);
    }

    if (isDashboardRoute(url.pathname)) {
      // Dashboard routes: locale from cookie, no URL-based redirect
      const runtime = await import("@/paraglide/runtime.js");
      if (!runtime.serverAsyncLocalStorage) {
        const { AsyncLocalStorage } = await import("async_hooks");
        runtime.overwriteServerAsyncLocalStorage(new AsyncLocalStorage());
      }
      const locale = getCookieLocale(req);
      return runtime.serverAsyncLocalStorage!.run(
        { locale, origin: url.origin, messageCalls: new Set() },
        () => handler(req)
      );
    }

    // Public routes: full paraglide middleware (URL-based locale + redirects)
    const { paraglideMiddleware } = await import("@/paraglide/server.js");
    return paraglideMiddleware(req, () => handler(req));
  },
};
