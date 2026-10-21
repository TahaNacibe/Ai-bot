let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("electronAPI", { controlWindow: (action) => {
	electron.ipcRenderer.send("window-control", action);
} });
//#endregion
