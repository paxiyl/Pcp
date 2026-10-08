import { useEffect, useRef, useState } from "react";

const GIS_SRC = "https://accounts.google.com/gsi/client";

/** Set at build time. Without it there is no client to sign in against. */
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
      }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

/**
 * Cached at module level so two mounts share one script rather than racing.
 * Resolving early on an existing-but-unloaded tag would hand back a window
 * without `google` on it.
 */
let scriptPromise: Promise<void> | null = null;

const loadGoogleScript = (): Promise<void> => {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");

    script.async = true;
    script.defer = true;
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not reach Google"));
    };
    script.onload = () => resolve();
    script.src = GIS_SRC;

    document.head.appendChild(script);
  });

  return scriptPromise;
};

type Props = {
  onCredential: (idToken: string) => void;
  disabled?: boolean;
};

/**
 * Google's own button rather than one styled to match.
 *
 * Their branding terms require it, and people recognise it — a hand-drawn
 * imitation on a sign-in page is what a phishing page looks like.
 */
export function GoogleSignInButton({ onCredential, disabled }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  // Kept in a ref so re-rendering the parent never re-initialises the button.
  const handler = useRef(onCredential);

  handler.current = onCredential;

  useEffect(() => {
    if (!CLIENT_ID) return;

    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !container.current || !window.google) return;

        window.google.accounts.id.initialize({
          callback: (response) => handler.current(response.credential),
          client_id: CLIENT_ID,
        });

        window.google.accounts.id.renderButton(container.current, {
          logo_alignment: "center",
          shape: "rectangular",
          size: "large",
          text: "continue_with",
          theme: "outline",
          width: 320,
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!CLIENT_ID) return null;

  if (failed) {
    return (
      <p className="text-muted-foreground text-center text-sm">
        Google sign-in is unavailable right now. Use your email and password.
      </p>
    );
  }

  return <div className={disabled ? "pointer-events-none opacity-60" : ""} ref={container} />;
}
