"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useAction } from "convex/react";
import { api } from "@hushletter/backend";
import { getLocale } from "@/paraglide/runtime.js";
import { Button, Separator } from "@hushletter/ui/components";

type EntitlementsData = {
  plan: "free" | "pro";
  isPro: boolean;
  proExpiresAt: number | null;
  unlockedCap: number;
  hardCap: number;
  aiDailyLimit: number;
  usage?: {
    totalStored: number | null;
    unlockedStored: number | null;
    lockedStored: number | null;
  };
};

export function SettingsBilling() {
  const locale = getLocale();
  const currency = locale.startsWith("fr") ? ("eur" as const) : ("usd" as const);
  const currencySymbol = currency === "eur" ? "€" : "$";

  const { data: entitlementsData, isPending } = useQuery(
    convexQuery(api.entitlements.getEntitlements, {}),
  );
  const entitlements = entitlementsData as EntitlementsData | null | undefined;
  const isPro = Boolean(entitlements?.isPro);

  const createCheckout = useAction(api.billing.createProCheckoutUrl);
  const createPortal = useAction(api.billing.createCustomerPortalUrl);

  const [billingPending, setBillingPending] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  const handleUpgrade = async (interval: "month" | "year") => {
    setBillingPending(true);
    setBillingError(null);
    try {
      const { url } = await createCheckout({ interval, currency });
      window.location.href = url;
    } catch (error) {
      console.error("[settings-dialog] Failed to start checkout:", error);
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
      console.error("[settings-dialog] Failed to open customer portal:", error);
      setBillingError("Unable to open billing portal. Please try again.");
    } finally {
      setBillingPending(false);
    }
  };

  const unlockedStored = entitlements?.usage?.unlockedStored ?? null;
  const lockedStored = entitlements?.usage?.lockedStored ?? null;
  const totalStored = entitlements?.usage?.totalStored ?? null;
  const unlockedCap = entitlements?.unlockedCap ?? 1000;
  const hardCap = entitlements?.hardCap ?? 2000;
  const aiDailyLimit = entitlements?.aiDailyLimit ?? 50;
  const at95 = typeof unlockedStored === "number" && unlockedStored >= Math.floor(unlockedCap * 0.95);
  const at80 =
    typeof unlockedStored === "number" &&
    unlockedStored >= Math.floor(unlockedCap * 0.8) &&
    unlockedStored < Math.floor(unlockedCap * 0.95);

  const readablePct =
    typeof unlockedStored === "number" && unlockedCap > 0
      ? Math.min(100, Math.max(0, Math.round((unlockedStored / unlockedCap) * 100)))
      : null;
  const storedPct =
    typeof totalStored === "number" && hardCap > 0
      ? Math.min(100, Math.max(0, Math.round((totalStored / hardCap) * 100)))
      : null;
  const progressColor =
    at95 ? "bg-amber-500" : at80 ? "bg-primary/70" : "bg-primary";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Billing</h2>
        <p className="text-sm text-muted-foreground">
          Manage your plan and subscription.
        </p>
      </div>

      <Separator />

      {isPending ? (
        <div className="space-y-3">
          <div className="h-5 w-40 rounded bg-muted animate-pulse" />
          <div className="h-9 w-full rounded bg-muted animate-pulse" />
          <div className="h-9 w-2/3 rounded bg-muted animate-pulse" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            {currencySymbol}9/month · {currencySymbol}90/year · + tax/VAT where applicable
          </div>

          {billingError && (
            <p className="text-sm text-destructive" role="alert">
              {billingError}
            </p>
          )}

          <div className="rounded-lg border bg-card p-3 space-y-3">
            <div className="text-sm font-medium">Usage</div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Readable newsletters</span>
                <span className="tabular-nums">
                  {typeof unlockedStored === "number" ? unlockedStored : "—"}/{unlockedCap}
                </span>
              </div>
              <div className="h-2 w-full rounded bg-muted overflow-hidden">
                <div
                  className={`h-full ${progressColor}`}
                  style={{ width: `${readablePct ?? 0}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Free: first {unlockedCap} are readable. After that, new arrivals are stored but locked.
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total stored</span>
                <span className="tabular-nums">
                  {typeof totalStored === "number" ? totalStored : "—"}/{hardCap}
                </span>
              </div>
              <div className="h-2 w-full rounded bg-muted overflow-hidden">
                <div
                  className="h-full bg-muted-foreground/60"
                  style={{ width: `${storedPct ?? 0}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Hard cap: at {hardCap} stored, new arrivals stop being stored on Free.
              </div>
            </div>

            {typeof lockedStored === "number" && (
              <div className="text-sm text-muted-foreground">
                Locked newsletters: <span className="tabular-nums">{lockedStored}</span>
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-card p-3 space-y-2">
            <div className="text-sm font-medium">What Pro unlocks</div>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
              <li>AI summaries ({aiDailyLimit}/day)</li>
              <li>Gmail import and sync</li>
              <li>Vanity email alias (keep your original address too)</li>
              <li>Premium reader appearance controls</li>
              <li>Unlocks any locked newsletters</li>
            </ul>
          </div>

          {!isPro ? (
            <>
              {at95 && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
                  You’re close to the Free plan limit. New newsletters may become locked until you upgrade.
                </div>
              )}
              {at80 && (
                <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  You’re approaching the Free plan limit.
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button disabled={billingPending} onClick={() => handleUpgrade("month")}>
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

              <p className="text-sm text-muted-foreground">30-day money-back guarantee.</p>
            </>
          ) : (
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Hushletter Pro</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {typeof entitlements?.proExpiresAt === "number"
                      ? `Renews until ${new Date(entitlements.proExpiresAt).toLocaleDateString()}`
                      : "Subscription active"}
                  </div>
                </div>
                <Button
                  disabled={billingPending}
                  variant="outline"
                  onClick={handleManageSubscription}
                >
                  Manage subscription
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
