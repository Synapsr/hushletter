import { DedicatedEmailDisplay } from "~/components/DedicatedEmailDisplay"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Inbox } from "lucide-react"

interface EmptyNewsletterStateProps {
  dedicatedEmail: string | null
}

/**
 * EmptyNewsletterState - Displays when user has no newsletters yet
 * Shows instructions to use dedicated email address for subscriptions
 */
export function EmptyNewsletterState({ dedicatedEmail }: EmptyNewsletterStateProps) {
  return (
    <Card className="text-center">
      <CardHeader>
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-muted p-4">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <CardTitle>No newsletters yet</CardTitle>
        <CardDescription>
          Start receiving newsletters by subscribing with your dedicated email address
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {dedicatedEmail && (
          <div className="max-w-md mx-auto">
            <DedicatedEmailDisplay email={dedicatedEmail} />
          </div>
        )}

        <div className="text-sm text-muted-foreground text-left max-w-md mx-auto space-y-3">
          <p className="font-medium text-foreground">How to get started:</p>
          <ol className="list-decimal list-inside space-y-2 ml-2">
            <li>Copy your dedicated email address above</li>
            <li>Subscribe to newsletters using this address</li>
            <li>New newsletters will appear here automatically</li>
          </ol>
          <p className="mt-4 text-xs">
            You can also forward existing newsletters from your personal inbox to this address.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
