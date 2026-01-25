/**
 * EmlPreview Component
 * Story 8.2: Task 2 (AC #2)
 *
 * Displays parsed EML data for user confirmation before import.
 * Shows subject, sender (email + name), and formatted date.
 */

import { type ParsedEml } from "@newsletter-manager/shared"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Mail, User, Calendar, Loader2, CheckCircle2, X } from "lucide-react"

interface EmlPreviewProps {
  /** Parsed EML data to display */
  parsedEml: ParsedEml
  /** Callback when user confirms import */
  onConfirm: () => void
  /** Callback when user cancels */
  onCancel: () => void
  /** Whether import is currently in progress */
  isImporting: boolean
}

/**
 * Format Unix timestamp to localized date string
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Preview component for a single parsed .eml file
 */
export function EmlPreview({
  parsedEml,
  onConfirm,
  onCancel,
  isImporting,
}: EmlPreviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Preview Newsletter
        </CardTitle>
        <CardDescription>
          Review the newsletter details before importing
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Subject */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">
            Subject
          </p>
          <p className="text-base font-medium text-gray-900 dark:text-white">
            {parsedEml.subject}
          </p>
        </div>

        {/* Sender */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            Sender
          </p>
          <div className="text-base">
            {parsedEml.senderName && (
              <p className="font-medium text-gray-900 dark:text-white">
                {parsedEml.senderName}
              </p>
            )}
            <p
              className={
                parsedEml.senderName
                  ? "text-sm text-muted-foreground"
                  : "font-medium text-gray-900 dark:text-white"
              }
            >
              {parsedEml.senderEmail}
            </p>
          </div>
        </div>

        {/* Date */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            Received
          </p>
          <p className="text-base text-gray-900 dark:text-white">
            {formatDate(parsedEml.receivedAt)}
          </p>
        </div>

        {/* Content preview indicator */}
        <div className="pt-2 border-t">
          <p className="text-sm text-muted-foreground">
            Content type:{" "}
            {parsedEml.htmlContent
              ? "HTML"
              : parsedEml.textContent
                ? "Plain text"
                : "Empty"}
          </p>
          {parsedEml.inlineImages.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Inline images: {parsedEml.inlineImages.length}
            </p>
          )}
          {parsedEml.attachments.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Attachments: {parsedEml.attachments.length}
            </p>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex gap-3">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isImporting}
          className="flex-1"
        >
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isImporting}
          className="flex-1"
        >
          {isImporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Import Newsletter
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
