import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
} from "@tanstack/react-router";
import * as React from "react";
import { createServerFn } from "@tanstack/react-start";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { Toaster } from "sonner";
import appCss from "@/styles/app.css?url";
import { authClient } from "@/lib/auth-client";
import { getToken } from "@/lib/auth-server";
import type { RouterContext } from "@/router";
import { getLocale } from "@/paraglide/runtime.js";
import { m } from "@/paraglide/messages.js";
import { Agentation } from "agentation";

// Server function to get auth token for SSR
const getAuth = createServerFn({ method: "GET" }).handler(async () => {
  return await getToken();
});

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: `${m.common_brandName()} - ${m.landing_subtitle()}`,
      },
      {
        name: "description",
        content: m.landing_subtitle(),
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/favicon.svg",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "96x96",
        href: "/favicon-96x96.png",
      },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  beforeLoad: async (ctx) => {
    const token = await getAuth();

    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
    }

    return { isAuthenticated: !!token, token };
  },
  notFoundComponent: () => <div>{m.common_routeNotFound()}</div>,
  component: RootComponent,
});

function RootComponent() {
  const context = useRouteContext({ from: Route.id });

  return (
    <ConvexBetterAuthProvider
      client={context.convexQueryClient.convexClient}
      authClient={authClient}
      initialToken={context.token}
    >
      <RootDocument>
        <Outlet />
      </RootDocument>
    </ConvexBetterAuthProvider>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()} className="overscroll-none">
      {process.env.NODE_ENV === "development" && <Agentation />}

      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {/* Story 9.5: Toast notifications for folder actions */}
        <Toaster position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
