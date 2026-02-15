import { LandingButton } from "@/components/landing/landing-button";
import { FeatureItem } from "@/components/landing/landing-pricing";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import { Dialog, DialogContent, DialogPopup } from "@hushletter/ui";
import NumberFlow from "@number-flow/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { motion } from "motion/react";
import { useState } from "react";

export function PricingDialog({
  open,
  onOpenChange,
  returnTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnTo?: "settings" | "onboarding" | "import";
}) {
  const locale = getLocale();
  const currency = locale.startsWith("fr")
    ? ("eur" as const)
    : ("usd" as const);
  const currencySymbol = currency === "eur" ? "€" : "$";

  const { data: currentUserData } = useQuery(
    convexQuery(api.auth.getCurrentUser, {}),
  );
  const currentUser = currentUserData as { id: string } | null | undefined;
  const isAuthed = Boolean(currentUser?.id);

  const createCheckout = useAction(api.billing.createProCheckoutUrl);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<"month" | "year">(
    "year",
  );

  const handleUpgrade = async () => {
    setCheckoutPending(true);
    setCheckoutError(null);
    try {
      const { url } = await createCheckout({
        interval: billingInterval,
        currency,
        returnTo,
      });
      window.location.href = url;
    } catch (error) {
      console.error("[landing] Failed to start checkout:", error);
      setCheckoutError(m.landing_pricingCheckoutError());
    } finally {
      setCheckoutPending(false);
    }
  };

  const proPriceValue = billingInterval === "month" ? 9 : 7.5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className=" max-w-4xl p-4 space-y-4 overflow-y-auto max-h-[85vh]">
        {/* Monthly / Yearly Toggle */}
        <div className="flex justify-center">
          <div className="inline-flex items-center rounded-full border border-gray-200 p-1">
            {(["month", "year"] as const).map((interval) => (
              <button
                key={interval}
                type="button"
                onClick={() => setBillingInterval(interval)}
                className="relative rounded-full px-5 py-2 text-sm font-semibold"
              >
                {billingInterval === interval && (
                  <motion.div
                    layoutId="pricing-toggle"
                    className="absolute inset-0 rounded-full bg-gray-900"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span
                  className={`relative z-10 transition-colors ${
                    billingInterval === interval
                      ? "text-white"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {interval === "month"
                    ? m.landing_pricingMonthly()
                    : m.landing_pricingYearly()}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto items-stretch">
          {/* Free Card */}
          <div className="rounded-2xl border border-gray-200 bg-white flex flex-col">
            <div className="p-8 pb-0">
              <p className="font-display text-xl font-bold ">
                {m.landing_pricingFreeLabel()}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {m.landing_pricingFreeDesc()}
              </p>

              <div className="mt-6">
                <span className="font-display text-5xl font-bold ">
                  {m.landing_pricingFreePrice({ symbol: currencySymbol })}
                </span>
                <span className="text-base font-body text-muted-foreground">
                  {m.landing_pricingPerMonth()}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {m.landing_pricingFreeForever()}
              </p>
            </div>

            <div className="border-t border-gray-100 mx-8 mt-6" />

            <ul className="p-8 pt-6 space-y-3.5 text-sm text-muted-foreground flex-1">
              <FeatureItem>{m.landing_pricingFreeFeat1()}</FeatureItem>
              <FeatureItem>{m.landing_pricingFreeFeat2()}</FeatureItem>
              <FeatureItem>{m.landing_pricingFreeFeat3()}</FeatureItem>
              <FeatureItem muted>
                {m.landing_pricingStorageLimit1({ count: "1,000" })}
              </FeatureItem>
              <FeatureItem muted>
                {m.landing_pricingStorageLimit2({ count: "1,000" })}
              </FeatureItem>
            </ul>

            <div className="px-8 pb-8">
              <LandingButton
                onClick={() => onOpenChange(false)}
                variant="outline"
                size="full"
              >
                {m.landing_pricingCreateAccount()}
              </LandingButton>
            </div>
          </div>

          {/* Pro Card */}
          <div className="relative rounded-2xl border-2 border-foreground bg-white flex flex-col">
            <div className="p-8 pb-0">
              <p className="font-display text-xl font-bold ">
                {m.landing_pricingProLabel()}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {m.landing_pricingProDesc()}
              </p>

              <motion.div layout className="mt-6 flex items-baseline">
                <NumberFlow
                  value={proPriceValue}
                  format={{
                    style: "currency",
                    currency: currency.toUpperCase(),
                    minimumFractionDigits: billingInterval === "year" ? 2 : 0,
                  }}
                  className="font-display text-5xl font-bold "
                />
                <motion.span
                  layout
                  className="text-base font-body text-muted-foreground"
                >
                  {m.landing_pricingPerMonth()}
                </motion.span>
              </motion.div>
              <p className="mt-1 text-sm text-muted-foreground">
                {billingInterval === "month"
                  ? m.landing_pricingBilledMonthly()
                  : m.landing_pricingBilledYearly()}
              </p>
            </div>

            <div className="border-t border-gray-100 mx-8 mt-6" />

            <div className="px-8 pt-6 pb-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {m.landing_pricingEverythingInFree()}
              </p>
            </div>
            <ul className="p-8 pt-3 space-y-3.5 text-sm text-muted-foreground flex-1">
              <FeatureItem>{m.landing_pricingProFeat1()}</FeatureItem>
              <FeatureItem>{m.landing_pricingProFeat2()}</FeatureItem>
              <FeatureItem>{m.landing_pricingProFeat3()}</FeatureItem>
              <FeatureItem>{m.landing_pricingProFeat4()}</FeatureItem>
            </ul>

            {checkoutError && (
              <p
                className="px-8 -mt-4 mb-4 text-sm text-destructive"
                role="alert"
              >
                {checkoutError}
              </p>
            )}

            <div className="px-8 pb-8">
              {isAuthed ? (
                <LandingButton
                  variant="filled"
                  size="full"
                  disabled={checkoutPending}
                  onClick={handleUpgrade}
                >
                  {m.landing_pricingGetStarted()}
                </LandingButton>
              ) : (
                <LandingButton
                  variant="filled"
                  size="full"
                  render={<Link to="/{-$locale}/signup" />}
                >
                  {m.landing_pricingGetStarted()}
                </LandingButton>
              )}
              <p className="mt-3 text-center text-sm text-muted-foreground">
                {m.landing_pricingNoTrial()}
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {m.landing_pricingTaxNote({ symbol: currencySymbol })}
        </p>
      </DialogPopup>
    </Dialog>
  );
}
