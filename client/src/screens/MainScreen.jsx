import { useState } from "react";
import {
  Box,
  Button,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useI18n } from "../i18n/useI18n.js";

function MainScreen({ onSignOut, isSigningOut, onOpenProfile }) {
  const { t } = useI18n();
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const isMenuOpen = Boolean(menuAnchor);

  const handleOpenMenu = (event) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setMenuAnchor(null);
  };

  const handleSignOut = () => {
    handleCloseMenu();
    setIsSignOutOpen(true);
  };

  const handleConfirmSignOut = () => {
    setIsSignOutOpen(false);
    onSignOut();
  };

  const handleCancelSignOut = () => {
    setIsSignOutOpen(false);
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <IconButton aria-label={t("main.menuOpen")} onClick={handleOpenMenu}>
          <MenuIcon />
        </IconButton>
        <Typography variant="h5">{t("main.title")}</Typography>
        <Box sx={{ width: 40 }} />
      </Stack>
      <Menu
        anchorEl={menuAnchor}
        open={isMenuOpen}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <MenuItem
          onClick={() => {
            handleCloseMenu();
            onOpenProfile();
          }}
        >
          {t("main.menuProfile")}
        </MenuItem>
        <MenuItem onClick={handleSignOut} disabled={isSigningOut}>
          {t("main.menuSignOut")}
        </MenuItem>
      </Menu>
      <Dialog open={isSignOutOpen} onClose={handleCancelSignOut}>
        <DialogTitle>{t("dialogs.signOutTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t("dialogs.signOutBody")}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelSignOut} disabled={isSigningOut}>
            {t("dialogs.signOutCancel")}
          </Button>
          <Button
            onClick={handleConfirmSignOut}
            color="error"
            variant="contained"
            disabled={isSigningOut}
          >
            {t("dialogs.signOutConfirm")}
          </Button>
        </DialogActions>
      </Dialog>
      <Typography variant="h4">{t("main.welcome")}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t("main.placeholder")}
      </Typography>
      <Divider />
      <Box sx={{ minHeight: 220 }} />
    </Stack>
  );
}

export default MainScreen;
