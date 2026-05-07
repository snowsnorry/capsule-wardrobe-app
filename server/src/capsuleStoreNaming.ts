import { DEFAULT_CAPSULE_NAME } from "./capsuleStoreModel.js";

export async function buildUniqueCapsuleNameForStore(
  email: string,
  preferredName: string = DEFAULT_CAPSULE_NAME,
  listCapsuleNamesByEmailImpl: (email: string) => Promise<string[]>,
): Promise<string> {
  const baseName =
    String(preferredName || DEFAULT_CAPSULE_NAME).trim() ||
    DEFAULT_CAPSULE_NAME;
  const existingNames = await listCapsuleNamesByEmailImpl(email);
  if (!existingNames.includes(baseName)) {
    return baseName;
  }

  let index = 1;
  while (existingNames.includes(`${baseName} (${index})`)) {
    index += 1;
  }
  return `${baseName} (${index})`;
}
