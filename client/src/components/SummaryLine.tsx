import { Stack, Typography } from "@mui/material";

export function SummaryLine({
  items,
  testId,
}: {
  items: string[];
  testId?: string;
}) {
  return (
    <Stack
      data-testid={testId}
      direction="row"
      useFlexGap
      sx={{ flexWrap: "wrap", gap: 0.75, color: "text.secondary", minWidth: 0 }}
    >
      {items.map((item, index) => (
        <Typography
          key={`${item}-${index}`}
          variant="body2"
          component="span"
          sx={{
            display: "inline-flex",
            gap: 0.75,
            "&::before":
              index === 0
                ? undefined
                : { content: '"•"', color: "text.disabled" },
          }}
        >
          {item}
        </Typography>
      ))}
    </Stack>
  );
}
