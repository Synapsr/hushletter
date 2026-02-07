import { Link } from "@tanstack/react-router";
import { DedicatedEmailDisplay } from "@/components/DedicatedEmailDisplay";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inbox, Compass } from "lucide-react";

interface EmptyNewsletterStateProps {
  dedicatedEmail: string | null;
}

/**
 * EmptyNewsletterState - Displays when user has no newsletters yet
 * Story 6.4 Task 4.2, 4.3: Enhanced with "Discover" CTA linking to community
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
          Discover newsletters shared by the community or subscribe to your favorites
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Story 6.4 Task 4.3: Prominent Discover Newsletters button */}
        <div className="flex flex-col items-center gap-3">
          <Link to="/community">
            <Button size="lg" className="gap-2">
              <Compass className="h-5 w-5" />
              Discover Newsletters
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground">
            Browse newsletters shared by the community
          </p>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or subscribe</span>
          </div>
        </div>

        {dedicatedEmail && (
          <div className="max-w-md mx-auto">
            <DedicatedEmailDisplay email={dedicatedEmail} />
          </div>
        )}

        <div className="text-sm text-muted-foreground text-left max-w-md mx-auto space-y-3">
          <p className="font-medium text-foreground">How to subscribe:</p>
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
  );
}
