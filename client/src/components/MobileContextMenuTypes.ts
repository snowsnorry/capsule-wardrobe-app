type MobileContextMenuPresentation = "anchored" | "mobile-context";

type MobileContextMenuOriginRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type MobileContextMenuOpenOptions = {
  presentation: MobileContextMenuPresentation;
  originRect?: MobileContextMenuOriginRect;
};

export type {
  MobileContextMenuOpenOptions,
  MobileContextMenuOriginRect,
  MobileContextMenuPresentation,
};
