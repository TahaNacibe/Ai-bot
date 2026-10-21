import { contextBridge, ipcRenderer } from "electron";

type ServerStatus = {
  state: "starting" | "running" | "error" | "stopped";
  detail: string;
};
type WindowAction = "minimize" | "maximize" | "close";

interface ElectronAPI {
  apiBaseUrl: string;
  controlWindow: (action: WindowAction) => void;
  onServerStatus: (callback: (status: ServerStatus) => void) => () => void;
  getServerStatus: () => Promise<ServerStatus>;
  restartServer: () => Promise<boolean>;
}

contextBridge.exposeInMainWorld("electronAPI", {
  apiBaseUrl: "http://127.0.0.1:8000",
  controlWindow: (action: WindowAction) => ipcRenderer.send("window-control", action),
  onServerStatus: (callback: (status: ServerStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: ServerStatus) => callback(status);
    ipcRenderer.on("server-status", listener);
    return () => ipcRenderer.removeListener("server-status", listener);
  },
  getServerStatus: () => ipcRenderer.invoke("server-status"),
  restartServer: () => ipcRenderer.invoke("server-restart"),
} as ElectronAPI);
