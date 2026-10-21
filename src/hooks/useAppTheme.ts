import { useTheme } from "next-themes";
import { ThemeMode } from "@/types/preferences";
import printToConsole from "@/lib/console-controller";
import { saveToStorage } from "@/services/storage/appStorage";

export function useAppTheme() {
  const { theme, resolvedTheme, setTheme: setNextTheme } = useTheme();

  function setTheme(t: ThemeMode) {
    printToConsole({
      type: "ALERT",
      preContext: "THEME STATE CHANGED",
      content: t,
    });
    setNextTheme(t);
    saveToStorage("theme", t);
  }

  return { theme, resolvedTheme, setTheme };
}
