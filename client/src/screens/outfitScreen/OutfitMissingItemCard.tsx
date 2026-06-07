import { Box, IconButton, Stack, Typography } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import type { OutfitItemSnapshot } from "../../app/appTypes";
import type { ProductMenuOpenOptions } from "../../components/ClothingCardTypes";
import type { MobileCardColumns } from "../mainScreen/MainScreenTypes";
import { getOutfitItemKey } from "./outfitItemMappers";

type OutfitMissingItemCardProps = {
  entry: OutfitItemSnapshot;
  isMobile: boolean;
  isSelected: boolean;
  isSelectionMode: boolean;
  mobileColumns: MobileCardColumns;
  onItemMenuOpen: (
    anchor: HTMLElement,
    entry: OutfitItemSnapshot,
    options: ProductMenuOpenOptions,
  ) => void;
  onToggleSelected: (key: string) => void;
  t: (key: string) => string;
};

function getMissingCardRootSx({
  isMobile,
  isSelectionMode,
  mobileColumns,
}: Pick<
  OutfitMissingItemCardProps,
  "isMobile" | "isSelectionMode" | "mobileColumns"
>) {
  const isDenseMobileCard = isMobile && mobileColumns !== 1;
  return {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    borderRadius: isDenseMobileCard ? 0 : "var(--cw-radius-card)",
    overflow: "hidden",
    backgroundColor: "var(--cw-color-product-card-bg)",
    border: isDenseMobileCard
      ? "0.5px solid var(--cw-color-product-dense-border)"
      : "1px solid var(--cw-color-product-border)",
    boxShadow: isDenseMobileCard ? "none" : "var(--cw-shadow-wardrobe-card)",
    cursor: isSelectionMode ? "pointer" : "default",
    position: "relative",
    minWidth: 0,
  } as const;
}

function getMissingCardDetailsSx({
  isMobile,
  mobileColumns,
}: Pick<OutfitMissingItemCardProps, "isMobile" | "mobileColumns">) {
  return {
    flex: 1,
    minWidth: 0,
    px: isMobile ? (mobileColumns === 1 ? 2.5 : 1) : 2.5,
    py: isMobile ? (mobileColumns === 1 ? 2 : 1) : 2,
    minHeight: isMobile ? (mobileColumns === 1 ? 64 : 50) : 76,
    borderTop: "1px solid var(--cw-color-product-detail-divider)",
    backgroundColor: "var(--cw-color-product-card-bg)",
    justifyContent: "center",
  } as const;
}

function getMissingCardActionLabel({
  isSelectionMode,
  t,
}: Pick<OutfitMissingItemCardProps, "isSelectionMode" | "t">) {
  return isSelectionMode
    ? t("outfit.selectItem")
    : t("outfit.openMissingItemActions");
}

function getMissingCardSourceLabel(
  source: OutfitItemSnapshot["source"],
  t: OutfitMissingItemCardProps["t"],
) {
  return source === "uploaded"
    ? t("wardrobe.filters.uploaded")
    : t("wardrobe.filters.fromCatalog");
}

function MissingCardActionButton({
  entry,
  isMobile,
  isSelected,
  isSelectionMode,
  onItemMenuOpen,
  onToggle,
  t,
}: Pick<
  OutfitMissingItemCardProps,
  | "entry"
  | "isMobile"
  | "isSelected"
  | "isSelectionMode"
  | "onItemMenuOpen"
  | "t"
> & {
  onToggle: () => void;
}) {
  return (
    <IconButton
      aria-label={getMissingCardActionLabel({ isSelectionMode, t })}
      className="wardrobe-card-action-button outfit-missing-card-menu"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (isSelectionMode) {
          onToggle();
          return;
        }
        onItemMenuOpen(event.currentTarget, entry, {
          presentation: "anchored",
        });
      }}
      sx={{
        position: "absolute",
        top: isMobile ? 6 : 12,
        right: isMobile ? 6 : 12,
        zIndex: 4,
        width: 44,
        height: 44,
        bgcolor: "var(--cw-color-on-image-action-bg)",
        color: isSelected
          ? "primary.main"
          : "var(--cw-color-on-image-action-ink)",
        "&:hover": {
          bgcolor: "var(--cw-color-on-image-action-bg-hover)",
        },
      }}
    >
      {isSelectionMode ? (
        <CheckRoundedIcon fontSize="small" />
      ) : (
        <MoreVertRoundedIcon fontSize="small" />
      )}
    </IconButton>
  );
}

function MissingCardMedia({
  entry,
  isMobile,
  isSelected,
  isSelectionMode,
  onItemMenuOpen,
  onToggle,
  title,
  t,
}: Pick<
  OutfitMissingItemCardProps,
  | "entry"
  | "isMobile"
  | "isSelected"
  | "isSelectionMode"
  | "onItemMenuOpen"
  | "t"
> & {
  onToggle: () => void;
  title: string;
}) {
  return (
    <Box
      sx={{
        width: "100%",
        aspectRatio: "3 / 4",
        backgroundColor: "var(--cw-color-product-image-wash)",
        position: "relative",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        px: { xs: 1.5, sm: 2 },
        textAlign: "center",
      }}
    >
      <MissingCardActionButton
        entry={entry}
        isMobile={isMobile}
        isSelected={isSelected}
        isSelectionMode={isSelectionMode}
        t={t}
        onItemMenuOpen={onItemMenuOpen}
        onToggle={onToggle}
      />
      <Stack spacing={1} sx={{ alignItems: "center", maxWidth: "18ch" }}>
        <ErrorOutlineRoundedIcon
          sx={{ color: "text.secondary", fontSize: 34 }}
        />
        <Typography
          variant="body2"
          sx={{
            color: "var(--cw-color-product-card-ink)",
            fontWeight: 700,
            lineHeight: 1.25,
          }}
        >
          {title}
        </Typography>
      </Stack>
      {isSelected ? (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundColor: "var(--cw-color-product-selection-scrim)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
      ) : null}
    </Box>
  );
}

function OutfitMissingItemCard({
  entry,
  isMobile,
  isSelected,
  isSelectionMode,
  mobileColumns,
  onItemMenuOpen,
  onToggleSelected,
  t,
}: OutfitMissingItemCardProps) {
  const key = getOutfitItemKey(entry);
  const title = t("outfit.itemNotFoundTitle");
  const handleToggle = () => {
    if (key) onToggleSelected(key);
  };
  const keyDownHandler = isSelectionMode
    ? (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleToggle();
        }
      }
    : undefined;

  return (
    <Box
      className="wardrobe-card-root outfit-missing-card-root"
      data-mobile-columns={mobileColumns}
      role={isSelectionMode ? "button" : undefined}
      tabIndex={isSelectionMode ? 0 : undefined}
      aria-label={isSelectionMode ? title : undefined}
      onClick={isSelectionMode ? handleToggle : undefined}
      onKeyDown={keyDownHandler}
      sx={getMissingCardRootSx({ isMobile, isSelectionMode, mobileColumns })}
    >
      <MissingCardMedia
        entry={entry}
        isMobile={isMobile}
        isSelected={isSelected}
        isSelectionMode={isSelectionMode}
        t={t}
        title={title}
        onItemMenuOpen={onItemMenuOpen}
        onToggle={handleToggle}
      />
      <Stack
        className="wardrobe-card-details"
        spacing={0.5}
        sx={getMissingCardDetailsSx({ isMobile, mobileColumns })}
      >
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            fontWeight: 650,
            lineHeight: 1.25,
          }}
        >
          {t("outfit.itemNotFoundDescription")}
        </Typography>
        <Typography
          variant="caption"
          noWrap
          title={entry.url}
          sx={{ color: "text.secondary", minWidth: 0 }}
        >
          {getMissingCardSourceLabel(entry.source, t)}: {entry.url}
        </Typography>
      </Stack>
    </Box>
  );
}

export default OutfitMissingItemCard;
export {
  getMissingCardActionLabel,
  getMissingCardDetailsSx,
  getMissingCardRootSx,
  getMissingCardSourceLabel,
};
