import { Spinner } from "@/components/ui/spinner";
import { Wordmark } from "@/components/wordmark";

/** Held while /auth/me decides whether there is a session. */
export function SessionLoading() {
  return (
    <div className="flex flex-col gap-4 min-h-svh items-center justify-center bg-background">
      <Wordmark 
      className="text-primary" 
      size="lg"
      />
      <Spinner className="size-8 text-muted-foreground" />
    </div>
  );
}
