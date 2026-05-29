import { Button, Divider, Stack, Typography } from "@mui/material";
import type { ProfileFiltersSidebarProps } from "./ProfileFiltersSidebarTypes";

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

function ProfileFilterActions({
  missingRequiredFilters,
  showUnchangedFiltersHint,
  isApplyDisabled,
  props,
  t,
}: {
  missingRequiredFilters: string[];
  showUnchangedFiltersHint: boolean;
  isApplyDisabled: boolean;
  props: ProfileFiltersSidebarProps;
  t: Translate;
}) {
  return (
    <Stack spacing={1.5} sx={{ width: "100%", alignItems: "flex-end" }}>
      {missingRequiredFilters.length > 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ alignSelf: "stretch" }}
        >
          {t("filters.applyDisabledHint", {
            items: missingRequiredFilters.join(", "),
          })}
        </Typography>
      ) : null}
      {showUnchangedFiltersHint ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ alignSelf: "stretch" }}
        >
          {t("filters.applyDisabledUnchangedHint")}
        </Typography>
      ) : null}
      <Stack direction="row" spacing={2}>
        <Button
          variant="outlined"
          color="inherit"
          onClick={props.onReset}
          disabled={
            props.status.loading || Boolean(props.isInteractionDisabled)
          }
        >
          {t(props.resetLabelKey ?? "filters.reset")}
        </Button>
        <Button
          variant="contained"
          onClick={props.onApply}
          disabled={isApplyDisabled}
        >
          {t("filters.apply")}
        </Button>
      </Stack>
      {props.status.error ? (
        <Typography variant="body2" color="error" sx={{ alignSelf: "stretch" }}>
          {props.status.error}
        </Typography>
      ) : null}
      {props.status.infoKey && props.status.infoKey !== "auth.signedIn" ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ alignSelf: "stretch" }}
        >
          {t(props.status.infoKey, props.status.infoParams || undefined)}
        </Typography>
      ) : null}
    </Stack>
  );
}

export { ProfileFilterActions, ProfileSignOutAction };
