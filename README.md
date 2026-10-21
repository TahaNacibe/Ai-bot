# Local AI Chat Desktop

The desktop renderer is a native React, TypeScript, and Vite application styled with Tailwind CSS and shadcn-style components. Its chat and settings pages use the same local Python API and stored personas as the browser client; the Electron window does not load the browser app.

## Requirements

- Node.js and npm
- Python with the packages in the repository's `requirements.txt`
- Ollama with a supported model installed

The desktop package includes the Python server source, its app modules, the browser client assets, requirements files, and default personas. It uses the system Python installation rather than bundling Python itself. Set `PYTHON_EXECUTABLE` if Python is not available as `python` (Windows) or `python3` (macOS/Linux).

Packaged persona changes are saved under Electron's per-user application data directory. The browser app continues to be served independently by the repository's Python server.

## Commands

Run from this directory:

```sh
npm install
npm run desktop:dev
npm run desktop:build
```

The desktop app starts the local API on `127.0.0.1:8000` and shows its server status in the app header. Desktop-only API CORS origins are restricted to the packaged Electron renderer and its Vite development origin. `npm run build` builds the React renderer and Electron entrypoints without creating an installer.
