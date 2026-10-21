import { LocalUser } from "./localUser";
import { DBCategory, DBItem } from "./preload";
import { DownloadProgress } from "./update";

declare global {
  interface Window {
    electronAPI?: {
      // Window control
      controlWindow: (action: "minimize" | "maximize" | "close") => void;
    };

    debug: {
      enable: () => void;
      disable: () => void;
      onSet: (callback: (value: boolean) => void) => void;
    };
  }
}
