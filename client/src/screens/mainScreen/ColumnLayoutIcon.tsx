import { SvgIcon } from "@mui/material";
import type { MobileCardColumns } from "./MainScreenTypes";

function ColumnLayoutIcon({ columns }: { columns: MobileCardColumns }) {
  const dividers = columns === 1 ? [] : columns === 2 ? [12] : [8, 16];

  return (
    <SvgIcon viewBox="0 0 24 24" fontSize="small">
      <rect x="4" y="6" width="16" height="12" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      {dividers.map((x) => (
        <line key={x} x1={x} y1="6.8" x2={x} y2="17.2" stroke="currentColor" strokeWidth="1.5" />
      ))}
    </SvgIcon>
  );
}

export default ColumnLayoutIcon;
