declare global {
  interface Window {
    electronAPI?: {
      apiBaseUrl: string;
      controlWindow: (action: "minimize" | "maximize" | "close") => void;
      onServerStatus: (callback: (status: { state: string; detail: string }) => void) => () => void;
      getServerStatus: () => Promise<{ state: string; detail: string }>;
      restartServer: () => Promise<boolean>;
    };
  }
}

export {};
