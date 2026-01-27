import { useState } from "react";
import { Box, IconButton, Menu, MenuItem, Stack, Typography } from "@mui/material";
import { useI18n } from "../i18n/useI18n.js";

function LocaleSwitcher() {
  const { locale, setLocale, supportedLocales, t } = useI18n();
  const [anchorEl, setAnchorEl] = useState(null);
  const isOpen = Boolean(anchorEl);

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (nextLocale) => {
    setLocale(nextLocale);
    handleClose();
  };

  return (
    <>
      <IconButton aria-label={t("locale.label")} onClick={handleOpen} size="large">
        <Box component="span" sx={{ fontSize: "1.3rem" }}>
          {t(`locale.flags.${locale}`)}
        </Box>
      </IconButton>
      <Menu anchorEl={anchorEl} open={isOpen} onClose={handleClose}>
        {supportedLocales.map((code) => (
          <MenuItem key={code} onClick={() => handleSelect(code)}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box component="span" sx={{ fontSize: "1.1rem" }}>
                {t(`locale.flags.${code}`)}
              </Box>
              <Typography variant="body2">{t(`locale.options.${code}`)}</Typography>
            </Stack>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

export default LocaleSwitcher;
