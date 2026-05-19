import { DialogTitle, Typography } from "@mui/material";
import { mobileCapsuleDialogTitleSx } from "../MobileDialogSurfaceStyles";

type UploadedProductDetailMobileDialogHeaderProps = {
  t: (key: string, params?: Record<string, unknown>) => string;
};

function UploadedProductDetailMobileDialogHeader({
  t,
}: UploadedProductDetailMobileDialogHeaderProps) {
  return (
    <DialogTitle sx={mobileCapsuleDialogTitleSx}>
      <Typography
        component="span"
        variant="h6"
        sx={{ minWidth: 0, overflowWrap: "anywhere" }}
      >
        {t("search.productDetailsTitle")}
      </Typography>
    </DialogTitle>
  );
}

export default UploadedProductDetailMobileDialogHeader;
