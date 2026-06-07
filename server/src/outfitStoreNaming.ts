import { DEFAULT_OUTFIT_NAME } from "./outfitStoreModel.js";

export async function buildUniqueOutfitNameForStore(
  email: string,
  preferredName: string = DEFAULT_OUTFIT_NAME,
  listOutfitNamesByEmailImpl: (email: string) => Promise<string[]>,
): Promise<string> {
  const baseName =
    String(preferredName || DEFAULT_OUTFIT_NAME).trim() || DEFAULT_OUTFIT_NAME;
  const existingNames = await listOutfitNamesByEmailImpl(email);
  if (!existingNames.includes(baseName)) {
    return baseName;
  }

  let index = 1;
  while (existingNames.includes(`${baseName} (${index})`)) {
    index += 1;
  }
  return `${baseName} (${index})`;
}
