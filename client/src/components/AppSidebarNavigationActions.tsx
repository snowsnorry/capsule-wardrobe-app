import { type ReactElement } from "react";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { IconButton, Stack, Tooltip } from "@mui/material";
import { IoCreateOutline } from "react-icons/io5";

function ActionIconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick?: () => void;
  children: ReactElement;
}) {
  return (
    <Tooltip title={label} placement="top">
      <span>
        <IconButton
          aria-label={label}
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onClick?.();
          }}
          sx={{
            width: 32,
            height: 32,
            minWidth: 0,
            p: 0.5,
            borderRadius: "var(--cw-radius-card)",
            color: "primary.main",
          }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

export function SearchAddActions({
  searchLabel,
  addLabel,
  isInteractionDisabled,
  onSearch,
  onAdd,
}: {
  searchLabel: string;
  addLabel: string;
  isInteractionDisabled: boolean;
  onSearch?: () => void;
  onAdd?: () => void;
}) {
  return (
    <Stack direction="row" spacing={0.25}>
      <ActionIconButton
        label={searchLabel}
        disabled={isInteractionDisabled || !onSearch}
        onClick={onSearch}
      >
        <SearchRoundedIcon fontSize="small" />
      </ActionIconButton>
      <ActionIconButton
        label={addLabel}
        disabled={isInteractionDisabled || !onAdd}
        onClick={onAdd}
      >
        <IoCreateOutline data-testid="IoCreateOutline" size={20} />
      </ActionIconButton>
    </Stack>
  );
}
