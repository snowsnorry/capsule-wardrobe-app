import { type ReactNode } from "react";
import { createPortal } from "react-dom";

type AppShellFloatingPortalProps = {
  children: ReactNode;
};

export default function AppShellFloatingPortal({
  children,
}: AppShellFloatingPortalProps) {
  if (typeof document === "undefined") {
    return <>{children}</>;
  }

  return createPortal(children, document.body);
}
