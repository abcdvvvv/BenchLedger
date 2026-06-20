import { buildAppPages, buildSidebarProps } from "./buildAppPages";
import type { BenchLedgerAppModel } from "./appModelTypes";
import { useBenchmarkDatasetState } from "./useBenchmarkDatasetState";

export function useBenchLedgerAppModel(): BenchLedgerAppModel {
  const state = useBenchmarkDatasetState();
  function openLocalFilePicker() {
    state.fileInputRef.current?.click();
  }

  return {
    activePage: state.settings.activePage,
    phase: state.phase,
    fileInputRef: state.fileInputRef,
    handleLocalFileChange: state.handleLocalFileChange,
    siteTitle: state.siteTitle,
    sidebarProps: buildSidebarProps(state),
    pages: buildAppPages(state, openLocalFilePicker)
  };
}
