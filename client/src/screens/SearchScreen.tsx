import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { useI18n } from "../i18n/useI18n";
import useMediaQuery from "@mui/material/useMediaQuery";
import SearchScreenDialogs from "./searchScreen/SearchScreenDialogs";
import {
  SearchScreenDesktop,
  SearchScreenMobile,
} from "./searchScreen/SearchScreenLayout";
import useSearchScreenState from "./searchScreen/useSearchScreenState";

type SearchScreenProps = {
  onNavigateApp: (nextApp: "capsule" | "explore" | "statistics") => void;
  initialQuery?: string;
  autoOpenProductDetail?: boolean;
};

function SearchScreen({
  initialQuery = "",
  autoOpenProductDetail = false,
}: SearchScreenProps): ReactElement {
  const { t, locale } = useI18n();
  const isMobile = useMediaQuery("(max-width: 1279.95px)");
  const search = useSearchScreenState({
    initialQuery,
    autoOpenProductDetail,
    isMobile,
    locale,
    t,
  });

  return (
    <>
      <Stack
        spacing={2.4}
        sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}
      >
        {isMobile ? (
          <SearchScreenMobile search={search} t={t} />
        ) : (
          <SearchScreenDesktop search={search} t={t} locale={locale} />
        )}
      </Stack>
      <SearchScreenDialogs search={search} t={t} locale={locale} />
    </>
  );
}

export default SearchScreen;
