import { useEffect, useState } from "react";
import {
  UI_SETTINGS_STORAGE_KEY,
  readUISettings,
  type ThemeMode,
  type UISettings
} from "../lib/dashboard-settings";

type UseStoredUISettingsResult = {
  settings: UISettings;
  setSetting: <K extends keyof UISettings>(key: K, value: UISettings[K]) => void;
};

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function useStoredUISettings(): UseStoredUISettingsResult {
  const [settings, setSettings] = useState<UISettings>(readUISettings);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    window.localStorage.setItem(UI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  function setSetting<K extends keyof UISettings>(key: K, value: UISettings[K]) {
    setSettings((current) => (
      Object.is(current[key], value)
        ? current
        : {
            ...current,
            [key]: value
          }
    ));
  }

  return {
    settings,
    setSetting
  };
}
