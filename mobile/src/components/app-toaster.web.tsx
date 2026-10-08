import type { CSSProperties } from "react";
import { Toaster } from "sonner";

type Props = {
  background: string;
  border: string;
  foreground: string;
  muted: string;
  theme: "light" | "dark" | "system";
};

export function AppToaster({ background, border, foreground, muted, theme }: Props) {
  return (
    <Toaster
      closeButton
      richColors
      position="top-center"
      theme={theme}
      toastOptions={{
        style: {
          "--normal-bg": background,
          "--normal-border": border,
          "--normal-text": foreground,
          "--description-color": muted,
          borderRadius: "16px",
        } as CSSProperties,
      }}
    />
  );
}
