import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/newsletters/")({
  component: NewslettersPage,
})

function NewslettersPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Your Newsletters
      </h1>
      <p className="text-gray-600 dark:text-gray-400">
        Welcome! Your newsletter inbox will appear here once you start receiving
        newsletters.
      </p>
      {/* Newsletter list will be implemented in future stories */}
      <div className="mt-8 p-8 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-center">
        <p className="text-gray-500 dark:text-gray-500">
          No newsletters yet. Your dedicated email address will be set up in a
          future update.
        </p>
      </div>
    </div>
  )
}
