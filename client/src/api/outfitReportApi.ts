import { requestJson } from "./request";
import { parseTrackedJobResponse, type JobResponse } from "./jobs";
import { outfitIdPath, outfitUrl } from "./outfitApiPaths";

async function generateOutfitReport(id: string): Promise<JobResponse> {
  return parseTrackedJobResponse(
    await requestJson(outfitUrl(`${outfitIdPath(id)}/report`), {
      method: "POST",
      credentials: "include",
    }),
  );
}

export { generateOutfitReport };
