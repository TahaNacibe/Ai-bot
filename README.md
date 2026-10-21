# Electron + React + TypeScript Template

A modern, clean template for building desktop applications with Electron, React, TypeScript, and Tailwind CSS. This template provides a solid foundation with hot reloading, custom title bar, internationalization support, and a responsive UI.

## 🚀 Features

- **Electron**: Cross-platform desktop app framework
- **React 19**: Latest React with modern hooks and concurrent features
- **TypeScript**: Full type safety throughout the application
- **Vite**: Lightning-fast build tool with hot module replacement
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development
- **Custom Title Bar**: Native-looking window controls with drag regions
- **Internationalization**: Built-in i18n support with English and Arabic locales
- **Theme Support**: Dark/light mode with system preference detection
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **ESLint**: Code linting with TypeScript support
- **IPC Communication**: Secure inter-process communication between main and renderer processes

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 18 or higher) - [Download here](https://nodejs.org/)
- **npm** or **yarn** package manager
- **Git** for version control

### Windows Specific

- Windows 10 or later
- Visual Studio Build Tools (for native modules, if needed)

### macOS Specific

- macOS 10.13 or later
- Xcode Command Line Tools: `xcode-select --install`

### Linux Specific

- Ubuntu 18.04+ or equivalent
- Build essentials: `sudo apt-get install build-essential`

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd electron-react-template
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run vite:dev
   ```

The application will open automatically. The Vite dev server provides hot reloading for both the React frontend and Electron main process.

## 📜 Available Scripts

| Command              | Description                                      |
| -------------------- | ------------------------------------------------ |
| `npm run dev`        | Start Vite dev server only                       |
| `npm run vite:dev`   | Start full development environment (recommended) |
| `npm run build`      | Build for production                             |
| `npm run vite:build` | Build and package the Electron app               |

## 🏗️ Project Structure

```
electron-react-template/
├── electron/                 # Electron main process
│   ├── main.ts              # Application entry point
│   ├── preload.ts           # Secure API bridge
│   ├── ipc/                 # IPC handlers (extensible)
│   ├── services/            # Business logic services
│   │   ├── dataStore.ts     # Data management
│   │   └── db/              # Database configuration
│   └── types.ts             # TypeScript definitions
├── src/                     # React renderer process
│   ├── app/                 # Main application pages
│   │   └── page.tsx         # Home page component
│   ├── components/          # Reusable UI components
│   │   ├── controller.tsx   # Custom title bar
│   │   ├── Layout.tsx       # App layout wrapper
│   │   └── underDevelopments.tsx # Development placeholder
│   ├── hooks/               # Custom React hooks
│   │   ├── useAppTheme.ts   # Theme management
│   │   ├── useAppLanguage.ts # Language switching
│   │   └── use-mobile.ts     # Responsive breakpoints
│   ├── locales/             # Internationalization files
│   │   ├── en/              # English translations
│   │   └── ar/              # Arabic translations
│   ├── lib/                 # Utility functions
│   ├── App.tsx              # Root React component
│   └── main.tsx             # React entry point
├── public/                  # Static assets
├── dist/                    # Build output (generated)
├── package.json             # Project configuration
├── vite.config.ts           # Vite configuration
├── tailwind.config.ts       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
└── eslint.config.js         # ESLint configuration
```

## 🎨 Customization

### Adding New Pages

1. Create a new component in `src/app/`
2. Add routing logic in your main app component
3. Update navigation if needed

### IPC Communication

To add new IPC channels:

1. Define the channel in `electron/types.ts`
2. Implement the handler in `electron/ipc/`
3. Expose the API in `electron/preload.ts`
4. Use the API in your React components

Example:

```typescript
// electron/types.ts
export interface IElectronAPI {
  // existing APIs...
  newFeature: (data: string) => Promise<string>;
}

// electron/ipc/newFeature.ts
import { ipcMain } from "electron";

ipcMain.handle("new-feature", async (event, data: string) => {
  // Your logic here
  return `Processed: ${data}`;
});

// electron/preload.ts
contextBridge.exposeInMainWorld("electronAPI", {
  // existing APIs...
  newFeature: (data: string) => ipcRenderer.invoke("new-feature", data),
});
```

### Styling with Tailwind

The template uses Tailwind CSS v4 with custom configuration. Key features:

- **Utility Classes**: Use Tailwind's utility-first approach
- **Custom Components**: Extend with `@apply` directive
- **Theme Variables**: Customize colors, fonts, and spacing in `tailwind.config.ts`
- **Dark Mode**: Automatic dark/light mode switching

### Internationalization

The app supports multiple languages out of the box:

- **English** (default)
- **Arabic** (RTL support included)

To add a new language:

1. Create a new folder in `src/locales/`
2. Add `translation.json` with your translations
3. Update `src/i18n.ts` configuration

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Development
NODE_ENV=development

# App Configuration
APP_NAME=Your App Name
APP_VERSION=1.0.0

# API Keys (if needed)
API_KEY=your-api-key
```

### Build Configuration

Modify `package.json` build settings:

```json
{
  "build": {
    "appId": "com.yourcompany.your-app-name",
    "productName": "Your App Name",
    "directories": {
      "output": "release"
    },
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "mac": {
      "target": "dmg",
      "icon": "assets/icon.icns"
    },
    "linux": {
      "target": "AppImage",
      "icon": "assets/icon.png"
    }
  }
}
```

## 🚀 Building for Production

### Windows

```bash
npm run vite:build
```

This creates a Windows installer in the `dist/` directory.

### macOS

```bash
npm run vite:build
```

Creates a `.dmg` file for macOS distribution.

### Linux

```bash
npm run vite:build
```

Creates an AppImage for Linux distribution.

## 🐛 Troubleshooting

### Common Issues

**App won't start in development:**

- Ensure all dependencies are installed: `npm install`
- Check that port 5173 is not in use
- Verify Electron installation: `npx electron --version`

**Build fails:**

- Clear node_modules: `rm -rf node_modules && npm install`
- Clear build cache: `rm -rf dist/`
- Check Node.js version compatibility

**Hot reload not working:**

- Ensure you're using `npm run vite:dev`
- Check browser console for errors
- Verify file changes are saved

**Styling issues:**

- Ensure Tailwind CSS is properly configured
- Check for CSS conflicts
- Verify class names are correct

### Development Tips

- Use React Developer Tools for debugging
- Enable Electron DevTools with `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS)
- Check the terminal output for build errors
- Use the browser's Network tab to monitor IPC calls

## 📚 Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙋 Support

If you have questions or need help:

1. Check the [Issues](https://github.com/your-repo/issues) page
2. Create a new issue with detailed information
3. Include your environment details and error messages

---

## Happy coding! 🎉

Happy coding! 🎉
