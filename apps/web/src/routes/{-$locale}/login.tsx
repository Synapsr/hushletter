import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@hushletter/ui";
import { signIn, emailOtp } from "@/lib/auth-client";
import { useAppForm } from "@/hooks/form/form";
import { revalidateLogic } from "@tanstack/react-form";
import { toast } from "sonner";
import { m } from "@/paraglide/messages.js";
import { AnimatePresence, motion } from "motion/react";
import { OtpInput } from "@/components/otp-input";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/{-$locale}/login")({
  component: LoginPage,
});

const loginSchema = z.object({
  email: z.email(m.auth_invalidEmail()),
  password: z.string().min(1, m.auth_passwordRequired()),
});

type LoginStep = "form" | "otp";

const springTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
};

function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<LoginStep>("form");
  const [email, setEmail] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpErrorTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const passwordRef = useRef("");

  useEffect(() => {
    return () => {
      if (otpErrorTimerRef.current) clearTimeout(otpErrorTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const mutation = useMutation({
    mutationFn: async (value: { email: string; password: string }) => {
      const result = await signIn.email({
        email: value.email,
        password: value.password,
      });

      if (result.error) {
        if (result.error.code === "EMAIL_NOT_VERIFIED") {
          setEmail(value.email);
          passwordRef.current = value.password;

          try {
            await emailOtp.sendVerificationOtp({
              email: value.email,
              type: "email-verification",
            });
            setResendCooldown(60);
          } catch {
            toast.error(m.auth_otpSendFailed());
          }

          setStep("otp");
          return { requiresVerification: true as const };
        }

        throw new Error(result.error.message);
      }

      return { requiresVerification: false as const };
    },
    onError: (error) => {
      toast.error(error.message || m.auth_invalidCredentials());
    },
    onSuccess: (result) => {
      if (result.requiresVerification) return;
      navigate({ to: "/newsletters" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (otp: string) => {
      const verifyResult = await emailOtp.verifyEmail({ email, otp });
      if (verifyResult.error) {
        throw new Error(verifyResult.error.message || m.auth_otpInvalid());
      }

      const signInResult = await signIn.email({
        email,
        password: passwordRef.current,
      });
      if (signInResult.error) {
        throw new Error(signInResult.error.message || m.auth_invalidCredentials());
      }
    },
    onError: (error) => {
      setOtpError(true);
      otpErrorTimerRef.current = setTimeout(() => setOtpError(false), 500);
      toast.error(error.message || m.auth_otpInvalid());
    },
    onSuccess: () => {
      passwordRef.current = "";
      navigate({ to: "/newsletters" });
    },
  });

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return;
    try {
      await emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });
      setResendCooldown(60);
      toast.success(m.auth_otpResent());
    } catch {
      toast.error(m.auth_otpSendFailed());
    }
  };

  const form = useAppForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "change",
    }),
    validators: {
      onSubmit: loginSchema,
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4 dark:from-gray-950 dark:to-gray-900">
      <Card className="w-full max-w-md overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {step === "form" ? (
            <motion.div
              key="login-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={springTransition}
            >
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold">
                  {m.auth_loginTitle()}
                </CardTitle>
                <CardDescription>{m.auth_loginSubtitle()}</CardDescription>
              </CardHeader>
              <CardContent>
                <form.AppForm>
                  <form.Form className="">
                    <form.AppField name="email">
                      {(field) => (
                        <field.Input
                          label={m.auth_email()}
                          type="email"
                          placeholder={m.auth_emailPlaceholder()}
                          autoComplete="email"
                        />
                      )}
                    </form.AppField>

                    <form.AppField name="password">
                      {(field) => (
                        <field.Input
                          label={m.auth_password()}
                          type="password"
                          placeholder={m.auth_passwordPlaceholder()}
                          autoComplete="current-password"
                        />
                      )}
                    </form.AppField>

                    <form.SubscribeButton type="submit" className="w-full">
                      {m.auth_signIn()}
                    </form.SubscribeButton>
                  </form.Form>
                </form.AppForm>

                <div className="mt-4 text-center">
                  <Link
                    to="/{-$locale}/forgot-password"
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {m.auth_forgotPassword()}
                  </Link>
                </div>

                <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                  {m.auth_noAccount()}{" "}
                  <Link
                    to="/{-$locale}/signup"
                    className="font-medium text-primary hover:underline"
                  >
                    {m.auth_signUpLink()}
                  </Link>
                </p>
              </CardContent>
            </motion.div>
          ) : (
            <motion.div
              key="otp-step"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={springTransition}
            >
              <CardHeader className="text-center">
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setStep("form")}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Back"
                  >
                    <ArrowLeft className="size-5" />
                  </button>
                </div>
                <CardTitle className="text-2xl font-bold">
                  {m.auth_otpTitle()}
                </CardTitle>
                <CardDescription>{m.auth_otpSubtitle({ email })}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-6">
                  <OtpInput
                    onComplete={(otp) => verifyMutation.mutate(otp)}
                    onChange={setOtpValue}
                    error={otpError}
                    disabled={verifyMutation.isPending}
                  />

                  <Button
                    className="w-full"
                    isPending={verifyMutation.isPending}
                    disabled={otpValue.length !== 6 || verifyMutation.isPending}
                    onClick={() => verifyMutation.mutate(otpValue)}
                  >
                    {verifyMutation.isPending
                      ? m.auth_otpVerifying()
                      : m.auth_otpVerify()}
                  </Button>

                  <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                    {m.auth_otpDidntReceive()}{" "}
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendCooldown > 0}
                      className="font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {resendCooldown > 0
                        ? m.auth_otpResendIn({ seconds: String(resendCooldown) })
                        : m.auth_otpResend()}
                    </button>
                  </p>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </main>
  );
}
