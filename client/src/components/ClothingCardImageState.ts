import { useEffect, useState } from "react";
import {
  buildProductImageThumbnailSizes,
  buildProductImageThumbnails,
  type ProductImageThumbnails,
} from "../utils/productImageThumbnails";

type ClothingCardImageSource = {
  src: string;
  srcSet?: string;
  sizes?: string;
};

function toClothingCardImageSource(
  thumbnails: ProductImageThumbnails,
): ClothingCardImageSource {
  return {
    src: thumbnails.src,
    srcSet: thumbnails.srcSet,
    sizes: thumbnails.sizes,
  };
}

function useResponsiveClothingCardImageState(
  originalImageUrl: unknown,
  safeImageUrl: string | null,
  isMobile: boolean,
  mobileColumns: 1 | 2 | 3,
) {
  return useClothingCardImageState(
    originalImageUrl,
    safeImageUrl,
    buildProductImageThumbnailSizes({ isMobile, mobileColumns }),
  );
}

function useClothingCardImageState(
  originalImageUrl: unknown,
  safeImageUrl: string | null,
  imageSizes: string,
) {
  const [displayImageSource, setDisplayImageSource] =
    useState<ClothingCardImageSource | null>(null);
  const [imageMode, setImageMode] = useState<
    "loading" | "thumbnail" | "original" | "missing"
  >("loading");

  useEffect(() => {
    let isActive = true;

    setDisplayImageSource(null);
    setImageMode(safeImageUrl ? "loading" : "missing");

    if (!safeImageUrl) {
      return () => {
        isActive = false;
      };
    }

    buildProductImageThumbnails(originalImageUrl, { sizes: imageSizes }).then(
      (thumbnails) => {
        if (!isActive) {
          return;
        }

        if (thumbnails) {
          setDisplayImageSource(toClothingCardImageSource(thumbnails));
          setImageMode("thumbnail");
        } else {
          setDisplayImageSource({ src: safeImageUrl });
          setImageMode("original");
        }
      },
    );

    return () => {
      isActive = false;
    };
  }, [imageSizes, originalImageUrl, safeImageUrl]);

  return {
    displayImageSource,
    imageMode,
    handleImageError() {
      if (imageMode === "thumbnail" && safeImageUrl) {
        setDisplayImageSource({ src: safeImageUrl });
        setImageMode("original");
        return;
      }

      setDisplayImageSource(null);
      setImageMode("missing");
    },
  };
}

export { useResponsiveClothingCardImageState };
