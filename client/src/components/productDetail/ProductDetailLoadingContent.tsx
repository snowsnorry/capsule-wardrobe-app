import type { ReactElement } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { IconButton, LinearProgress, Stack, Typography } from "@mui/material";

type ProductDetailLoadingContentProps = {
  mobileLayout: boolean;
  onClose: () => void;
  showCloseAction?: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
};

function ProductDetailLoadingContent({
  mobileLayout,
  onClose,
  showCloseAction = true,
  t,
}: ProductDetailLoadingContentProps): ReactElement {
  return (
    <Stack spacing={2.5} sx={{ width: "100%" }}>
      {showCloseAction ? (
        <Stack direction="row" justifyContent="flex-end">
          <IconButton aria-label={t("actions.close")} onClick={onClose}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
      ) : null}
      <LinearProgress color="success" aria-label={t("search.detailLoading")} />
      <Typography
        variant={mobileLayout ? "body1" : "h6"}
        color="text.secondary"
        align="center"
        sx={{ px: 3, py: mobileLayout ? 4 : 8 }}
      >
        {t("search.detailLoading")}
      </Typography>
    </Stack>
  );
}

export default ProductDetailLoadingContent;
