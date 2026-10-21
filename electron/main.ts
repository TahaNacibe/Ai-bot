import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import { spawn, ChildProcess } from "child_process";
import { request } from "http";
import { randomUUID } from "crypto";

let win: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let serverToken = "";
let quitting = false;
let currentStatus = { state: "starting", detail: "Starting the local server…" };

const projectRoot = app.isPackaged
  ? process.resourcesPath
  : path.resolve(__dirname, "..");
const serverScript = path.join(projectRoot, "server.py");
const serverUrl = "http://127.0.0.1:8000";

function getPersonaDirectory() {
  if (!app.isPackaged) return path.join(projectRoot, "personas");
  const sourceDirectory = path.join(projectRoot, "personas");
  const targetDirectory = path.join(app.getPath("userData"), "personas");
  fs.mkdirSync(targetDirectory, { recursive: true });
  for (const name of fs.readdirSync(sourceDirectory)) {
    if (!name.endsWith(".md")) continue;
    const target = path.join(targetDirectory, name);
    if (!fs.existsSync(target)) fs.copyFileSync(path.join(sourceDirectory, name), target);
  }
  return targetDirectory;
}

function reportServerStatus(state: string, detail = "") {
  currentStatus = { state, detail };
  win?.webContents.send("server-status", { state, detail });
}

async function stopServer() {
  const child = serverProcess;
  if (!child || child.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(killTimeout);
      clearTimeout(finalTimeout);
      child.removeListener("exit", finish);
      resolve();
    };
    const killTimeout = setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    }, 3000);
    const finalTimeout = setTimeout(finish, 6000);
    child.once("exit", finish);
    if (!child.killed) child.kill();
  });
  if (serverProcess === child) serverProcess = null;
}

function isServerReady(token: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = request(`${serverUrl}/api/health`, { method: "GET", timeout: 1000 }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => { body += chunk; });
      response.on("end", () => {
        try {
          resolve(response.statusCode === 200 && JSON.parse(body).instance === token);
        } catch {
          resolve(false);
        }
      });
    });
    probe.on("timeout", () => {
      probe.destroy();
      resolve(false);
    });
    probe.on("error", () => resolve(false));
    probe.end();
  });
}

async function waitForServer(processToWatch: ChildProcess, token: string, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (processToWatch.exitCode !== null) {
      throw new Error(`The server exited with code ${processToWatch.exitCode}.`);
    }
    if (await isServerReady(token)) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("The local server did not become ready within 30 seconds.");
}

async function startServer() {
  if (serverProcess && serverProcess.exitCode === null) {
    await waitForServer(serverProcess, serverToken);
    return;
  }

  reportServerStatus("starting", "Starting the local server…");
  const pythonExecutable = process.env.PYTHON_EXECUTABLE
    || (process.platform === "win32" ? "python" : "python3");
  serverToken = randomUUID();

  const child = spawn(pythonExecutable, [serverScript], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PYTHONPATH: projectRoot,
      AI_TUBE_PERSONAS_DIR: getPersonaDirectory(),
      AI_TUBE_ALLOWED_ORIGINS: "null,http://localhost:5173,http://127.0.0.1:5173",
      AI_TUBE_SERVER_TOKEN: serverToken,
      HOST: "127.0.0.1",
      PORT: "8000",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  serverProcess = child;

  child.stdout?.on("data", (data: Buffer) => console.log(`[SERVER] ${String(data).trimEnd()}`));
  child.stderr?.on("data", (data: Buffer) => console.error(`[SERVER] ${String(data).trimEnd()}`));
  child.on("error", (error) => {
    console.error("[SERVER] failed to start:", error);
    reportServerStatus("error", error.message);
  });
  child.on("exit", (code, signal) => {
    if (serverProcess === child) serverProcess = null;
    const detail = `Server exited${code === null ? ` (${signal || "unknown signal"})` : ` with code ${code}`}.`;
    console.log(`[SERVER] ${detail}`);
    reportServerStatus(quitting ? "stopped" : "error", detail);
  });

  try {
    await Promise.race([
      waitForServer(child, serverToken),
      new Promise<never>((_resolve, reject) => child.once("error", reject)),
    ]);
    reportServerStatus("running", `Local server running at ${serverUrl}`);
  } catch (error) {
    reportServerStatus("error", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function loadAppUrl() {
  try {
    await startServer();
    if (process.env.NODE_ENV === "development") {
      await win?.loadURL("http://localhost:5173");
    } else {
      await win?.loadFile(path.join(__dirname, "../dist-vite/index.html"));
    }
  } catch (error) {
    console.error("[MAIN] local server startup failed:", error);
    reportServerStatus("error", error instanceof Error ? error.message : String(error));
    await win?.loadFile(path.join(__dirname, "server-error.html"));
    throw error;
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minHeight: 480,
    minWidth: 700,
    title: "Local AI Chat",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.once("ready-to-show", () => win?.show());
  ipcMain.removeAllListeners("window-control");
  ipcMain.on("window-control", (_event, action: string) => {
    if (action === "minimize") win?.minimize();
    if (action === "maximize") {
      if (win?.isMaximized()) win.unmaximize();
      else win?.maximize();
    }
    if (action === "close") win?.close();
  });
  void loadAppUrl().catch((error) => console.error("[MAIN] renderer could not load:", error));
  win.on("closed", () => {
    win = null;
  });
}

ipcMain.handle("server-restart", async () => {
  await stopServer();
  await loadAppUrl();
  return true;
});
ipcMain.handle("server-status", () => currentStatus);

app.on("before-quit", () => {
  quitting = true;
  void stopServer();
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
