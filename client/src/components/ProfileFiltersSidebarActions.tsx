import { Button, Divider, Stack } from "@mui/material";

type Translate = (key: string, params?: Record<string, unknown>) => string;

function ProfileSignOutAction({
  onSignOut,
  isSigningOut,
  t,
}: {
  onSignOut?: () => void;
  isSigningOut?: boolean;
  t: Translate;
}) {
  if (typeof onSignOut !== "function") {
    return null;
  }

  return (
    <Stack sx={{ mt: "auto" }} spacing={2}>
      <Divider />
      <Button
        variant="outlined"
        color="error"
        onClick={onSignOut}
        disabled={isSigningOut}
        sx={{
          alignSelf: "flex-start",
          borderRadius: "var(--cw-radius-pill)",
          px: 2.5,
        }}
      >
        {t("actions.signOut")}
      </Button>
    </Stack>
  );
}

export { ProfileSignOutAction };
