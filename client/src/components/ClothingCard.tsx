import type { ReactElement } from "react";
import { useI18n } from "../i18n/useI18n";
import { useClothingCardViewProps } from "./ClothingCardBehavior";
import { ClothingCardView } from "./ClothingCardParts";
import type { ClothingCardProps } from "./ClothingCardProps";

function ClothingCard(props: ClothingCardProps): ReactElement {
  const { t } = useI18n();
  const viewProps = useClothingCardViewProps(props, t);

  return <ClothingCardView {...viewProps} />;
}

export default ClothingCard;
