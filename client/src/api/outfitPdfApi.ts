import { request } from "./request";
import { outfitIdPath, outfitUrl } from "./outfitApiPaths";

type RequestErrorWithStatus = Error & {
  status: number;
};

function getDownloadFilenameFromDisposition(
  contentDisposition?: string | null,
): string {
  const header = String(contentDisposition || "");
  const utf8Match = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // ignore malformed filename*
    }
  }

  const filenameMatch = header.match(
    /filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i,
  );
  return (
    (filenameMatch?.[1] || filenameMatch?.[2] || "").trim() ||
    "capsule-wardrobe.pdf"
  );
}

async function downloadOutfitPdf(id: string): Promise<void> {
  const response = await request(outfitUrl(`${outfitIdPath(id)}/pdf`), {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    let message = `request_failed_${response.status}`;
    try {
      const data = await response.json();
      message = data?.error || data?.message || message;
    } catch {
      // ignore
    }
    const error = new Error(message) as RequestErrorWithStatus;
    error.status = response.status;
    throw error;
  }

  const filename = getDownloadFilenameFromDisposition(
    response.headers.get("content-disposition"),
  );
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export { downloadOutfitPdf };
