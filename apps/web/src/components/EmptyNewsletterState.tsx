import { Link } from "@tanstack/react-router";
import { DedicatedEmailDisplay } from "@/components/DedicatedEmailDisplay";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@hushletter/ui";
import { Inbox, Compass } from "lucide-react";
import { m } from "@/paraglide/messages.js";

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
        <CardTitle>{m.emptyState_noNewslettersYet()}</CardTitle>
        <CardDescription>
          {m.emptyState_discoverDescription()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Story 6.4 Task 4.3: Prominent Discover Newsletters button */}
        <div className="flex flex-col items-center gap-3">
          <Link to="/community">
            <Button size="lg" className="gap-2">
              <Compass className="h-5 w-5" />
              {m.emptyState_discoverNewsletters()}
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground">
            {m.emptyState_browseNewsletters()}
          </p>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">{m.emptyState_orSubscribe()}</span>
          </div>
        </div>

        {dedicatedEmail && (
          <div className="max-w-md mx-auto">
            <DedicatedEmailDisplay email={dedicatedEmail} />
          </div>
        )}

        <div className="text-sm text-muted-foreground text-left max-w-md mx-auto space-y-3">
          <p className="font-medium text-foreground">{m.emptyState_howToSubscribe()}</p>
          <ol className="list-decimal list-inside space-y-2 ml-2">
            <li>{m.emptyState_step1()}</li>
            <li>{m.emptyState_step2()}</li>
            <li>{m.emptyState_step3()}</li>
          </ol>
          <p className="mt-4 text-xs">
            {m.emptyState_forwardingTip()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
