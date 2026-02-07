import { Card, CardContent, CardHeader, CardTitle } from "@hushletter/ui";
import { Lock, Unlock, Users, Database } from "lucide-react";

/**
 * Privacy statistics from getPrivacyStats query
 */
interface PrivacyStats {
  publicNewsletters: number;
  privateNewsletters: number;
  totalNewsletters: number;
  privatePercentage: number;
  sharedContentCount: number;
  usersWithPrivateSenders: number;
  totalUsers: number;
  uniquePrivateSenders: number;
}

interface PrivacyStatsCardProps {
  stats: PrivacyStats;
}

/**
 * Privacy Statistics Card Grid
 * Story 7.3: Task 4.2 - Public/private content statistics
 *
 * Displays 4 stat cards showing:
 * 1. Public newsletters count
 * 2. Private newsletters count
 * 3. Users with private senders
 * 4. Shared content entries (deduplicated)
 */
export function PrivacyStatsCard({ stats }: PrivacyStatsCardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Public Newsletters</CardTitle>
          <Unlock className="h-4 w-4 text-green-600" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {stats.publicNewsletters.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">{100 - stats.privatePercentage}% of total</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Private Newsletters</CardTitle>
          <Lock className="h-4 w-4 text-yellow-600" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">
            {stats.privateNewsletters.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">{stats.privatePercentage}% of total</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Users with Private Senders</CardTitle>
          <Users className="h-4 w-4 text-blue-600" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {stats.usersWithPrivateSenders.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            of {stats.totalUsers.toLocaleString()} total users
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Shared Content Entries</CardTitle>
          <Database className="h-4 w-4 text-purple-600" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">
            {stats.sharedContentCount.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">deduplicated content</p>
        </CardContent>
      </Card>
    </div>
  );
}
