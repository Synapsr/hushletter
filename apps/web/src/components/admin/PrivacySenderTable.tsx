import { Badge, Progress, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@hushletter/ui";
import { m } from "@/paraglide/messages.js";

/**
 * Private sender from listPrivateSenders query
 */
interface PrivateSender {
  senderId: string;
  email: string;
  name: string | undefined;
  domain: string;
  usersMarkedPrivate: number;
  totalSubscribers: number;
  privatePercentage: number;
}

interface PrivacySenderTableProps {
  senders: PrivateSender[];
}

/**
 * Private Senders Table
 * Story 7.3: Task 4.3 - List of senders with privacy settings
 *
 * Displays senders that have been marked private by at least one user,
 * with aggregate counts (no individual user identities).
 */
export function PrivacySenderTable({ senders }: PrivacySenderTableProps) {
  if (senders.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8" role="status">
        {m.privacySender_noSendersMessage()}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{m.privacySender_columnSender()}</TableHead>
          <TableHead>{m.privacySender_columnDomain()}</TableHead>
          <TableHead>{m.privacySender_columnUsersMarkedPrivate()}</TableHead>
          <TableHead>{m.privacySender_columnPrivacyRatio()}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {senders.map((sender) => (
          <TableRow key={sender.senderId}>
            <TableCell>
              <div>
                <p className="font-medium">{sender.name || sender.email}</p>
                {sender.name && <p className="text-sm text-muted-foreground">{sender.email}</p>}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{sender.domain}</Badge>
            </TableCell>
            <TableCell>
              <span className="font-medium">{sender.usersMarkedPrivate}</span>
              <span className="text-muted-foreground"> / {sender.totalSubscribers}</span>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Progress
                  value={sender.privatePercentage}
                  className="w-[60px]"
                  aria-label={m.privacySender_progressLabel({ percentage: sender.privatePercentage })}
                />
                <span className="text-sm">{sender.privatePercentage}%</span>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
