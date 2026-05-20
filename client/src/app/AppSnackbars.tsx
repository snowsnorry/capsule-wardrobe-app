import { Alert, Button, Snackbar, Stack } from "@mui/material";
import type { PasskeyPromptState, StatusState } from "./appTypes";

type AppSnackbarsProps = {
  notificationOpen: boolean;
  passkeyPrompt: PasskeyPromptState;
  status: StatusState;
  t: (key: string, params?: Record<string, unknown>) => string;
  onRequestNotificationPermission: () => void;
  onAddPasskey: () => void;
  onDismissPasskey: () => void;
  onClearError: () => void;
};

function NotificationPromptSnackbar({
  open,
  t,
  onRequestNotificationPermission,
}: Pick<AppSnackbarsProps, "t" | "onRequestNotificationPermission"> & {
  open: boolean;
}) {
  return (
    <Snackbar
      open={open}
      autoHideDuration={null}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      sx={{ "& .MuiSnackbarContent-root": { p: 0, background: "transparent" } }}
    >
      <Alert
        severity="info"
        action={
          <Button
            size="small"
            variant="text"
            onClick={onRequestNotificationPermission}
            sx={{
              color: "primary.main",
              fontWeight: 700,
              "&:hover": {
                backgroundColor: "var(--cw-color-notification-action-hover)",
              },
            }}
          >
            {t("notifications.prompt.action")}
          </Button>
        }
        sx={{
          width: "min(680px, calc(100vw - 32px))",
          alignItems: "center",
          color: "text.primary",
          backgroundColor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "var(--cw-shadow-overlay-panel)",
          "& .MuiAlert-icon": { color: "var(--cw-color-notification-icon)" },
          "& .MuiAlert-message": { py: 1 },
        }}
      >
        {t("notifications.prompt.message")}
      </Alert>
    </Snackbar>
  );
}

function PasskeyPromptSnackbar({
  passkeyPrompt,
  t,
  onAddPasskey,
  onDismissPasskey,
}: Pick<
  AppSnackbarsProps,
  "passkeyPrompt" | "t" | "onAddPasskey" | "onDismissPasskey"
>) {
  return (
    <Snackbar
      open={passkeyPrompt.open}
      autoHideDuration={null}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert
        severity="info"
        action={
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="text"
              disabled={passkeyPrompt.loading}
              onClick={onAddPasskey}
              sx={{ color: "primary.main", fontWeight: 700 }}
            >
              {t("passkeys.add")}
            </Button>
            <Button
              size="small"
              variant="text"
              disabled={passkeyPrompt.loading}
              onClick={onDismissPasskey}
              sx={{ color: "text.secondary", fontWeight: 700 }}
            >
              {t("passkeys.notNow")}
            </Button>
          </Stack>
        }
        sx={{
          width: "min(680px, calc(100vw - 32px))",
          alignItems: "center",
          color: "text.primary",
          backgroundColor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "var(--cw-shadow-overlay-panel)",
        }}
      >
        {t("passkeys.prompt")}
      </Alert>
    </Snackbar>
  );
}

export default function AppSnackbars({
  notificationOpen,
  passkeyPrompt,
  status,
  t,
  onRequestNotificationPermission,
  onAddPasskey,
  onDismissPasskey,
  onClearError,
}: AppSnackbarsProps) {
  return (
    <>
      <NotificationPromptSnackbar
        open={notificationOpen}
        t={t}
        onRequestNotificationPermission={onRequestNotificationPermission}
      />
      <PasskeyPromptSnackbar
        passkeyPrompt={passkeyPrompt}
        t={t}
        onAddPasskey={onAddPasskey}
        onDismissPasskey={onDismissPasskey}
      />
      <Snackbar
        open={Boolean(status.error)}
        autoHideDuration={6000}
        onClose={onClearError}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="error"
          onClose={onClearError}
          sx={{ width: "min(680px, calc(100vw - 32px))" }}
        >
          {status.error}
        </Alert>
      </Snackbar>
    </>
  );
}
