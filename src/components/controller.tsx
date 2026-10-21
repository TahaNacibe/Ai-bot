import { Maximize, Minus, X } from "lucide-react";
import { type CSSProperties, type ReactNode } from "react";

export default function CustomTitleBar({ children }: { children: ReactNode }) {
  const handleWindow = (action: "minimize" | "maximize" | "close") => {
    window.electronAPI?.controlWindow(action);
  };

  return (
    <div className="desktop-window">
      <div
        className="window-titlebar"
        style={{ WebkitAppRegion: "drag" } as CSSProperties}
      >
        <div className="window-title">Local AI Chat <span>/ local</span></div>
        <div
          className="window-controls"
          style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
        >
          <button
            type="button"
            aria-label="Minimize window"
            onClick={() => handleWindow("minimize")}
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            aria-label="Maximize window"
            onClick={() => handleWindow("maximize")}
          >
            <Maximize size={16} />
          </button>
          <button
            type="button"
            aria-label="Close window"
            onClick={() => handleWindow("close")}
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="window-content">{children}</div>
    </div>
  );
}
