import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";

const isDev = process.env.NODE_ENV === "development";
let win: BrowserWindow | null = null;

//================ CREATE WINDOW =================//
function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    minHeight: 400,
    minWidth: 600,
    frame: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.once("ready-to-show", () => win?.show());

  // Basic window controls
  ipcMain.on("window-control", (event, action) => {
    switch (action) {
      case "minimize":
        win?.minimize();
        break;
      case "maximize":
        if (win?.isMaximized()) {
          win.unmaximize();
        } else {
          win?.maximize();
        }
        break;
      case "close":
        win?.close();
        break;
    }
  });

  win
    .loadURL(
      isDev
        ? "http://localhost:5173"
        : `file://${path.join(__dirname, "../dist-vite/index.html")}`,
    )
    .catch((err) => {
      console.error("[MAIN] loadURL failed:", err);
      win?.show();
    });

  win.on("closed", () => {
    win = null;
  });
}

//================ APP LIFECYCLE =================//
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
