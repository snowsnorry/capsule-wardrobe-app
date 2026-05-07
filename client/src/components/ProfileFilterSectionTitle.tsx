import { Stack, Typography } from "@mui/material";
import type { ReactElement } from "react";

function FilterSectionTitle({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}): ReactElement {
  return (
    <Stack spacing={0.5}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {hint ? (
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      ) : null}
    </Stack>
  );
}

export { FilterSectionTitle };
