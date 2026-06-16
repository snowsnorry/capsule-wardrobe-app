import { useState } from "react";

function isElementOverflowing(element: HTMLElement) {
  return element.scrollWidth > element.clientWidth;
}

export function useOverflowTooltip() {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  const showTooltipIfOverflowing = (element: HTMLElement) => {
    setIsTooltipOpen(isElementOverflowing(element));
  };
  const hideTooltip = () => setIsTooltipOpen(false);

  return {
    hideTooltip,
    isTooltipOpen,
    showTooltipIfOverflowing,
  };
}
