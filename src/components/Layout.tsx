import CustomTitleBar from "./controller";
import { ThemeProvider } from "next-themes";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="theme"
    >
      <CustomTitleBar>{children}</CustomTitleBar>
    </ThemeProvider>
  );
}
