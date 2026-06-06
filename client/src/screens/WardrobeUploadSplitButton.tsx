import { useState } from "react";
import type { MouseEvent } from "react";
import {
  Button,
  ButtonGroup,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import ArrowDropDownRoundedIcon from "@mui/icons-material/ArrowDropDownRounded";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";

type WardrobeUploadSplitButtonProps = {
  disabled: boolean;
  isMobile?: boolean;
  onOpenUpload: () => void;
  onOpenUrlUpload: () => void;
  t: (key: string) => string;
};

function WardrobeUploadSplitButton({
  disabled,
  isMobile = false,
  onOpenUpload,
  onOpenUrlUpload,
  t,
}: WardrobeUploadSplitButtonProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const isMenuOpen = Boolean(anchorEl);

  const closeMenu = () => setAnchorEl(null);
  const openMenu = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const selectPhotoUpload = () => {
    closeMenu();
    onOpenUpload();
  };
  const selectUrlUpload = () => {
    closeMenu();
    onOpenUrlUpload();
  };

  return (
    <>
      <ButtonGroup
        variant="outlined"
        disabled={disabled}
        sx={isMobile ? mobileUploadButtonGroupSx : uploadButtonGroupSx}
      >
        <Button
          startIcon={<FileUploadOutlinedIcon />}
          aria-label={t("wardrobe.upload")}
          onClick={onOpenUpload}
          sx={isMobile ? mobileUploadMainButtonSx : uploadMainButtonSx}
        >
          {t("wardrobe.uploadDialog.upload")}
        </Button>
        <Button
          aria-label={t("wardrobe.uploadMenu")}
          aria-controls={isMenuOpen ? "wardrobe-upload-menu" : undefined}
          aria-expanded={isMenuOpen ? "true" : undefined}
          aria-haspopup="menu"
          onClick={openMenu}
          sx={uploadMenuButtonSx}
        >
          <ArrowDropDownRoundedIcon />
        </Button>
      </ButtonGroup>
      <Menu
        id="wardrobe-upload-menu"
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={closeMenu}
        slotProps={{
          list: {
            "aria-label": t("wardrobe.uploadMenuLabel"),
            dense: true,
          },
        }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
      >
        <MenuItem onClick={selectPhotoUpload}>
          <ListItemIcon>
            <FileUploadOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("wardrobe.uploadPhoto")}</ListItemText>
        </MenuItem>
        <MenuItem onClick={selectUrlUpload}>
          <ListItemIcon>
            <LinkRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("wardrobe.uploadUrl")}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

const uploadButtonGroupSx = {
  flexShrink: 0,
} as const;

const mobileUploadButtonGroupSx = {
  ...uploadButtonGroupSx,
  flex: "0 1 auto",
  minWidth: 0,
} as const;

const uploadMainButtonSx = {
  whiteSpace: "nowrap",
  "& .MuiButton-startIcon": {
    mr: 0.75,
  },
} as const;

const mobileUploadMainButtonSx = {
  ...uploadMainButtonSx,
  minWidth: 0,
  px: 1.5,
} as const;

const uploadMenuButtonSx = {
  minWidth: 40,
  px: 0.5,
} as const;

export default WardrobeUploadSplitButton;
