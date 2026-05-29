import {
  getWardrobeUploadProcessingErrorMessage,
  type WardrobeUploadProcessingCleanup,
  type WardrobeUploadProcessingEvent,
  type WardrobeUploadProcessingResult,
  type WardrobeUploadProcessingSource,
} from "./wardrobeUploadProcessingCore.js";

type WardrobeUploadProcessingSend = (
  message: unknown,
  callback?: () => void,
) => unknown;

function sendProcessingEvent(
  sendImpl: WardrobeUploadProcessingSend | undefined,
  event: Omit<WardrobeUploadProcessingEvent, "type">,
) {
  sendImpl?.({ ...event, type: "event" });
}

function buildFailedProcessingResult({
  analysis,
  cleanup,
  error,
  inputIndex,
  source,
}: {
  analysis: WardrobeUploadProcessingResult["analysis"];
  cleanup: WardrobeUploadProcessingCleanup | null;
  error: unknown;
  inputIndex: number;
  source: WardrobeUploadProcessingSource | null;
}): WardrobeUploadProcessingResult {
  return {
    analysis,
    cleanup,
    inputIndex,
    ok: false,
    source,
    ...getWardrobeUploadProcessingErrorMessage(error),
  };
}

export { buildFailedProcessingResult, sendProcessingEvent };
export type { WardrobeUploadProcessingSend };
