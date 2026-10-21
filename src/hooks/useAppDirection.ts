import { useState, useEffect } from "react";

export function useAppDirection() {
  const [isRTL, setIsRTL] = useState(false);

  useEffect(() => {
    // Read the current direction from the DOM
    const dir =
      document.documentElement.dir || getComputedStyle(document.documentElement).direction || "ltr";
    setIsRTL(dir === "rtl");
  }, []);

  return isRTL;
}