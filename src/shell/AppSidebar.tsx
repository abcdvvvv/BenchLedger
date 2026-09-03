import { useEffect, useRef, useState } from "react";
import { FiDatabase } from "react-icons/fi";
import { formatDate } from "../lib/format";
import { App_Page_Definitions } from "../app/pageRegistry";
import { databaseTitle, metadataTitle, sourceSummary } from "../lib/dashboard-data";
import type { ActivePage, ThemeMode } from "../lib/dashboard-settings";
import type {
  BenchLedgerManifestDatabase,
  LoadedBenchmarkDatabase
} from "../lib/types";
import { buttonClassName } from "../components/ui/Button";
import { SelectField } from "../components/ui/Field";
import { IconButton } from "../components/ui/IconButton";
import { cn } from "../components/ui/cn";
import { resolveSafeUserUrl } from "../lib/url";
import type { SidebarMode } from "./layoutConfig";

type AppSidebarProps = {
  mode: SidebarMode;
  activePage: ActivePage;
  onPageChange: (page: ActivePage) => void;
  sourceDatabases: BenchLedgerManifestDatabase[];
  selectedDatabaseId: string;
  onDatabaseChange: (databaseId: string) => void | Promise<void>;
  database: LoadedBenchmarkDatabase | null;
  theme: ThemeMode;
  assetBaseUrl: string;
  siteTitle: string;
  onRequestClose: (restoreFocus?: boolean) => void;
};


function DatabaseSelect(props: {
  databases: BenchLedgerManifestDatabase[];
  selectedDatabaseId: string;
  localFileActive: boolean;
  onChange: (databaseId: string) => void | Promise<void>;
}) {
  const value = props.localFileActive ? "" : props.selectedDatabaseId;
  return (
    <SelectField
      value={value}
      onChange={(event) => {
        void props.onChange(event.target.value);
      }}
    >
      {props.localFileActive ? <option value="" disabled>Local SQLite file</option> : null}
      {!props.localFileActive && !value ? <option value="" disabled>Select database</option> : null}
      {props.databases.map((database) => (
        <option key={database.id} value={database.id}>{databaseTitle(database)}</option>
      ))}
    </SelectField>
  );
}

export function AppSidebar(props: AppSidebarProps) {
  const {
    mode,
    activePage,
    onPageChange,
    sourceDatabases,
    selectedDatabaseId,
    onDatabaseChange,
    database,
    theme,
    assetBaseUrl,
    siteTitle,
    onRequestClose
  } = props;
  const currentMetadata = database?.metadata ?? null;
  const defaultLogoSrc = `${assetBaseUrl}${theme === "dark" ? "LightLogo.png" : "DarkLogo.png"}`;
  const defaultLogoHref = "https://github.com/abcdvvvv/BenchLedger";
  const customLogoUrl = theme === "dark"
    ? currentMetadata?.logo_url_dark.trim() || currentMetadata?.logo_url.trim() || ""
    : currentMetadata?.logo_url.trim() || "";
  const customProjectUrl = currentMetadata?.project_url.trim() || "";
  const resolvedCustomLogoUrl = resolveSafeUserUrl(customLogoUrl, window.location.href);
  const resolvedCustomProjectUrl = resolveSafeUserUrl(customProjectUrl, window.location.href);
  const [brandLogoKind, setBrandLogoKind] = useState<"rectangular" | "square">("rectangular");
  const [customLogoFailed, setCustomLogoFailed] = useState(false);
  const [databasePickerOpen, setDatabasePickerOpen] = useState(false);
  const databasePickerRef = useRef<HTMLDivElement | null>(null);
  const databasePickerButtonRef = useRef<HTMLButtonElement | null>(null);

  const iconMode = mode === "icon";
  const localFileActive = Boolean(database && !database.source_url);
  const canChooseDatabase = sourceDatabases.length > 1 || (sourceDatabases.length > 0 && (!database || localFileActive));

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

    const frame = window.requestAnimationFrame(() => {
      databasePickerRef.current?.querySelector<HTMLSelectElement>("select")?.focus();
    });

    function handlePointerDown(event: PointerEvent) {
      if (!databasePickerRef.current?.contains(event.target as Node)) {
        setDatabasePickerOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setDatabasePickerOpen(false);
      window.requestAnimationFrame(() => databasePickerButtonRef.current?.focus());
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [databasePickerOpen]);

  const isCustomLogo = Boolean(resolvedCustomLogoUrl) && !customLogoFailed;
  const brandHref = isCustomLogo ? resolvedCustomProjectUrl : defaultLogoHref;
  const brandLogoSrc = isCustomLogo ? resolvedCustomLogoUrl! : defaultLogoSrc;
  const brandName = currentMetadata ? metadataTitle(currentMetadata) : siteTitle;
  const isSquareLogo = isCustomLogo && brandLogoKind === "square";

  function navigateTo(page: ActivePage) {
    onPageChange(page);
    if (mode === "drawer") {
      onRequestClose(false);
    }
  }

  return (
    <aside
      aria-label="Application sidebar"
      className={cn(
        "flex h-full flex-col overflow-y-auto",
        iconMode ? "items-center gap-4 px-3 py-4" : "gap-6 p-4 sm:p-5 lg:sticky lg:top-0 lg:h-screen lg:p-6",
        mode === "drawer" && "pt-16 sm:pt-16"
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
        {!iconMode ? <div className="type-eyebrow px-1">Navigation</div> : null}
        <nav aria-label="Primary navigation" className="grid grid-cols-1 gap-1">
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
                  aria-current={active ? "page" : undefined}
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

      {!iconMode && canChooseDatabase ? (
        <div className="surface-card pad-panel space-y-3">
          <div className="type-eyebrow">Data Source</div>
          <label className="flex flex-col gap-2">
            <span className="type-label">Database</span>
            <DatabaseSelect
              databases={sourceDatabases}
              selectedDatabaseId={selectedDatabaseId}
              localFileActive={localFileActive}
              onChange={onDatabaseChange}
            />
          </label>
        </div>
      ) : null}

      {!iconMode ? (
        <div className="surface-card pad-panel mt-auto">
          <div className="type-card-title flex items-center gap-2">
            <FiDatabase className="size-4" aria-hidden="true" />
            Source
          </div>
          <p className="type-body mt-2">{sourceSummary(database)}</p>
          {currentMetadata?.updated_at ? (
            <p className="type-meta mt-2">Updated {formatDate(currentMetadata.updated_at)}</p>
          ) : null}
        </div>
      ) : null}

      {iconMode && canChooseDatabase ? (
        <div className="mt-auto w-full">
          <div ref={databasePickerRef} className="relative">
            <IconButton
              buttonRef={databasePickerButtonRef}
              onClick={() => setDatabasePickerOpen((current) => !current)}
              label="Choose database"
              aria-haspopup="dialog"
              aria-expanded={databasePickerOpen}
              aria-controls="sidebar-database-picker"
              className="w-full"
            >
              <FiDatabase className="size-5" aria-hidden="true" />
            </IconButton>
            {databasePickerOpen ? (
              <div
                id="sidebar-database-picker"
                role="dialog"
                aria-label="Choose database"
                className="surface-floating pad-panel absolute bottom-0 left-full z-30 ml-3 w-64"
              >
                <div className="type-eyebrow">Data Source</div>
                <label className="mt-3 flex flex-col gap-2">
                  <span className="type-label">Database</span>
                  <DatabaseSelect
                    databases={sourceDatabases}
                    selectedDatabaseId={selectedDatabaseId}
                    localFileActive={localFileActive}
                    onChange={(databaseId) => {
                      setDatabasePickerOpen(false);
                      return onDatabaseChange(databaseId);
                    }}
                  />
                </label>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
