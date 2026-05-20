type TranslationParams = Record<string, unknown> | undefined;

const labels = {
  appName: "Capsule Wardrobe",
  filters: {
    open: "Open filters",
    apply: "Apply",
    cancel: "Cancel",
    title: "Filters",
  },
  actions: {
    signOut: "Sign out",
    cancel: "Cancel",
    ok: "OK",
    delete: "Delete",
    edit: "Edit",
    save: "Save",
    close: "Close",
  },
  appShell: {
    toggleSidebar: "Toggle sidebar",
    collapseSidebar: "Collapse sidebar",
    openUserMenu: "Open user menu",
    loadingSection: "Loading section",
  },
  capsule: {
    new: "New capsule",
    search: "Search capsules",
    yourCapsules: "Your capsules",
    notSaved: "Not saved",
    nameLabel: "Capsule name",
    renameWithName: "Rename capsule {name}",
    editName: "Edit capsule name",
    regenerateAll: "Regenerate all",
    exportPdf: "Export as PDF",
    rename: "Rename",
    revert: "Revert",
    saveAs: "Save as...",
    saveAsTitle: "Save as",
    share: "Share",
    shareTitle: "Share capsule",
    shareReady: "Your share link is ready.",
    shareBlockedTitle: "Can't share this capsule",
    shareBlockedBody:
      "Capsules with personal uploaded wardrobe items can't be shared. Remove uploaded items or replace them with catalog items before sharing.",
    copyShareLink: "Copy share link",
    shareCopied: "Copied",
    shareExpires: "Expires {date}",
    renameTitle: "Rename capsule",
    deleteTitle: "Delete capsule",
    deleteOutfitSetImageTitle: "Delete image",
    revertTitle: "Revert changes",
    deleteConfirmBody:
      "Are you sure you want to delete this capsule? This action cannot be undone.",
    deleteOutfitSetImage: "Delete image",
    deleteOutfitSetImageConfirmBody:
      "Are you sure you want to delete this image? This action cannot be undone.",
    createOutfitSetImage: "Create image",
    outfitSetImageAlt: "Outfit set {number}",
    openOutfitSetImagePreview: "Open outfit {number} image preview",
    outfitSetImageObsolete:
      "This image may no longer match the current outfit. Remove it and generate a new one if needed.",
    openCapsuleActions: "Capsule actions {name}",
    revertConfirmBody:
      "Discard the current unsaved changes and restore the last saved version of this capsule?",
    regenerateAllTitle: "Regenerate capsule?",
    regenerateAllConfirmBody:
      "This will replace the current items in this capsule. Continue?",
    regenerateAllConfirm: "Regenerate",
    regenerateWithFilterChangesTitle: "Apply updated filters?",
    regenerateWithFilterChangesBody:
      "Your filter changes have not been applied yet. Apply them and generate a new capsule with the updated settings?",
    regenerateWithFilterChangesConfirm: "Apply and regenerate",
    deleteConfirm: "Delete",
    revertConfirm: "Revert",
    searchPlaceholder: "Search capsules...",
    searchPrevious7Days: "Previous 7 Days",
    searchPrevious30Days: "Previous 30 Days",
    searchEarlier: "Earlier",
    itemsCount: "{count} items",
    outfitsCount: "{count} outfits",
    outfitSet: "Outfit {number}",
    closeFilters: "Close filters",
    openMenu: "Open capsule menu",
    openProductMenu: "Open product menu",
    selectProductForRegeneration: "Select",
    saveToMyWardrobe: "Save to My Wardrobe",
    removeFromMyWardrobe: "Remove from My Wardrobe",
    cardLayout: "Card layout",
    cardColumnsOne: "1 column",
    cardColumnsTwo: "2 columns",
    cardColumnsThree: "3 columns",
    copyProductLinkAddress: "Copy Link Address",
  },
  myWardrobe: {
    filters: {
      uploaded: "Uploaded",
    },
    imageVersionToggle: {
      label: "Uploaded item image version",
      original: "Original",
      ai: "AI",
    },
    removeConfirmTitle: "Remove from My Wardrobe?",
    removeConfirmBody: "Remove body",
    removeConfirm: "Remove",
    uploadedDetail: {
      notSpecified: "Not specified",
      missingRequired: "To apply changes, fill in: {items}.",
      fields: {
        name: "Name",
        description: "Description",
        brand: "Brand",
      },
      required: {
        name: "name",
        audience: "audience",
        category: "category",
        season: "at least one season",
      },
    },
  },
  search: {
    all: "All",
    back: "Back",
    detailEmpty: "Select a product to inspect its details.",
    detailLoading: "Loading product details",
    openProductPage: "Open product page",
    productActions: "Product actions",
    productDetailsTitle: "Product details",
    untitled: "Untitled product",
  },
  main: {
    cancelSelection: "Cancel",
    regenerateSelected: "Regenerate Selected ({count})",
    download: "Download capsule PDF",
    refresh: "Refresh wardrobe",
  },
  settings: { title: "Settings", saved: "Settings saved." },
};

export const t = (key: string, params?: TranslationParams) => {
  const value = key
    .split(".")
    .reduce<unknown>(
      (current, part) =>
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[part]
          : undefined,
      labels,
    );
  return typeof value === "string"
    ? value.replace(/\{(\w+)\}/g, (_match, token: string) =>
        String(params?.[token] ?? `{${token}}`),
      )
    : key;
};
