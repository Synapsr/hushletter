import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@newsletter-manager/backend"
import { DedicatedEmailDisplay } from "~/components/DedicatedEmailDisplay"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"

export const Route = createFileRoute("/_authed/newsletters/")({
  component: NewslettersPage,
})

// Type for getCurrentUser query response
// Note: convexQuery doesn't properly infer return types, so we define it explicitly
type CurrentUserData = {
  id: string
  email: string
  name: string | null
  dedicatedEmail: string | null
} | null

function NewslettersPage() {
  const { data, isPending } = useQuery(convexQuery(api.auth.getCurrentUser, {}))
  const user = data as CurrentUserData

  if (isPending) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    )
  }

  const dedicatedEmail = user?.dedicatedEmail

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Your Newsletters
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Welcome! Your newsletter inbox will appear here once you start receiving
        newsletters.
      </p>

      {/* Dedicated email display - prominent for new users */}
      {dedicatedEmail && (
        <div className="mb-8">
          <DedicatedEmailDisplay email={dedicatedEmail} />
        </div>
      )}

      {/* Empty state for new users */}
      <Card>
        <CardHeader>
          <CardTitle>Get Started</CardTitle>
          <CardDescription>
            Forward your newsletters to your dedicated email address above, or
            connect Gmail to import existing newsletters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-center">
            <p className="text-gray-500 dark:text-gray-500">
              No newsletters yet. Start by forwarding a newsletter to your
              dedicated email address.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
