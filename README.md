# Local AI Chat Desktop

The desktop renderer is a native React, TypeScript, and Vite application styled with Tailwind CSS and shadcn-style components. Its chat and settings pages use the same local Python API and stored personas as the browser client; the Electron window does not load the browser app.

## Requirements

- Node.js and npm
- Python with the packages in the repository's `requirements.txt`
- Ollama with a supported model installed

The desktop package includes the Python server source, its app modules, the browser client assets, requirements files, and default personas. It uses the system Python installation rather than bundling Python itself. Run `.\restore-dependencies.ps1` from the workspace root to install project dependencies; during development, Electron uses the local `.venv` when available. Set `PYTHON_EXECUTABLE` to override the Python executable, or if Python is not available as `python` (Windows) or `python3` (macOS/Linux).

Packaged persona changes are saved under Electron's per-user application data directory. To run the browser app separately, start `python server.py` from this directory; it serves the included web client and API.

## Commands

Run from this directory:

```sh
npm install
npm run desktop:dev
npm run desktop:build
```

The desktop app starts the API on port `8000` and shows its server status in the app header. It listens on all network interfaces so the Flutter mobile app can connect over the same Wi-Fi; use the computer's LAN IP address in the mobile app (for example, `http://192.168.1.20:8000`). Restart the desktop app after changing this setting. The API does not authenticate clients, so only enable this on a trusted private network and do not forward the port to the internet. Desktop-only API CORS origins are restricted to the packaged Electron renderer and its Vite development origin. `npm run build` builds the React renderer and Electron entrypoints without creating an installer.
