import { createRouter } from "@tanstack/react-router"
import { QueryClient } from "@tanstack/react-query"
import { routerWithQueryClient } from "@tanstack/react-router-with-query"
import { ConvexQueryClient } from "@convex-dev/react-query"
import { routeTree } from "./routeTree.gen"
import { RouterErrorComponent } from "./components/ErrorFallback"

// Define the router context type for type safety across routes
export interface RouterContext {
  queryClient: QueryClient
  convexQueryClient: ConvexQueryClient
  isAuthenticated: boolean
  token: string | null
}

export function getRouter() {
  const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL!
  if (!CONVEX_URL) {
    console.error("missing envar VITE_CONVEX_URL")
  }

  // Initialize Convex query client with auth expectation for SSR
  const convexQueryClient = new ConvexQueryClient(CONVEX_URL, {
    expectAuth: true,
  })

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        gcTime: 5000,
      },
    },
  })
  convexQueryClient.connect(queryClient)

  const router = routerWithQueryClient(
    createRouter({
      routeTree,
      defaultPreload: "intent",
      context: {
        queryClient,
        convexQueryClient,
        isAuthenticated: false,
        token: null,
      } satisfies RouterContext,
      scrollRestoration: true,
      defaultPreloadStaleTime: 0, // Let React Query handle all caching
      defaultErrorComponent: RouterErrorComponent,
      defaultNotFoundComponent: () => (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              404
            </h1>
            <p className="text-gray-600 dark:text-gray-400">Page not found</p>
          </div>
        </div>
      ),
    }),
    queryClient,
  )

  return router
}
