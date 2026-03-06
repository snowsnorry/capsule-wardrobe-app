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
import RefreshIcon from "@mui/icons-material/Refresh";
import { useI18n } from "../i18n/useI18n.js";
import ClothingGridPlaceholder from "../components/ClothingGridPlaceholder.jsx";
import ClothingCard from "../components/ClothingCard.jsx";
import LocaleSwitcher from "../components/LocaleSwitcher.jsx";

function MainScreen({
  onSignOut,
  isSigningOut,
  onOpenProfile,
  onRefreshItems,
  profileKey,
  items,
  isLoadingItems
}) {
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

  void profileKey;

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          backgroundColor: "background.paper",
          pb: 1
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <IconButton aria-label={t("main.menuOpen")} onClick={handleOpenMenu}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h5">{t("main.title")}</Typography>
          <LocaleSwitcher />
        </Stack>
      </Box>
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
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h4">{t("main.welcome")}</Typography>
        <IconButton
          aria-label={t("main.refresh")}
          onClick={onRefreshItems}
          disabled={isLoadingItems}
        >
          <RefreshIcon />
        </IconButton>
      </Stack>
      <Divider />
      {isLoadingItems ? (
        <ClothingGridPlaceholder count={12} />
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              md: "repeat(3, minmax(0, 1fr))"
            },
            gap: 2
          }}
        >
          {items.map((item) => (
            <ClothingCard key={item.id || item.url} item={item} />
          ))}
        </Box>
      )}
    </Stack>
  );
}

export default MainScreen;
