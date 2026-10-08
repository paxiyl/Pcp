import { Toaster } from "sonner-native";

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
          backgroundColor: background,
          borderColor: border,
          borderRadius: 16,
          borderWidth: 1,
        },
        titleStyle: { color: foreground, fontFamily: "Inter_600SemiBold" },
        descriptionStyle: { color: muted, fontFamily: "Inter_400Regular" },
      }}
    />
  );
}
