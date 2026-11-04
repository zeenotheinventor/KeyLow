/** Which part of the export went wrong: building the file, or writing it to the folder the person picked. */
export type AccountExportStep = "preparing" | "saving";

/** Where the Export my data screen is. The size is the written file's UTF-8 byte length. */
export type AccountExportState =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "ready"; sizeBytes: number }
  | { status: "saving"; sizeBytes: number }
  | { status: "saved"; sizeBytes: number; folderName: string }
  | { status: "failed"; step: AccountExportStep };

export type AccountExportEvent =
  | { type: "start" }
  | { type: "prepared"; sizeBytes: number }
  | { type: "save" }
  | { type: "pickerCancelled" }
  | { type: "savedTo"; folderName: string }
  | { type: "failedWhile"; step: AccountExportStep }
  | { type: "retry" };

export const initialAccountExportState: AccountExportState = { status: "idle" };

/**
 * The screen's states and the events between them. An event that does not belong to the state, such as a
 * late result after the screen has moved on, leaves the state as it is.
 */
export function accountExportReducer(
  state: AccountExportState,
  event: AccountExportEvent,
): AccountExportState {
  switch (event.type) {
    case "start":
      return state.status === "idle" ? { status: "preparing" } : state;
    case "prepared":
      return state.status === "preparing" ? { status: "ready", sizeBytes: event.sizeBytes } : state;
    case "save":
      return state.status === "ready" ? { status: "saving", sizeBytes: state.sizeBytes } : state;
    case "pickerCancelled":
      return state.status === "saving" ? { status: "ready", sizeBytes: state.sizeBytes } : state;
    case "savedTo":
      return state.status === "saving"
        ? { status: "saved", sizeBytes: state.sizeBytes, folderName: event.folderName }
        : state;
    case "failedWhile":
      return state.status === "preparing" || state.status === "saving"
        ? { status: "failed", step: event.step }
        : state;
    case "retry":
      return state.status === "failed" ? { status: "preparing" } : state;
  }
}
