import {
  DEFAULT_OUTFIT_NAME,
  normalizeOutfitRecord,
  normalizeOutfitSnapshot,
  type NormalizedOutfitRecord,
} from "../outfitStoreModel.js";
import { deepClone } from "./capsuleState.js";

const INITIAL_OUTFIT_COUNTER = 0;

function normalizeOutfitId(id: unknown): string {
  return String(id || "").trim();
}

function deterministicTimestamp(counter: number): string {
  return new Date(counter * 1000).toISOString();
}

function toStoredOutfit(
  outfit: Record<string, unknown>,
): NormalizedOutfitRecord {
  return (
    normalizeOutfitRecord(deepClone(outfit)) || {
      id: String(outfit.id || "outfit-e2e"),
      name: String(outfit.name || DEFAULT_OUTFIT_NAME),
      draft: null,
      saved: null,
      status: "new",
      createdAt: deterministicTimestamp(0),
      updatedAt: deterministicTimestamp(0),
    }
  );
}

function cloneOutfit(
  outfit: NormalizedOutfitRecord | null | undefined,
): NormalizedOutfitRecord | null {
  return outfit ? deepClone(outfit) : null;
}

function getOutfitName(outfit: NormalizedOutfitRecord): string {
  return String(outfit.name || "").trim();
}

function buildUniqueOutfitName(
  outfits: Iterable<NormalizedOutfitRecord>,
  preferredName: unknown = DEFAULT_OUTFIT_NAME,
): string {
  const baseName =
    String(preferredName || DEFAULT_OUTFIT_NAME).trim() || DEFAULT_OUTFIT_NAME;
  const existingNames = new Set([...outfits].map(getOutfitName));
  if (!existingNames.has(baseName)) return baseName;
  let index = 1;
  while (existingNames.has(`${baseName} (${index})`)) {
    index += 1;
  }
  return `${baseName} (${index})`;
}

export class E2eOutfitMemory {
  outfits = new Map<string, NormalizedOutfitRecord>();
  counter = INITIAL_OUTFIT_COUNTER;

  reset() {
    this.outfits.clear();
    this.counter = INITIAL_OUTFIT_COUNTER;
  }

  orderedOutfits(): NormalizedOutfitRecord[] {
    return [...this.outfits.values()].sort((left, right) => {
      const updated = String(right.updatedAt || "").localeCompare(
        String(left.updatedAt || ""),
      );
      if (updated !== 0) return updated;
      return getOutfitName(left).localeCompare(getOutfitName(right));
    });
  }

  list(limit = 10, offset = 0): NormalizedOutfitRecord[] {
    return this.orderedOutfits()
      .slice(offset, offset + limit)
      .map((outfit) => deepClone(outfit));
  }

  search(query: unknown, limit = 25): NormalizedOutfitRecord[] {
    const normalizedQuery = String(query || "")
      .trim()
      .toLowerCase();
    return this.orderedOutfits()
      .filter((outfit) =>
        getOutfitName(outfit).toLowerCase().includes(normalizedQuery),
      )
      .slice(0, limit)
      .map((outfit) => deepClone(outfit));
  }

  get(id: unknown): NormalizedOutfitRecord | null {
    return cloneOutfit(this.outfits.get(normalizeOutfitId(id)));
  }

  create(payload: {
    name?: string;
    draft?: Record<string, unknown> | null;
    saved?: Record<string, unknown> | null;
  }): NormalizedOutfitRecord {
    this.counter += 1;
    const id = `outfit-e2e-${this.counter}`;
    const outfit = toStoredOutfit({
      id,
      name: buildUniqueOutfitName(this.outfits.values(), payload.name),
      draft: normalizeOutfitSnapshot(
        payload.saved
          ? (payload.draft ?? null)
          : (payload.draft ?? { items: [] }),
      ),
      saved: normalizeOutfitSnapshot(payload.saved ?? null),
      createdAt: deterministicTimestamp(this.counter),
      updatedAt: deterministicTimestamp(this.counter),
    });
    this.outfits.set(id, outfit);
    return deepClone(outfit);
  }

  update(
    id: unknown,
    draft: Record<string, unknown> | null,
  ): NormalizedOutfitRecord | null {
    const outfitId = normalizeOutfitId(id);
    const current = this.outfits.get(outfitId);
    if (!current) return null;
    this.counter += 1;
    const next = toStoredOutfit({
      ...current,
      draft: normalizeOutfitSnapshot(draft),
      updatedAt: deterministicTimestamp(this.counter),
    });
    this.outfits.set(outfitId, next);
    return deepClone(next);
  }

  save(id: unknown): NormalizedOutfitRecord | null {
    const outfitId = normalizeOutfitId(id);
    const current = this.outfits.get(outfitId);
    if (!current) return null;
    this.counter += 1;
    const next = toStoredOutfit({
      ...current,
      saved: normalizeOutfitSnapshot(current.draft || current.saved),
      draft: null,
      updatedAt: deterministicTimestamp(this.counter),
    });
    this.outfits.set(outfitId, next);
    return deepClone(next);
  }

  revert(id: unknown): NormalizedOutfitRecord | null {
    const outfitId = normalizeOutfitId(id);
    const current = this.outfits.get(outfitId);
    if (!current) return null;
    this.counter += 1;
    const next = toStoredOutfit({
      ...current,
      draft: null,
      updatedAt: deterministicTimestamp(this.counter),
    });
    this.outfits.set(outfitId, next);
    return deepClone(next);
  }

  rename(id: unknown, name: string): NormalizedOutfitRecord | null {
    const outfitId = normalizeOutfitId(id);
    const current = this.outfits.get(outfitId);
    if (!current) return null;
    this.counter += 1;
    const otherOutfits = this.orderedOutfits().filter(
      (outfit) => String(outfit.id || "") !== outfitId,
    );
    const next = toStoredOutfit({
      ...current,
      name: buildUniqueOutfitName(otherOutfits, name),
      updatedAt: deterministicTimestamp(this.counter),
    });
    this.outfits.set(outfitId, next);
    return deepClone(next);
  }

  duplicate(id: unknown, name?: string): NormalizedOutfitRecord | null {
    const source = this.outfits.get(normalizeOutfitId(id));
    if (!source) return null;
    return this.create({
      name: name || `${getOutfitName(source) || DEFAULT_OUTFIT_NAME} copy`,
      draft: null,
      saved: source.draft || source.saved,
    });
  }

  setPin(id: unknown, pin: boolean): NormalizedOutfitRecord | null {
    const outfitId = normalizeOutfitId(id);
    const current = this.outfits.get(outfitId);
    if (!current) return null;
    this.counter += 1;
    const next = toStoredOutfit({
      ...current,
      pin: Boolean(pin),
      updatedAt: deterministicTimestamp(this.counter),
    });
    this.outfits.set(outfitId, next);
    return deepClone(next);
  }

  setImage(
    id: unknown,
    image: string | null,
    imageObsolete = false,
  ): NormalizedOutfitRecord | null {
    const outfitId = normalizeOutfitId(id);
    const current = this.outfits.get(outfitId);
    if (!current) return null;
    this.counter += 1;
    const effective = current.draft || current.saved || { items: [] };
    const next = toStoredOutfit({
      ...current,
      draft: {
        ...effective,
        image,
        imageObsolete: Boolean(imageObsolete),
      },
      updatedAt: deterministicTimestamp(this.counter),
    });
    this.outfits.set(outfitId, next);
    return deepClone(next);
  }

  setReport(
    id: unknown,
    report: Record<string, unknown> | null,
  ): NormalizedOutfitRecord | null {
    const outfitId = normalizeOutfitId(id);
    const current = this.outfits.get(outfitId);
    if (!current) return null;
    this.counter += 1;
    const effective = current.draft || current.saved || { items: [] };
    const next = toStoredOutfit({
      ...current,
      ...(current.draft
        ? { draft: { ...effective, report } }
        : { saved: { ...effective, report } }),
      updatedAt: deterministicTimestamp(this.counter),
    });
    this.outfits.set(outfitId, next);
    return deepClone(next);
  }

  delete(id: unknown): boolean {
    return this.outfits.delete(normalizeOutfitId(id));
  }
}
