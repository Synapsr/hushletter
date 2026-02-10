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
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@hushletter/ui";
import {
  Pencil,
  X,
  Check,
  Mail,
  AlertCircle,
  Shield,
  ChevronRight,
  FolderIcon,
} from "lucide-react";
import { DisconnectConfirmDialog } from "../import/-DisconnectConfirmDialog";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/_authed/settings/")({
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
} | null;

// Type for Gmail account data
type GmailAccountData = { email: string; connectedAt: number } | null;

/**
 * Gmail Integration Settings Section
 * Story 4.5: Task 4 (AC #1) - Disconnect option in settings
 */
function GmailSettingsSection() {
  const queryClient = useQueryClient();
  const disconnectGmail = useAction(api.gmail.disconnectGmail);

  // Note: useState for isDisconnecting is required because Convex useAction doesn't
  // provide isPending like useMutation does. This is an accepted exception per
  // ReaderView.tsx:104-113 pattern in the codebase.
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Query Gmail connection status
  const {
    data,
    isPending,
    error: queryError,
  } = useQuery(convexQuery(api.gmail.getGmailAccount, {}));
  const gmailAccount = data as GmailAccountData | undefined;

  const isConnected = gmailAccount !== null && gmailAccount !== undefined;

  const handleConfirmDisconnect = async () => {
    setIsDisconnecting(true);
    setError(null);

    try {
      await disconnectGmail({});
      await queryClient.invalidateQueries();
      // Clear any previous error and close dialog on success
      setError(null);
      setIsDialogOpen(false);
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
                  <p className="font-medium text-green-700 dark:text-green-400">{m.settings_gmailConnected()}</p>
                  <p className="text-sm text-muted-foreground">{gmailAccount.email}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(true)}>
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
              <Button render={<Link to="/import" />} variant="outline">{m.settings_gmailConnectButton()}</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isConnected && (
        <DisconnectConfirmDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onConfirm={handleConfirmDisconnect}
          isPending={isDisconnecting}
          gmailAddress={gmailAccount.email}
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
  const { data, isPending } = useQuery(convexQuery(api.auth.getCurrentUser, {}));
  const user = data as CurrentUserData;
  const [isEditingName, setIsEditingName] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    successTimeoutRef.current = setTimeout(() => setShowSuccessMessage(false), 3000);
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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">{m.settings_title()}</h1>

      {/* Privacy Settings Section - Story 6.2: Task 5 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {m.settings_privacySettings()}
          </CardTitle>
          <CardDescription>
            {m.settings_privacyDescription()}
          </CardDescription>
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
          <CardDescription>{m.settings_hiddenFoldersDescription()}</CardDescription>
        </CardHeader>
        <CardContent>
          <HiddenFoldersSection />
        </CardContent>
      </Card>

      {/* Gmail Integration Section - Story 4.5: Task 4 */}
      <GmailSettingsSection />

      {/* Email Settings Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{m.settings_yourNewsletterEmail()}</CardTitle>
          <CardDescription>
            {m.settings_emailInfo()}
          </CardDescription>
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
            <p className="text-muted-foreground">
              {m.settings_emailInfo()}
            </p>
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
              <dt className="text-sm font-medium text-muted-foreground">{m.settings_accountEmail()}</dt>
              <dd className="text-base">{user?.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground mb-1">{m.settings_accountDisplayName()}</dt>
              <dd>
                {isEditingName ? (
                  <ProfileNameEditForm
                    currentName={user?.name ?? null}
                    onSuccess={handleEditSuccess}
                    onCancel={() => setIsEditingName(false)}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-base">{user?.name || m.settings_accountNotSet()}</span>
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
  );
}
