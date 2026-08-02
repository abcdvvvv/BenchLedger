import { useCallback } from "react";
import type { UISettings } from "../lib/dashboard-settings";
import type { SetUISetting } from "./useStoredUISettings";

export function useUISettingSetter<K extends keyof UISettings>(
  setSetting: SetUISetting,
  key: K
): (value: UISettings[K]) => void {
  return useCallback((value: UISettings[K]) => {
    setSetting(key, value);
  }, [key, setSetting]);
}
