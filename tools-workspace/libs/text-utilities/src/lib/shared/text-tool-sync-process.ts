declare global {
  // eslint-disable-next-line no-var
  var __TEXT_TOOL_SYNC_PROCESS__: boolean | undefined;
}

/** When true, text tools run input processing without debounce (unit tests). */
export function isTextToolSyncProcessMode(): boolean {
  return globalThis.__TEXT_TOOL_SYNC_PROCESS__ === true;
}

export function enableTextToolSyncProcessForTests(): void {
  globalThis.__TEXT_TOOL_SYNC_PROCESS__ = true;
}
