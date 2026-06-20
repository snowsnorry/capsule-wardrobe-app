import type {
  CapsuleActionMenuProps,
  NormalizedCapsuleActionMenuProps,
} from "./CapsuleActionMenuTypes";

export function normalizeCapsuleActionMenuProps(
  props: CapsuleActionMenuProps,
): NormalizedCapsuleActionMenuProps {
  return {
    ...props,
    allowUnknownShareContent: props.allowUnknownShareContent ?? false,
    canAnalyze: props.canAnalyze ?? false,
    disabled: props.disabled ?? false,
    mobileCardColumns: props.mobileCardColumns ?? 2,
    onMobileCardColumnsChange: props.onMobileCardColumnsChange,
    pinCopyPrefix: props.pinCopyPrefix ?? "capsule",
    showAnalyze: props.showAnalyze ?? false,
    showCardLayout: props.showCardLayout ?? false,
    showRegenerateAll: props.showRegenerateAll ?? false,
    showShare: props.showShare ?? true,
  };
}

export function getMobileActionMenuLabel({
  capsule,
  mobileLabel,
  pinCopyPrefix,
  t,
}: Pick<
  NormalizedCapsuleActionMenuProps,
  "capsule" | "mobileLabel" | "pinCopyPrefix"
> & {
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  if (mobileLabel) {
    return mobileLabel;
  }

  if (pinCopyPrefix === "outfit") {
    return t("outfit.openActions");
  }

  return t("capsule.openCapsuleActions", { name: capsule?.name || "" });
}
