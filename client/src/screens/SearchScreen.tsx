import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { useI18n } from "../i18n/useI18n";
import useMediaQuery from "@mui/material/useMediaQuery";
import SearchScreenDialogs from "./searchScreen/SearchScreenDialogs";
import {
  SearchScreenDesktop,
  SearchScreenMobile,
} from "./searchScreen/SearchScreenLayout";
import type { SearchResultItem } from "./searchScreen/searchTypes";
import useSearchScreenState from "./searchScreen/useSearchScreenState";

type SearchScreenProps = {
  initialQuery?: string;
  autoOpenProductDetail?: boolean;
  onRemoveFromMyWardrobe?: (item: SearchResultItem) => Promise<void> | void;
  onSaveToMyWardrobe?: (item: SearchResultItem) => Promise<void> | void;
};

function SearchScreen({
  initialQuery = "",
  autoOpenProductDetail = false,
  onRemoveFromMyWardrobe,
  onSaveToMyWardrobe,
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
  const handleSaveToMyWardrobe = async (item: SearchResultItem) => {
    await onSaveToMyWardrobe?.(item);
    search.markResultSavedToWardrobe(item);
  };
  const handleRemoveFromMyWardrobe = async (item: SearchResultItem) => {
    await onRemoveFromMyWardrobe?.(item);
    search.markResultRemovedFromWardrobe(item);
  };

  return (
    <>
      <Stack
        spacing={2.4}
        sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}
      >
        {isMobile ? (
          <SearchScreenMobile search={search} t={t} />
        ) : (
          <SearchScreenDesktop
            search={search}
            title={t("search.title")}
            t={t}
            locale={locale}
            onRemoveFromMyWardrobe={handleRemoveFromMyWardrobe}
            onSaveToMyWardrobe={handleSaveToMyWardrobe}
          />
        )}
      </Stack>
      <SearchScreenDialogs
        search={search}
        t={t}
        locale={locale}
        onRemoveFromMyWardrobe={handleRemoveFromMyWardrobe}
        onSaveToMyWardrobe={handleSaveToMyWardrobe}
      />
    </>
  );
}

export default SearchScreen;
