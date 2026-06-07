import { useEffect, useState } from "react";
import { Box } from "@mui/material";
import { buildProductImageThumbnails } from "../utils/productImageThumbnails";
import type { AnchorItem } from "./ProfileFiltersAnchorTypes";

type AnchorImageSource = {
  mode: "thumbnail" | "original";
  src: string;
};

function getSmallestThumbnailSrc(srcSet: string) {
  return srcSet.split(",")[0]?.trim().split(/\s+/)[0] || "";
}

function useAnchorImageSource(item: AnchorItem | null, large: boolean) {
  const originalSrc = String(item?.imageUrl || "").trim();
  const [source, setSource] = useState<AnchorImageSource | null>(null);

  useEffect(() => {
    let isActive = true;

    if (!originalSrc) {
      setSource(null);
      return () => {
        isActive = false;
      };
    }

    setSource(null);
    void buildProductImageThumbnails(originalSrc, {
      sizes: large ? "56px" : "40px",
      source: item?.source,
    }).then((thumbnails) => {
      if (!isActive) return;
      if (!thumbnails) {
        setSource({ mode: "original", src: originalSrc });
        return;
      }
      const smallestSrc = getSmallestThumbnailSrc(thumbnails.srcSet);
      setSource({
        mode: "thumbnail",
        src: smallestSrc || thumbnails.src,
      });
    });

    return () => {
      isActive = false;
    };
  }, [item?.source, large, originalSrc]);

  return {
    originalSrc,
    source,
    handleError() {
      if (source?.mode === "thumbnail" && originalSrc) {
        setSource({ mode: "original", src: originalSrc });
        return;
      }
      setSource(null);
    },
  };
}

function getAnchorImageProps({
  handleError,
  label,
  source,
}: {
  handleError: () => void;
  label: string;
  source: AnchorImageSource | null;
}) {
  if (!source?.src) {
    return {
      component: "span" as const,
      src: undefined,
      alt: undefined,
      onError: undefined,
    };
  }

  return {
    component: "img" as const,
    src: source.src,
    alt: label,
    onError: handleError,
  };
}

export function AnchorImage({
  item,
  label,
  large = false,
}: {
  item: AnchorItem | null;
  label: string;
  large?: boolean;
}) {
  const { handleError, source } = useAnchorImageSource(item, large);
  const imageProps = getAnchorImageProps({ handleError, label, source });

  return (
    <Box
      component={imageProps.component}
      src={imageProps.src}
      alt={imageProps.alt}
      onError={imageProps.onError}
      sx={{
        width: large ? 56 : 40,
        height: large ? 70 : 50,
        borderRadius: "var(--cw-radius-sm)",
        objectFit: "cover",
        bgcolor: "background.default",
        border: "1px solid",
        borderColor: "divider",
        flexShrink: 0,
      }}
    />
  );
}
