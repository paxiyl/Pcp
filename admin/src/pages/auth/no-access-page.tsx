import { ShieldAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useLogout } from "@/features/auth/use-auth";
import { useSession } from "@/features/auth/use-session";

/** Signed in, but not as an admin: logging in again would not change that. */
export function NoAccessPage() {
  const { user } = useSession();
  const logout = useLogout();

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <Empty className="max-w-md">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldAlertIcon />
          </EmptyMedia>
          <EmptyTitle>No access to the backoffice</EmptyTitle>
          <EmptyDescription>
            {user
              ? `${user.name} is signed in as a ${user.role}. Only admin accounts can open the backoffice.`
              : "Only admin accounts can open the backoffice."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={() => logout.mutate()}>
            Sign out
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
