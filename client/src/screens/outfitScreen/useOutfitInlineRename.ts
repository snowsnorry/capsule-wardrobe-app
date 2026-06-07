import { useCallback, useEffect, useRef, useState } from "react";
import type { OutfitMeta } from "../../app/appTypes";
import type { OutfitScreenProps } from "./OutfitScreenTypes";

function normalizeOutfitName(name: string | undefined) {
  return String(name || "").trim();
}

export function useOutfitInlineRename({
  activeOutfit,
  disabled,
  onRenameOutfit,
}: {
  activeOutfit: OutfitMeta | null;
  disabled: boolean;
  onRenameOutfit: OutfitScreenProps["onRenameOutfit"];
}) {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState(activeOutfit?.name || "");
  const [submitting, setSubmitting] = useState(false);
  const guardRef = useRef(false);

  useEffect(() => {
    setActive(false);
    setValue(activeOutfit?.name || "");
    setSubmitting(false);
    guardRef.current = false;
  }, [activeOutfit?.id, activeOutfit?.name]);

  const cancel = useCallback(() => {
    guardRef.current = false;
    setValue(activeOutfit?.name || "");
    setActive(false);
    setSubmitting(false);
  }, [activeOutfit?.name]);

  const submit = useCallback(async () => {
    if (!activeOutfit?.id || guardRef.current || disabled) return;
    const nextName = normalizeOutfitName(value);
    if (!nextName || nextName === normalizeOutfitName(activeOutfit.name)) {
      cancel();
      return;
    }

    guardRef.current = true;
    setSubmitting(true);
    try {
      setActive(false);
      await onRenameOutfit(nextName, activeOutfit.id);
    } finally {
      guardRef.current = false;
      setSubmitting(false);
    }
  }, [activeOutfit, cancel, disabled, onRenameOutfit, value]);

  const start = useCallback(() => {
    if (activeOutfit?.id && !disabled) {
      setValue(activeOutfit.name || "");
      setActive(true);
    }
  }, [activeOutfit, disabled]);

  return { active, cancel, setValue, start, submit, submitting, value };
}
