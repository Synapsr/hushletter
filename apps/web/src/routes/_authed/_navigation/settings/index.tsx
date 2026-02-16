import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useAction } from "convex/react";
import { api } from "@hushletter/backend";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { useState, useEffect, useRef } from "react";
import { DedicatedEmailDisplay } from "@/components/DedicatedEmailDisplay";
import { HiddenFoldersSection } from "@/components/HiddenFoldersSection";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@hushletter/ui";
import {
  Pencil,
  X,
  Check,
  Mail,
  AlertCircle,
  Shield,
  CreditCard,
  ChevronRight,
  FolderIcon,
} from "lucide-react";
import { DisconnectConfirmDialog } from "../import/-DisconnectConfirmDialog";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/_navigation/settings/")({
  component: SettingsPage,
});

// Zod schema for profile name validation
const profileNameSchema = z.object({
  name: z.string().max(100, m.settings_nameMaxLength()),
});

// Type for getCurrentUser query response
// Note: convexQuery doesn't properly infer return types, so we define it explicitly
// This matches the return type from packages/backend/convex/auth.ts getCurrentUser
type CurrentUserData = {
  id: string;
  email: string;
  name: string | null;
  dedicatedEmail: string | null;
  plan: "free" | "pro";
  proExpiresAt: number | null;
  vanityEmail: string | null;
} | null;

// Type for Gmail connection data (from gmailConnections.getGmailConnections)
type GmailConnectionData = {
  _id: string;
  email: string;
  connectedAt: number;
  source: "betterauth" | "oauth";
};

/**
 * Gmail Integration Settings Section
 * Story 4.5: Task 4 (AC #1) - Disconnect option in settings
 */
function GmailSettingsSection({ isPro }: { isPro: boolean }) {
  const queryClient = useQueryClient();
  const removeConnection = useAction(api.gmailConnections.removeConnection);

  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState<GmailConnectionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Query all Gmail connections
  const {
    data,
    isPending,
    error: queryError,
  } = useQuery(convexQuery(api.gmailConnections.getGmailConnections, isPro ? {} : "skip"));
  const connections = (data ?? []) as GmailConnectionData[];

  const isConnected = connections.length > 0;
  // For backward compat with the single-account display
  const gmailAccount = isConnected ? connections[0] : null;

  if (!isPro) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {m.settings_gmailIntegration()}
          </CardTitle>
          <CardDescription>{m.settings_gmailDescription()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Gmail sync is available on Hushletter Pro.
          </p>
          <Button
            onClick={() =>
              document
                .getElementById("billing")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Upgrade to Pro
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleConfirmDisconnect = async () => {
    if (!disconnectTarget) return;
    setIsDisconnecting(true);
    setError(null);

    try {
      await removeConnection({ gmailConnectionId: disconnectTarget._id as Parameters<typeof removeConnection>[0]["gmailConnectionId"] });
      await queryClient.invalidateQueries();
      setError(null);
      setIsDialogOpen(false);
      setDisconnectTarget(null);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(m.settings_gmailDisconnectError());
      }
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isPending) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-1/3 animate-pulse" />
          <div className="h-4 bg-muted rounded w-2/3 animate-pulse mt-2" />
        </CardHeader>
        <CardContent>
          <div className="h-16 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {m.settings_gmailIntegration()}
          </CardTitle>
          <CardDescription>{m.settings_gmailDescription()}</CardDescription>
        </CardHeader>
        <CardContent>
          {queryError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Unable to check Gmail status</span>
            </div>
          ) : isConnected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">
                    {m.settings_gmailConnected()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {gmailAccount!.email}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDisconnectTarget(gmailAccount!);
                    setIsDialogOpen(true);
                  }}
                >
                  {m.settings_gmailDisconnect()}
                </Button>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <p className="text-sm text-muted-foreground">
                {m.settings_gmailGoToImport()}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {m.settings_gmailNotConnected()}
              </p>
              <Button render={<Link to="/import" />} variant="outline">
                {m.settings_gmailConnectButton()}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {disconnectTarget && (
        <DisconnectConfirmDialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setDisconnectTarget(null);
          }}
          onConfirm={handleConfirmDisconnect}
          isPending={isDisconnecting}
          gmailAddress={disconnectTarget.email}
        />
      )}
    </>
  );
}

// Profile Edit Form Component
function ProfileNameEditForm({
  currentName,
  onSuccess,
  onCancel,
}: {
  currentName: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const updateProfile = useConvexMutation(api.users.updateProfile);

  const form = useForm({
    defaultValues: { name: currentName ?? "" },
    validators: {
      onChange: profileNameSchema,
      onSubmitAsync: async () => {
        // Return submission errors via TanStack Form's built-in error handling
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      try {
        await updateProfile({
          name: value.name || undefined,
        });
        // Invalidate the user query to refetch updated data
        queryClient.invalidateQueries();
        onSuccess();
      } catch {
        // Use form's error state instead of useState
        return {
          form: m.settings_nameSaveError(),
        };
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
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
              placeholder={m.settings_enterDisplayName()}
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
              aria-label={m.common_save()}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onCancel}
              disabled={isSubmitting}
              aria-label={m.common_cancel()}
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
  );
}

function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(
    convexQuery(api.auth.getCurrentUser, {}),
  );

  const user = data as CurrentUserData;
  const { data: entitlementsData } = useQuery(
    convexQuery(api.entitlements.getEntitlements, {}),
  );
  const entitlements = entitlementsData as
    | {
        isPro?: boolean;
        unlockedCap?: number;
        hardCap?: number;
        aiDailyLimit?: number;
        usage?: {
          unlockedStored?: number | null;
          lockedStored?: number | null;
          totalStored?: number | null;
        };
      }
    | undefined;
  const isPro = Boolean(entitlements?.isPro);

  const [vanityPrefix, setVanityPrefix] = useState("");
  const [debouncedVanityPrefix, setDebouncedVanityPrefix] = useState("");
  const [vanityPending, setVanityPending] = useState(false);
  const [vanityError, setVanityError] = useState<string | null>(null);
  const claimVanityEmail = useConvexMutation(api.users.claimEmailPrefix);

  useEffect(() => {
    const trimmed = vanityPrefix.toLowerCase().trim();
    const t = setTimeout(() => setDebouncedVanityPrefix(trimmed), 300);
    return () => clearTimeout(t);
  }, [vanityPrefix]);

  const { data: vanityAvailabilityData, isPending: vanityAvailabilityPending } =
    useQuery(
      convexQuery(
        api.users.checkPrefixAvailability,
        isPro && debouncedVanityPrefix.length > 0
          ? { prefix: debouncedVanityPrefix }
          : "skip",
      ),
    );
  const vanityAvailability = vanityAvailabilityData as
    | { available: boolean; reason: string }
    | undefined;

  const createCheckout = useAction(api.billing.createProCheckoutUrl);
  const createPortal = useAction(api.billing.createCustomerPortalUrl);
  const syncProStatus = useAction(api.billing.syncProStatusFromStripe);
  const [billingPending, setBillingPending] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingSuccessOpen, setBillingSuccessOpen] = useState(false);
  const [billingSyncPending, setBillingSyncPending] = useState(false);
  const [billingSyncError, setBillingSyncError] = useState<string | null>(null);
  const autoSyncedRef = useRef(false);

  const locale = getLocale();
  const currency = locale.startsWith("fr")
    ? ("eur" as const)
    : ("usd" as const);
  const currencySymbol = currency === "eur" ? "€" : "$";

  const handleUpgrade = async (interval: "month" | "year") => {
    setBillingPending(true);
    setBillingError(null);
    try {
      const { url } = await createCheckout({ interval, currency });
      window.location.href = url;
    } catch (error) {
      console.error("[settings] Failed to start checkout:", error);
      setBillingError("Unable to start checkout. Please try again.");
    } finally {
      setBillingPending(false);
    }
  };

  const handleManageSubscription = async () => {
    setBillingPending(true);
    setBillingError(null);
    try {
      const { url } = await createPortal({});
      window.location.href = url;
    } catch (error) {
      console.error("[settings] Failed to open customer portal:", error);
      setBillingError("Unable to open billing portal. Please try again.");
    } finally {
      setBillingPending(false);
    }
  };

  const handleBillingSync = async () => {
    setBillingSyncPending(true);
    setBillingSyncError(null);
    try {
      const res = await syncProStatus({});
      if (!res.ok) {
        setBillingSyncError(
          res.reason === "no_subscription_found"
            ? "Payment received, but subscription is still activating. Try again in a moment."
            : "Could not sync subscription status from Stripe. Please try again.",
        );
      } else {
        // Ensure UI flips immediately even if reactive queries are momentarily stale.
        await queryClient.invalidateQueries();
      }
    } catch (error) {
      console.error("[settings] Failed to sync Pro status:", error);
      setBillingSyncError(
        "Could not sync subscription status from Stripe. Please try again.",
      );
    } finally {
      setBillingSyncPending(false);
    }
  };

  useEffect(() => {
    // If the Stripe component already has an active subscription, but the app user doc
    // hasn't been updated yet, this silently fixes it when opening Settings.
    if (autoSyncedRef.current) return;
    if (entitlementsData === undefined) return;
    if (Boolean(entitlements?.isPro)) {
      autoSyncedRef.current = true;
      return;
    }

    autoSyncedRef.current = true;
    void (async () => {
      try {
        const res = await syncProStatus({});
        if (res.ok && res.isProNow) {
          await queryClient.invalidateQueries();
        }
      } catch {
        // Silent: free users (or transient issues) shouldn't see an error just for visiting settings.
      }
    })();
  }, [entitlementsData, entitlements?.isPro, queryClient, syncProStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billing = params.get("billing");
    if (billing !== "success" && billing !== "cancel") return;

    // Remove the param so refresh doesn't re-trigger the modal/side effects.
    params.delete("billing");
    const next = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${next ? `?${next}` : ""}`,
    );

    if (billing === "cancel") {
      toast.info("Checkout canceled");
      return;
    }

    setBillingSuccessOpen(true);

    // Smooth activation: pull status from Stripe so the UI updates even if
    // webhooks are delayed/misconfigured in dev.
    void handleBillingSync();
  }, [syncProStatus]);

  const [isEditingName, setIsEditingName] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClaimVanity = async () => {
    if (!isPro) {
      document
        .getElementById("billing")
        ?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setVanityPending(true);
    setVanityError(null);
    try {
      await claimVanityEmail({ prefix: debouncedVanityPrefix });
      await queryClient.invalidateQueries();
      toast.success("Custom address saved");
      setVanityPrefix("");
    } catch (error) {
      console.error("[settings] Failed to claim vanity prefix:", error);
      setVanityError("Unable to save custom address. Please try again.");
    } finally {
      setVanityPending(false);
    }
  };

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const handleEditSuccess = () => {
    setIsEditingName(false);
    setShowSuccessMessage(true);
    // Clear any existing timeout
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }
    successTimeoutRef.current = setTimeout(
      () => setShowSuccessMessage(false),
      3000,
    );
  };

  if (isPending) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  const dedicatedEmail = user?.dedicatedEmail;
  const domain =
    (dedicatedEmail ?? user?.vanityEmail ?? "").split("@")[1] ?? "";
  const vanityPreview =
    debouncedVanityPrefix && domain
      ? `${debouncedVanityPrefix}@${domain}`
      : null;

  return (
    <>
      <Dialog
        open={billingSuccessOpen}
        onOpenChange={(open) => {
          setBillingSuccessOpen(open);
          if (!open) setBillingSyncError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isPro ? "Welcome to Hushletter Pro" : "Activating your Pro plan"}
            </DialogTitle>
            <DialogDescription>
              {isPro
                ? "Your subscription is active. Here’s what you can do now."
                : "This usually takes a few seconds. If it takes longer, you can retry the sync."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {billingSyncError && (
              <p className="text-sm text-destructive" role="alert">
                {billingSyncError}
              </p>
            )}

            {!isPro ? (
              <div className="text-sm text-muted-foreground">
                {billingSyncPending
                  ? "Syncing subscription status from Stripe…"
                  : "Waiting for subscription activation…"}
              </div>
            ) : (
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                <li>AI summaries</li>
                <li>Gmail import and sync</li>
                <li>Vanity email alias</li>
                <li>Premium reader appearance controls</li>
                <li>Unlocks any locked newsletters</li>
              </ul>
            )}
          </div>

          <DialogFooter>
            {!isPro && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleBillingSync()}
                disabled={billingSyncPending}
              >
                Retry sync
              </Button>
            )}
            <Button type="button" onClick={() => setBillingSuccessOpen(false)}>
              {isPro ? "Continue" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="container mx-auto px-4 py-8 overflow-y-auto h-full">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          {m.settings_title()}
        </h1>

        {/* Billing / Plan */}
        <Card className="mb-6" id="billing">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Plan
            </CardTitle>
            <CardDescription>
              {currencySymbol}9/month · {currencySymbol}90/year · + tax/VAT
              where applicable
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {billingError && (
              <p className="text-sm text-destructive" role="alert">
                {billingError}
              </p>
            )}

            {!isPro ? (
              <>
                {typeof entitlements?.usage?.unlockedStored === "number" &&
                  typeof entitlements?.unlockedCap === "number" && (
                    <div className="text-sm text-muted-foreground">
                      Free history: {entitlements.usage.unlockedStored}/
                      {entitlements.unlockedCap} readable newsletters
                    </div>
                  )}

                {(typeof entitlements?.usage?.totalStored === "number" ||
                  typeof entitlements?.usage?.lockedStored === "number") &&
                  typeof entitlements?.hardCap === "number" && (
                    <div className="text-sm text-muted-foreground">
                      Stored:{" "}
                      {typeof entitlements?.usage?.totalStored === "number"
                        ? entitlements.usage.totalStored
                        : "—"}
                      /{entitlements.hardCap}
                      {typeof entitlements?.usage?.lockedStored === "number"
                        ? ` · Locked: ${entitlements.usage.lockedStored}`
                        : ""}
                    </div>
                  )}

                <div className="rounded-lg border bg-card p-3">
                  <p className="text-sm font-medium mb-2">What Pro unlocks</p>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                    <li>
                      AI summaries ({entitlements?.aiDailyLimit ?? 50}/day)
                    </li>
                    <li>Gmail import and sync</li>
                    <li>Vanity email alias (keep your original address too)</li>
                    <li>Premium reader appearance controls</li>
                    <li>Unlocks any locked newsletters</li>
                  </ul>
                </div>

                {typeof entitlements?.usage?.unlockedStored === "number" &&
                  typeof entitlements?.unlockedCap === "number" &&
                  entitlements.usage.unlockedStored >=
                    Math.floor(entitlements.unlockedCap * 0.95) && (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
                      You’re close to the Free plan limit. New newsletters may
                      become locked until you upgrade.
                    </div>
                  )}

                {typeof entitlements?.usage?.unlockedStored === "number" &&
                  typeof entitlements?.unlockedCap === "number" &&
                  entitlements.usage.unlockedStored >=
                    Math.floor(entitlements.unlockedCap * 0.8) &&
                  entitlements.usage.unlockedStored <
                    Math.floor(entitlements.unlockedCap * 0.95) && (
                    <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                      You’re approaching the Free plan limit.
                    </div>
                  )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={billingPending}
                    onClick={() => handleUpgrade("month")}
                  >
                    Upgrade monthly ({currencySymbol}9)
                  </Button>
                  <Button
                    disabled={billingPending}
                    variant="outline"
                    onClick={() => handleUpgrade("year")}
                  >
                    Upgrade yearly ({currencySymbol}90)
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  30-day money-back guarantee.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Hushletter Pro</p>
                    {user?.proExpiresAt ? (
                      <p className="text-sm text-muted-foreground">
                        Renews until{" "}
                        {new Date(user.proExpiresAt).toLocaleDateString()}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Subscription active
                      </p>
                    )}
                  </div>
                  <Button
                    disabled={billingPending}
                    variant="outline"
                    onClick={handleManageSubscription}
                  >
                    Manage subscription
                  </Button>
                </div>

                <div className="rounded-lg border bg-card p-3">
                  <p className="text-sm font-medium mb-2">Included with Pro</p>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                    <li>
                      AI summaries ({entitlements?.aiDailyLimit ?? 50}/day)
                    </li>
                    <li>Gmail import and sync</li>
                    <li>Vanity email alias (keep your original address too)</li>
                    <li>Premium reader appearance controls</li>
                    <li>All newsletters readable</li>
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Privacy Settings Section - Story 6.2: Task 5 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {m.settings_privacySettings()}
            </CardTitle>
            <CardDescription>{m.settings_privacyDescription()}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              to="/settings/privacy"
              className="flex items-center justify-between p-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <div>
                <p className="font-medium">{m.settings_privacySettings()}</p>
                <p className="text-sm text-muted-foreground">
                  {m.settings_privacyDescription()}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
          </CardContent>
        </Card>

        {/* Hidden Folders Section - Story 9.5: Task 5.1 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderIcon className="h-5 w-5" />
              {m.settings_hiddenFolders()}
            </CardTitle>
            <CardDescription>
              {m.settings_hiddenFoldersDescription()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HiddenFoldersSection />
          </CardContent>
        </Card>

        {/* Gmail Integration Section - Story 4.5: Task 4 */}
        <GmailSettingsSection isPro={isPro} />

        {/* Email Settings Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{m.settings_yourNewsletterEmail()}</CardTitle>
            <CardDescription>{m.settings_emailInfo()}</CardDescription>
          </CardHeader>
          <CardContent>
            {dedicatedEmail ? (
              <div className="space-y-4">
                <DedicatedEmailDisplay email={dedicatedEmail} />
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>
                    <strong>{m.settings_emailHowToUse()}</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>{m.settings_emailStep1()}</li>
                    <li>{m.settings_emailStep2()}</li>
                    <li>{m.settings_emailStep3()}</li>
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">{m.settings_emailInfo()}</p>
            )}
          </CardContent>
        </Card>

        {/* Vanity Email (Pro) */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Custom address (Pro)</CardTitle>
            <CardDescription>
              Claim one custom prefix as an alias. Your original address keeps
              receiving forever.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user?.vanityEmail ? (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Current alias</p>
                <p className="font-mono text-sm font-semibold">
                  {user.vanityEmail}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No alias claimed yet.
              </p>
            )}

            {!isPro ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Custom addresses are available on Hushletter Pro.
                </p>
                <Button
                  onClick={() =>
                    document
                      .getElementById("billing")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Upgrade to Pro
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label
                    className="text-sm font-medium"
                    htmlFor="vanity-prefix"
                  >
                    Prefix
                  </label>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Input
                      id="vanity-prefix"
                      value={vanityPrefix}
                      onChange={(e) => setVanityPrefix(e.target.value)}
                      placeholder="your-name"
                      className="max-w-xs"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    <Button
                      type="button"
                      disabled={
                        vanityPending ||
                        vanityAvailabilityPending ||
                        !debouncedVanityPrefix ||
                        vanityAvailability?.available === false
                      }
                      onClick={handleClaimVanity}
                    >
                      Save
                    </Button>
                  </div>
                  {vanityPreview && (
                    <p className="text-xs text-muted-foreground">
                      Preview:{" "}
                      <span className="font-mono">{vanityPreview}</span>
                    </p>
                  )}
                </div>

                {vanityAvailabilityPending && debouncedVanityPrefix ? (
                  <p className="text-xs text-muted-foreground">
                    Checking availability…
                  </p>
                ) : vanityAvailability ? (
                  vanityAvailability.available ? (
                    <p className="text-xs text-green-700 dark:text-green-400">
                      Available
                    </p>
                  ) : (
                    <p className="text-xs text-destructive">
                      Unavailable ({vanityAvailability.reason})
                    </p>
                  )
                ) : null}

                {vanityError && (
                  <p className="text-sm text-destructive" role="alert">
                    {vanityError}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Info Section */}
        <Card>
          <CardHeader>
            <CardTitle>{m.settings_accountInfo()}</CardTitle>
            <CardDescription>{m.settings_accountInfo()}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  {m.settings_accountEmail()}
                </dt>
                <dd className="text-base">{user?.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground mb-1">
                  {m.settings_accountDisplayName()}
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
                      <span className="text-base">
                        {user?.name || m.settings_accountNotSet()}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setIsEditingName(true)}
                        aria-label={m.settings_editDisplayName()}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {showSuccessMessage && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      {m.settings_nameUpdated()}
                    </p>
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
