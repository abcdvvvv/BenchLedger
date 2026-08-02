import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildUISettingsURL,
  persistedUISettings,
  readUISettings,
  settingsForDatasetSource,
  settingsWithURLState,
  UI_SETTINGS_STORAGE_KEY,
  type ActivePage,
  type ThemeMode,
  type UISettings
} from "../lib/dashboard-settings";

export type SetUISetting = <K extends keyof UISettings>(key: K, value: UISettings[K]) => void;

type UseStoredUISettingsResult = {
  settings: UISettings;
  setSetting: SetUISetting;
  navigateToPage: (page: ActivePage) => void;
  setDatasetSource: (selectedDatabaseId: string, resetDatasetScope: boolean) => void;
};

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

function settingsValueEqual(left: UISettings[keyof UISettings], right: UISettings[keyof UISettings]): boolean {
  if (Object.is(left, right)) return true;
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function settingsEqual(left: UISettings, right: UISettings): boolean {
  return (Object.keys(left) as (keyof UISettings)[]).every(
    (key) => settingsValueEqual(left[key], right[key])
  );
}

function currentBrowserURL(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function useStoredUISettings(): UseStoredUISettingsResult {
  const [settings, setSettings] = useState<UISettings>(readUISettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  const persistedSettingsJSON = useMemo(
    () => JSON.stringify(persistedUISettings(settings)),
    [settings]
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(UI_SETTINGS_STORAGE_KEY, persistedSettingsJSON);
    } catch {
      // Persistence is optional. The in-memory settings remain authoritative for this session.
    }
  }, [persistedSettingsJSON]);

  useEffect(() => {
    const nextURL = buildUISettingsURL(settings, window.location.href);
    if (nextURL !== currentBrowserURL()) window.history.replaceState(null, "", nextURL);
  }, [
    settings.activePage,
    settings.compareBaselineConfigurationKey,
    settings.compareBenchmarkKey,
    settings.compareMetricKey,
    settings.compareVariableCategory,
    settings.compareVariableFieldPathIds
  ]);

  useEffect(() => {
    function handlePopState() {
      setSettings((current) => {
        const next = settingsWithURLState(current, window.location.search);
        if (settingsEqual(current, next)) return current;
        settingsRef.current = next;
        return next;
      });
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const setSetting: SetUISetting = useCallback(<K extends keyof UISettings>(key: K, value: UISettings[K]) => {
    setSettings((current) => {
      if (settingsValueEqual(current[key], value)) return current;
      const next: UISettings = {
        ...current,
        [key]: value
      };
      settingsRef.current = next;
      return next;
    });
  }, []);

  const navigateToPage = useCallback((page: ActivePage) => {
    const current = settingsRef.current;
    if (current.activePage === page) return;
    const next = { ...current, activePage: page };
    const nextURL = buildUISettingsURL(next, window.location.href);
    if (nextURL !== currentBrowserURL()) window.history.pushState(null, "", nextURL);
    settingsRef.current = next;
    setSettings(next);
  }, []);

  const setDatasetSource = useCallback((selectedDatabaseId: string, resetDatasetScope: boolean) => {
    setSettings((current) => {
      const next = resetDatasetScope
        ? settingsForDatasetSource(current, selectedDatabaseId)
        : current.selectedDatabaseId === selectedDatabaseId
          ? current
          : { ...current, selectedDatabaseId };
      if (settingsEqual(current, next)) return current;
      settingsRef.current = next;
      return next;
    });
  }, []);

  return {
    settings,
    setSetting,
    navigateToPage,
    setDatasetSource
  };
}
