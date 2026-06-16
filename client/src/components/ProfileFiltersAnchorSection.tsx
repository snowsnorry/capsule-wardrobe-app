import { useEffect, useState } from "react";
import { Button, Stack, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import {
  refsForSelectedKeys,
  refsFromSnapshots,
  useProfileFiltersAnchorSelection,
} from "./ProfileFiltersAnchorSelection";
import { AddItemsDialog } from "./AddItemsDialog";
import { AnchorSelectedRows } from "./ProfileFiltersAnchorSelectedRows";
import type {
  ProfileFiltersAnchorSectionProps,
  Translate,
} from "./ProfileFiltersAnchorTypes";

function ProfileFiltersAnchorSection({
  anchorPickerFullScreen = false,
  disabled,
  selectedRefs,
  onRefsChange,
  t,
  locale,
}: ProfileFiltersAnchorSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const anchors = useProfileFiltersAnchorSelection({ selectedRefs });
  const {
    initialItems,
    itemById,
    loadItems,
    selectedAnchorRefs,
    selectedDisplayKeys,
  } = anchors;

  useEffect(() => {
    if (dialogOpen) {
      void loadItems();
    }
  }, [dialogOpen, loadItems]);

  const canEdit = !disabled && Boolean(onRefsChange);

  return (
    <Stack spacing={1.5}>
      <AnchorSectionHeader t={t} />
      {selectedDisplayKeys.length === 0 ? (
        <AnchorEmptyButton
          canEdit={canEdit}
          t={t}
          onOpen={() => setDialogOpen(true)}
        />
      ) : (
        <AnchorSelectedRows
          canEdit={canEdit}
          itemById={itemById}
          locale={locale}
          selectedIds={selectedDisplayKeys}
          t={t}
          onEdit={() => setDialogOpen(true)}
          onChange={(nextKeys) => {
            onRefsChange?.(refsForSelectedKeys(selectedAnchorRefs, nextKeys));
          }}
        />
      )}
      <AddItemsDialog
        open={dialogOpen}
        existingItems={[]}
        initialItems={initialItems}
        locale={locale}
        maxSelected={5}
        fullScreenOverride={anchorPickerFullScreen ? true : null}
        allowEmptySelection
        actionLabel={t("capsule.anchors.apply")}
        t={t}
        onAdd={(nextItems) => {
          onRefsChange?.(refsFromSnapshots(nextItems));
          setDialogOpen(false);
        }}
        onClose={() => setDialogOpen(false)}
      />
    </Stack>
  );
}

function AnchorSectionHeader({ t }: { t: Translate }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {t("capsule.anchors.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t("capsule.anchors.hint")}
      </Typography>
    </Stack>
  );
}

function AnchorEmptyButton({
  canEdit,
  onOpen,
  t,
}: {
  canEdit: boolean;
  onOpen: () => void;
  t: Translate;
}) {
  return (
    <Button
      variant="outlined"
      color="inherit"
      startIcon={<AddRoundedIcon />}
      disabled={!canEdit}
      onClick={onOpen}
      sx={{ justifyContent: "center" }}
    >
      {t("capsule.anchors.add")}
    </Button>
  );
}

export default ProfileFiltersAnchorSection;
