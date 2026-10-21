import { contextBridge, ipcRenderer } from "electron";

//================== TYPES ==================//
type WindowAction = "minimize" | "maximize" | "close";

interface ElectronAPI {
  controlWindow: (action: WindowAction) => void;
}

//================== ELECTRON API ==================//
contextBridge.exposeInMainWorld("electronAPI", {
  controlWindow: (action: WindowAction) => {
    ipcRenderer.send("window-control", action);
  },
} as ElectronAPI);
