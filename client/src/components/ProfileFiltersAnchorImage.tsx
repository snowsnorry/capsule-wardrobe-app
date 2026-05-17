import { Box } from "@mui/material";
import type { AnchorItem } from "./ProfileFiltersAnchorTypes";

export function AnchorImage({
  item,
  label,
  large = false,
}: {
  item: AnchorItem | null;
  label: string;
  large?: boolean;
}) {
  return (
    <Box
      component={item?.imageUrl ? "img" : "span"}
      src={item?.imageUrl || undefined}
      alt={item?.imageUrl ? label : undefined}
      sx={{
        width: large ? 56 : 40,
        height: large ? 70 : 50,
        borderRadius: "6px",
        objectFit: "cover",
        bgcolor: "background.default",
        border: "1px solid",
        borderColor: "divider",
        flexShrink: 0,
      }}
    />
  );
}
