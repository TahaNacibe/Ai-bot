import { useSession } from "@/context/session.store";
import { useEffect } from "react";

export const DebugListener = () => {
  useEffect(() => {
    if (!window?.debug?.onSet) {
      console.warn("Debug API not available yet.");
      return;
    }

    const callback = (value: boolean) => {
      useSession.getState().setDevSession(value);
    };

    window.debug.onSet(callback);

    // Optional cleanup if your API supports unsubscribe
    return () => {
      // window.debug.offSet?.(callback);
    };
  }, []);

  return null;
};