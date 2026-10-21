import { Maximize, Minus, X } from "lucide-react";
import { ReactNode } from "react";

export default function CustomTitleBar({ children }: { children: ReactNode }) {
  const handleWindow = (action: "minimize" | "maximize" | "close") => {
    window.electronAPI?.controlWindow(action);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Titlebar */}
      <div
        className="flex items-center justify-between bg-background border-b"
        style={{ WebkitAppRegion: "drag" } as any}
      >
        <div className="text-sm font-medium pl-3">Electron App</div>
        <div
          className="flex items-center"
          style={{ WebkitAppRegion: "no-drag" } as any}
        >
          <button
            onClick={() => handleWindow("minimize")}
            className="hover:bg-gray-200/50 px-3.5 py-2"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={() => handleWindow("maximize")}
            className="hover:bg-gray-200/50 px-3.5 py-2"
          >
            <Maximize size={16} />
          </button>
          <button
            onClick={() => handleWindow("close")}
            className="hover:bg-red-700 px-3.5 py-2"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
