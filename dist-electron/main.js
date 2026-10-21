//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let electron = require("electron");
let path = require("path");
path = __toESM(path);
//#region electron/main.ts
var isDev = process.env.NODE_ENV === "development";
var win = null;
function createWindow() {
	win = new electron.BrowserWindow({
		width: 800,
		height: 600,
		minHeight: 400,
		minWidth: 600,
		frame: false,
		show: false,
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.default.join(__dirname, "preload.js")
		}
	});
	win.once("ready-to-show", () => win?.show());
	electron.ipcMain.on("window-control", (event, action) => {
		switch (action) {
			case "minimize":
				win?.minimize();
				break;
			case "maximize":
				if (win?.isMaximized()) win.unmaximize();
				else win?.maximize();
				break;
			case "close":
				win?.close();
				break;
		}
	});
	win.loadURL(isDev ? "http://localhost:5173" : `file://${path.default.join(__dirname, "../dist-vite/index.html")}`).catch((err) => {
		console.error("[MAIN] loadURL failed:", err);
		win?.show();
	});
	win.on("closed", () => {
		win = null;
	});
}
electron.app.whenReady().then(() => {
	createWindow();
	electron.app.on("activate", () => {
		if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});
electron.app.on("window-all-closed", () => {
	if (process.platform !== "darwin") electron.app.quit();
});
//#endregion
