import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@newsletter-manager/backend"
import { useForm } from "@tanstack/react-form"
import { z } from "zod"
import { useState, useEffect, useRef } from "react"
import { DedicatedEmailDisplay } from "~/components/DedicatedEmailDisplay"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Pencil, X, Check } from "lucide-react"

export const Route = createFileRoute("/_authed/settings/")({
  component: SettingsPage,
})

// Zod schema for profile name validation
const profileNameSchema = z.object({
  name: z.string().max(100, "Name must be 100 characters or less"),
})

// Type for getCurrentUser query response
// Note: convexQuery doesn't properly infer return types, so we define it explicitly
// This matches the return type from packages/backend/convex/auth.ts getCurrentUser
type CurrentUserData = {
  id: string
  email: string
  name: string | null
  dedicatedEmail: string | null
} | null

// Profile Edit Form Component
function ProfileNameEditForm({
  currentName,
  onSuccess,
  onCancel,
}: {
  currentName: string | null
  onSuccess: () => void
  onCancel: () => void
}) {
  const queryClient = useQueryClient()
  const updateProfile = useConvexMutation(api.users.updateProfile)

  const form = useForm({
    defaultValues: { name: currentName ?? "" },
    validators: {
      onChange: profileNameSchema,
      onSubmitAsync: async () => {
        // Return submission errors via TanStack Form's built-in error handling
        return undefined
      },
    },
    onSubmit: async ({ value }) => {
      try {
        await updateProfile({
          name: value.name || undefined,
        })
        // Invalidate the user query to refetch updated data
        queryClient.invalidateQueries()
        onSuccess()
      } catch {
        // Use form's error state instead of useState
        return {
          form: "Failed to save. Please try again.",
        }
      }
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="flex items-center gap-2"
    >
      <form.Field
        name="name"
        children={(field) => (
          <div className="flex-1">
            <Input
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="Enter your display name"
              aria-invalid={field.state.meta.errors.length > 0}
              className="max-w-xs"
            />
            {field.state.meta.errors.map((err, i) => (
              <p key={i} className="text-sm text-destructive mt-1">
                {typeof err === "object" && err !== null && "message" in err
                  ? (err as { message: string }).message
                  : String(err)}
              </p>
            ))}
          </div>
        )}
      />

      <form.Subscribe
        selector={(state) => ({
          canSubmit: state.canSubmit,
          isSubmitting: state.isSubmitting,
          errors: state.errors,
        })}
        children={({ canSubmit, isSubmitting, errors }) => (
          <>
            <Button
              type="submit"
              size="icon-sm"
              disabled={!canSubmit || isSubmitting}
              aria-label="Save"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onCancel}
              disabled={isSubmitting}
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </Button>
            {Array.isArray(errors) && errors.length > 0 && (
              <p className="text-sm text-destructive">{String(errors[0])}</p>
            )}
          </>
        )}
      />
    </form>
  )
}

function SettingsPage() {
  const { data, isPending } = useQuery(convexQuery(api.auth.getCurrentUser, {}))
  const user = data as CurrentUserData
  const [isEditingName, setIsEditingName] = useState(false)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current)
      }
    }
  }, [])

  const handleEditSuccess = () => {
    setIsEditingName(false)
    setShowSuccessMessage(true)
    // Clear any existing timeout
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current)
    }
    successTimeoutRef.current = setTimeout(() => setShowSuccessMessage(false), 3000)
  }

  if (isPending) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    )
  }

  const dedicatedEmail = user?.dedicatedEmail

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
        Settings
      </h1>

      {/* Email Settings Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Your Newsletter Email</CardTitle>
          <CardDescription>
            This is your dedicated email address for receiving newsletters.
            Forward newsletters here or share with newsletter services.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dedicatedEmail ? (
            <div className="space-y-4">
              <DedicatedEmailDisplay email={dedicatedEmail} />
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>How to use:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>
                    Subscribe to newsletters using this email address
                  </li>
                  <li>
                    Forward existing newsletters from your personal inbox
                  </li>
                  <li>
                    Set up email forwarding rules in your email client
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Your dedicated email address is being set up. Please refresh the
              page or contact support if this persists.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Account Info Section */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Email
              </dt>
              <dd className="text-base">{user?.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground mb-1">
                Display Name
              </dt>
              <dd>
                {isEditingName ? (
                  <ProfileNameEditForm
                    currentName={user?.name ?? null}
                    onSuccess={handleEditSuccess}
                    onCancel={() => setIsEditingName(false)}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-base">{user?.name || "Not set"}</span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setIsEditingName(true)}
                      aria-label="Edit display name"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {showSuccessMessage && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    Name updated successfully!
                  </p>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
