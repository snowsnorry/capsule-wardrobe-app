import { getCsrfHeader } from "./request";
import { outfitIdPath, outfitUrl } from "./outfitApiPaths";
import {
  FatalError,
  loadFetchEventSource,
  parseEventPayload,
  type OutfitEventSourceMessage,
  type OutfitStreamResponse,
} from "./outfitEventStreams";
import type { OutfitReport } from "../app/appTypes";

type OutfitReportResponse = {
  ok: true;
  report: OutfitReport;
};
type OutfitReportStreamResponse = OutfitStreamResponse;

async function generateOutfitReport(id: string): Promise<OutfitReportResponse> {
  const fetchEventSource = await loadFetchEventSource();
  let completePayload: OutfitReportResponse | null = null;

  await fetchEventSource(outfitUrl(`${outfitIdPath(id)}/report`), {
    method: "POST",
    credentials: "include",
    headers: getCsrfHeader(),
    openWhenHidden: true,
    async onopen(response: OutfitReportStreamResponse) {
      const contentType = (
        response.headers.get("content-type") || ""
      ).toLowerCase();
      if (response.ok && contentType.includes("text/event-stream")) {
        return;
      }

      throw new FatalError(`request_failed_${response.status}`);
    },
    onmessage(event: OutfitEventSourceMessage) {
      const payload = parseEventPayload(event.data);
      if (event.event === "progress") {
        return;
      }

      if (event.event === "complete") {
        if (payload.ok !== true || !payload.report) {
          throw new FatalError("invalid_event_payload");
        }
        completePayload = {
          ok: true,
          report: payload.report as OutfitReport,
        };
        return;
      }

      if (event.event === "fatal") {
        throw new FatalError(String(payload.error || "service_unavailable"));
      }
    },
    onclose() {
      if (!completePayload) {
        throw new FatalError("event_stream_closed");
      }
    },
    onerror(error: Error) {
      throw error;
    },
  });

  if (!completePayload) {
    throw new FatalError("event_stream_closed");
  }

  return completePayload;
}

export { generateOutfitReport };
