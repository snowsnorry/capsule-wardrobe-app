import { RiPushpinLine, RiUnpinLine } from "react-icons/ri";
import { useI18n } from "../../i18n/useI18n";
import ActionMenuItem from "./CapsuleActionMenuItem";

export default function CapsulePinMenuItem({
  disabled,
  isPinned,
  onClose,
  onSetPin,
  pinCopyPrefix,
}: {
  disabled: boolean;
  isPinned: boolean;
  onClose: () => void;
  onSetPin?: (pin: boolean) => void;
  pinCopyPrefix: "capsule" | "outfit";
}) {
  const { t } = useI18n();
  const pinLabelKey = `${pinCopyPrefix}.${isPinned ? "unpin" : "pin"}`;

  return (
    <ActionMenuItem
      disabled={disabled}
      icon={isPinned ? <RiUnpinLine /> : <RiPushpinLine />}
      onAction={() => onSetPin?.(!isPinned)}
      onClose={onClose}
    >
      {t(pinLabelKey)}
    </ActionMenuItem>
  );
}
