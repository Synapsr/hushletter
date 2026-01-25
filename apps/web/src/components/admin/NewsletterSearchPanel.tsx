import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@newsletter-manager/backend"
import { useForm } from "@tanstack/react-form"
import { Input } from "~/components/ui/input"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Badge } from "~/components/ui/badge"
import { Label } from "~/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { formatDistanceToNow } from "date-fns"
import { Lock, Unlock, Search } from "lucide-react"

type PrivacyFilter = "all" | "private" | "public"

interface SearchParams {
  senderEmail?: string
  subjectContains?: string
  isPrivate?: boolean
}

/**
 * Newsletter Search Panel
 * Story 7.3: Task 6.1 - Search form with filters
 *
 * Allows admins to search newsletters by:
 * - Sender email (partial match)
 * - Subject (partial match)
 * - Privacy status
 */
export function NewsletterSearchPanel() {
  const [searchParams, setSearchParams] = useState<SearchParams>({})
  const [hasSearched, setHasSearched] = useState(false)

  const form = useForm({
    defaultValues: {
      senderEmail: "",
      subjectContains: "",
      privacyFilter: "all" as PrivacyFilter,
    },
    onSubmit: async ({ value }) => {
      setSearchParams({
        senderEmail: value.senderEmail || undefined,
        subjectContains: value.subjectContains || undefined,
        isPrivate:
          value.privacyFilter === "all"
            ? undefined
            : value.privacyFilter === "private",
      })
      setHasSearched(true)
    },
  })

  const { data: results, isPending } = useQuery({
    ...convexQuery(api.admin.searchNewsletters, {
      ...searchParams,
      limit: 50,
    }),
    enabled: hasSearched,
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" aria-hidden="true" />
            Search Newsletters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
            className="grid grid-cols-1 md:grid-cols-4 gap-4"
          >
            <form.Field
              name="senderEmail"
              children={(field) => (
                <div className="space-y-1">
                  <Label htmlFor="senderEmail">Sender Email</Label>
                  <Input
                    id="senderEmail"
                    placeholder="newsletter@example.com"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            />

            <form.Field
              name="subjectContains"
              children={(field) => (
                <div className="space-y-1">
                  <Label htmlFor="subjectContains">Subject Contains</Label>
                  <Input
                    id="subjectContains"
                    placeholder="Search subject..."
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            />

            <form.Field
              name="privacyFilter"
              children={(field) => (
                <div className="space-y-1">
                  <Label htmlFor="privacyFilter">Privacy Status</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) =>
                      field.handleChange(v as PrivacyFilter)
                    }
                  >
                    <SelectTrigger id="privacyFilter" aria-label="Filter by privacy status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="private">Private Only</SelectItem>
                      <SelectItem value="public">Public Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            />

            <div className="flex items-end">
              <form.Subscribe
                selector={(state) => state.isSubmitting}
                children={(isSubmitting) => (
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Searching..." : "Search"}
                  </Button>
                )}
              />
            </div>
          </form>
        </CardContent>
      </Card>

      {isPending && hasSearched && (
        <p className="text-center text-muted-foreground py-8" role="status">
          Searching...
        </p>
      )}

      {results && results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results ({results.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Privacy</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Storage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((newsletter) => (
                  <TableRow key={newsletter.id}>
                    <TableCell>
                      {newsletter.isPrivate ? (
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1 w-fit"
                        >
                          <Lock className="h-3 w-3" aria-hidden="true" />
                          Private
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1 w-fit"
                        >
                          <Unlock className="h-3 w-3" aria-hidden="true" />
                          Public
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {newsletter.subject}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {newsletter.senderName || newsletter.senderEmail}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(newsletter.receivedAt, {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          newsletter.hasPrivateR2Key ? "secondary" : "default"
                        }
                        className="text-xs"
                      >
                        {newsletter.hasPrivateR2Key
                          ? "Private R2"
                          : "Shared Content"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {hasSearched && results && results.length === 0 && (
        <p className="text-center text-muted-foreground py-8" role="status">
          No newsletters found matching your criteria
        </p>
      )}

      {!hasSearched && (
        <p className="text-center text-muted-foreground py-8" role="status">
          Enter search criteria and click Search to find newsletters
        </p>
      )}
    </div>
  )
}
