import { useEffect, useRef, useState } from "react";
import { FiDatabase, FiMoon, FiSun } from "react-icons/fi";
import { formatDate } from "../lib/format";
import { App_Page_Definitions } from "../app/pageRegistry";
import {
  databaseTitle,
  metadataTitle,
  sourceSummary,
  type ActivePage,
  type ThemeMode
} from "../lib/dashboard";
import type {
  BenchmarkRun,
  BenchLedgerManifestDatabase,
  BenchLedgerMetadata,
  LoadedBenchmarkDataset
} from "../lib/types";
import { buttonClassName } from "../components/ui/Button";
import { SelectField } from "../components/ui/Field";
import { IconButton } from "../components/ui/IconButton";
import { cn } from "../components/ui/cn";
import type { SidebarMode } from "./layoutConfig";

export type AppSidebarProps = {
  mode: SidebarMode;
  activePage: ActivePage;
  onPageChange: (page: ActivePage) => void;
  sourceDatabases: BenchLedgerManifestDatabase[];
  selectedDatabaseId: string;
  onDatabaseChange: (databaseId: string) => void | Promise<void>;
  dataset: LoadedBenchmarkDataset | null;
  currentMetadata: BenchLedgerMetadata | null;
  theme: ThemeMode;
  onThemeToggle: () => void;
  latestRun: BenchmarkRun | null;
  assetBaseUrl: string;
  siteTitle: string;
  onRequestClose: () => void;
};

function resolveLogoUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return null;
  try {
    return new URL(trimmed, window.location.href).toString();
  } catch {
    return null;
  }
}

export function AppSidebar(props: AppSidebarProps) {
  const {
    mode,
    activePage,
    onPageChange,
    sourceDatabases,
    selectedDatabaseId,
    onDatabaseChange,
    dataset,
    currentMetadata,
    theme,
    onThemeToggle,
    latestRun,
    assetBaseUrl,
    siteTitle,
    onRequestClose
  } = props;
  const ThemeIcon = theme === "dark" ? FiSun : FiMoon;
  const defaultLogoSrc = `${assetBaseUrl}${theme === "dark" ? "LightLogo.png" : "DarkLogo.png"}`;
  const defaultLogoHref = "https://github.com/abcdvvvv/BenchLedger";
  const customLogoUrl = theme === "dark"
    ? currentMetadata?.logo_url_dark.trim() || currentMetadata?.logo_url.trim() || ""
    : currentMetadata?.logo_url.trim() || "";
  const customProjectUrl = currentMetadata?.project_url.trim() || "";
  const resolvedCustomLogoUrl = resolveLogoUrl(customLogoUrl);
  const [brandLogoKind, setBrandLogoKind] = useState<"rectangular" | "square">("rectangular");
  const [customLogoFailed, setCustomLogoFailed] = useState(false);
  const [databasePickerOpen, setDatabasePickerOpen] = useState(false);
  const databasePickerRef = useRef<HTMLDivElement | null>(null);

  const iconMode = mode === "icon";
  const fullMode = mode !== "icon";
  const latestRunLabel = latestRun ? `${latestRun.environment_label} · ${formatDate(latestRun.measured_at)}` : dataset?.source_label ?? "No database";

  useEffect(() => {
    if (!resolvedCustomLogoUrl) {
      setBrandLogoKind("rectangular");
      return;
    }
    let cancelled = false;
    const image = new window.Image();
    image.onload = () => {
      if (cancelled) return;
      const height = image.naturalHeight || 1;
      setBrandLogoKind(image.naturalWidth / height > 1.5 ? "rectangular" : "square");
    };
    image.onerror = () => {
      if (cancelled) return;
      setBrandLogoKind("rectangular");
    };
    image.src = resolvedCustomLogoUrl;
    return () => {
      cancelled = true;
    };
  }, [resolvedCustomLogoUrl]);

  useEffect(() => {
    setCustomLogoFailed(false);
  }, [resolvedCustomLogoUrl]);

  useEffect(() => {
    if (mode !== "icon") {
      setDatabasePickerOpen(false);
    }
  }, [mode]);

  useEffect(() => {
    if (!databasePickerOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!databasePickerRef.current?.contains(event.target as Node)) {
        setDatabasePickerOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [databasePickerOpen]);

  const isCustomLogo = Boolean(resolvedCustomLogoUrl) && !customLogoFailed;
  const brandHref = isCustomLogo ? customProjectUrl : defaultLogoHref;
  const brandLogoSrc = isCustomLogo ? resolvedCustomLogoUrl! : defaultLogoSrc;
  const brandName = currentMetadata ? metadataTitle(currentMetadata) : siteTitle;
  const isSquareLogo = isCustomLogo && brandLogoKind === "square";

  function navigateTo(page: ActivePage) {
    onPageChange(page);
    if (mode === "drawer") {
      onRequestClose();
    }
  }

  return (
    <aside
      className={cn(
        "flex h-full flex-col overflow-y-auto",
        iconMode ? "items-center gap-4 px-3 py-4" : "gap-6 p-4 sm:p-5 lg:sticky lg:top-0 lg:h-screen lg:p-6"
      )}
    >
      <div
        className={cn(
          iconMode ? "flex w-full justify-center py-1" : "flex items-center gap-4 py-1"
        )}
        title={brandName}
      >
        {brandHref ? (
          <a
            className={cn(
              "shrink-0",
              iconMode ? "flex w-full justify-center" : isSquareLogo ? "size-14" : "w-full"
            )}
            href={brandHref}
            target="_blank"
            rel="noreferrer"
          >
            <img
              className={cn(
                "block h-auto max-w-full",
                iconMode ? "max-h-12 w-auto object-contain" : isSquareLogo ? "aspect-square w-full object-contain" : "max-h-20 w-full object-contain object-left"
              )}
              src={brandLogoSrc}
              alt={brandName}
              onError={() => {
                if (isCustomLogo) setCustomLogoFailed(true);
              }}
            />
          </a>
        ) : null}
        {!iconMode && isSquareLogo ? (
          <div className="min-w-0">
            <strong className="type-card-title block truncate">{brandName}</strong>
            <span className="type-meta block">Benchmark dashboard</span>
          </div>
        ) : null}
      </div>

      <div className={cn("w-full", iconMode ? "space-y-2" : "space-y-3")}>
        {fullMode ? <div className="type-eyebrow px-1">Navigation</div> : null}
        <nav className="grid grid-cols-1 gap-1">
          {App_Page_Definitions.map((item) => {
            const active = activePage === item.id;
            const Icon = item.Icon;
            return (
              <div key={item.id} className={cn(iconMode && "group relative")}>
                <button
                  type="button"
                  className={buttonClassName({
                    variant: active ? "selected" : "ghost",
                    className: cn(
                      "type-nav w-full shadow-none h-[48px]",
                      iconMode ? "justify-center px-0" : "gap-3 text-left"
                    )
                  })}
                  onClick={() => navigateTo(item.id)}
                  aria-label={item.navigationLabel}
                  title={iconMode ? item.navigationLabel : undefined}
                >
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  {iconMode ? null : <span className="min-w-0 flex-1 truncate text-left">{item.navigationLabel}</span>}
                </button>
                {iconMode ? (
                  <span className="type-caption pointer-events-none absolute left-full top-1/2 z-20 ml-3 -translate-y-1/2 whitespace-nowrap radius-theme bg-[#1a1a1e] px-2 py-1 text-stone-100 opacity-0 shadow-theme-tooltip transition group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-white dark:text-stone-900">
                    {item.navigationLabel}
                  </span>
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>

      {fullMode && sourceDatabases.length > 1 ? (
        <div className="surface-card pad-panel space-y-3">
          <div className="type-eyebrow">Data Source</div>
          <label className="flex flex-col gap-2">
            <span className="type-label">Database</span>
            <SelectField
              value={selectedDatabaseId}
              onChange={(event) => {
                void onDatabaseChange(event.target.value);
              }}
            >
              {sourceDatabases.map((database) => (
                <option key={database.id} value={database.id}>{databaseTitle(database)}</option>
              ))}
            </SelectField>
          </label>
        </div>
      ) : null}

      {fullMode ? (
        <div className="surface-card pad-panel">
          <div className="type-card-title flex items-center gap-2">
            <FiDatabase className="size-4" />
            Source
          </div>
          <p className="type-body mt-2">{sourceSummary(dataset)}</p>
          {currentMetadata?.updated_at ? (
            <p className="type-meta mt-2">Updated {formatDate(currentMetadata.updated_at)}</p>
          ) : null}
        </div>
      ) : null}

      <div className={cn("mt-auto w-full", iconMode ? "space-y-2" : "")}>
        {iconMode && sourceDatabases.length > 1 ? (
          <div ref={databasePickerRef} className="relative">
            <IconButton
              onClick={() => setDatabasePickerOpen((current) => !current)}
              label="Choose database"
              className="w-full"
            >
              <FiDatabase className="size-5" aria-hidden="true" />
            </IconButton>
            {databasePickerOpen ? (
              <div className="surface-floating pad-panel absolute bottom-0 left-full z-30 ml-3 w-64">
                <div className="type-eyebrow">Data Source</div>
                <label className="mt-3 flex flex-col gap-2">
                  <span className="type-label">Database</span>
                  <SelectField
                    value={selectedDatabaseId}
                    onChange={(event) => {
                      void onDatabaseChange(event.target.value);
                      setDatabasePickerOpen(false);
                    }}
                  >
                    {sourceDatabases.map((database) => (
                      <option key={database.id} value={database.id}>{databaseTitle(database)}</option>
                    ))}
                  </SelectField>
                </label>
              </div>
            ) : null}
          </div>
        ) : null}

        {iconMode ? (
          <div className="group relative">
            <IconButton
              onClick={onThemeToggle}
              label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              title={latestRunLabel}
            >
              <ThemeIcon className="size-4" aria-hidden="true" />
            </IconButton>
            <span className="type-caption pointer-events-none absolute left-full top-1/2 z-20 ml-3 -translate-y-1/2 whitespace-nowrap radius-theme bg-[#1a1a1e] px-2 py-1 text-stone-100 opacity-0 shadow-theme-tooltip transition group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-white dark:text-stone-900">
              {theme === "dark" ? "Light theme" : "Dark theme"}
            </span>
          </div>
        ) : (
          <div className="surface-card pad-panel flex items-center gap-3">
            <IconButton
              onClick={onThemeToggle}
              label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              <ThemeIcon className="size-4" aria-hidden="true" />
            </IconButton>
            <div className="min-w-0">
              <strong className="type-card-title block truncate">{latestRun?.environment_label ?? dataset?.source_label ?? "No database"}</strong>
              <span className="type-meta block truncate">{latestRun ? formatDate(latestRun.measured_at) : "No benchmark run"}</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
