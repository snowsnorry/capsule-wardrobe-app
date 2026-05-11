import {
  DEFAULT_CAPSULE_NAME,
  getCapsuleIdValue,
  getEffectiveCapsuleSnapshot,
  normalizeCapsuleRecord,
  normalizeCapsuleSnapshot,
  type CapsuleSnapshot,
  type NormalizedCapsuleRecord,
} from "../capsuleStoreModel.js";
import { buildE2eCapsule } from "./fixtures.js";

const INITIAL_CAPSULE_ID = "capsule-e2e";
const INITIAL_CAPSULE_COUNTER = 1;

export function normalizeCapsuleId(id: unknown): string {
  return String(id || INITIAL_CAPSULE_ID).trim() || INITIAL_CAPSULE_ID;
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deterministicTimestamp(counter: number): string {
  return new Date(counter * 1000).toISOString();
}

function toStoredCapsule(
  capsule: Record<string, unknown>,
): NormalizedCapsuleRecord {
  return (
    normalizeCapsuleRecord(deepClone(capsule)) || {
      id: String(capsule.id || INITIAL_CAPSULE_ID),
      name: String(capsule.name || DEFAULT_CAPSULE_NAME),
      draft: null,
      saved: null,
      status: "new",
      createdAt: deterministicTimestamp(0),
      updatedAt: deterministicTimestamp(0),
    }
  );
}

export function cloneCapsule(
  capsule: NormalizedCapsuleRecord | null | undefined,
): NormalizedCapsuleRecord | null {
  return capsule ? deepClone(capsule) : null;
}

export function cloneCapsules(
  capsules: NormalizedCapsuleRecord[],
): NormalizedCapsuleRecord[] {
  return capsules.map((capsule) => deepClone(capsule));
}

function getCapsuleName(capsule: NormalizedCapsuleRecord): string {
  return String(capsule.name || "").trim();
}

function buildUniqueCapsuleName(
  capsules: Iterable<NormalizedCapsuleRecord>,
  preferredName: unknown = DEFAULT_CAPSULE_NAME,
): string {
  const baseName =
    String(preferredName || DEFAULT_CAPSULE_NAME).trim() ||
    DEFAULT_CAPSULE_NAME;
  const existingNames = new Set([...capsules].map(getCapsuleName));
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let index = 1;
  while (existingNames.has(`${baseName} (${index})`)) {
    index += 1;
  }
  return `${baseName} (${index})`;
}

function buildDuplicateName(
  source: NormalizedCapsuleRecord,
  capsules: Iterable<NormalizedCapsuleRecord>,
  requestedName?: string,
): string {
  return buildUniqueCapsuleName(
    capsules,
    requestedName || `${getCapsuleName(source) || DEFAULT_CAPSULE_NAME} copy`,
  );
}

function capsuleMatchesQuery(
  capsule: NormalizedCapsuleRecord,
  query: unknown,
): boolean {
  const normalizedQuery = String(query || "")
    .trim()
    .toLowerCase();
  return (
    !normalizedQuery ||
    getCapsuleName(capsule).toLowerCase().includes(normalizedQuery)
  );
}

function getEffectiveSnapshot(
  capsule: NormalizedCapsuleRecord | null,
): CapsuleSnapshot | null {
  return capsule ? deepClone(getEffectiveCapsuleSnapshot(capsule)) : null;
}

export function cloneEffectiveCapsuleSnapshot(
  capsule: NormalizedCapsuleRecord | null | undefined,
): CapsuleSnapshot | null {
  return getEffectiveSnapshot(capsule || null);
}

type OutfitSetImageMutationResult =
  | {
      status: "updated";
      capsule: NormalizedCapsuleRecord | null;
      image: string | null;
    }
  | { status: "missing-capsule" | "missing-set" };

function buildSnapshotWithOutfitSetImage(
  snapshot: CapsuleSnapshot | null,
  setIndex: number,
  image: string | null,
): CapsuleSnapshot | null {
  const wardrobe = snapshot?.data?.wardrobe;
  const outfitSets = Array.isArray(wardrobe?.outfitSets)
    ? wardrobe.outfitSets
    : [];
  if (!snapshot || !wardrobe || !outfitSets[setIndex]) {
    return null;
  }

  return normalizeCapsuleSnapshot({
    filters: snapshot.filters,
    data: {
      wardrobe: {
        ...wardrobe,
        outfitSets: outfitSets.map((set, index) =>
          index === setIndex ? { ...set, image, imageObsolete: false } : set,
        ),
      },
      rejectedUrls: snapshot.data?.rejectedUrls || [],
      regeneration: snapshot.data?.regeneration || null,
    },
  });
}

export class E2eCapsuleMemory {
  capsules = new Map<string, NormalizedCapsuleRecord>();
  capsuleCounter = INITIAL_CAPSULE_COUNTER;
  capsuleClockCounter = 0;

  constructor() {
    this.reset();
  }

  reset() {
    this.capsuleCounter = INITIAL_CAPSULE_COUNTER;
    this.capsuleClockCounter = 0;
    this.capsules = new Map([
      [INITIAL_CAPSULE_ID, toStoredCapsule(buildE2eCapsule())],
    ]);
  }

  orderedCapsules(): NormalizedCapsuleRecord[] {
    return [...this.capsules.values()].sort((left, right) => {
      const updated = String(right.updatedAt || "").localeCompare(
        String(left.updatedAt || ""),
      );
      if (updated !== 0) return updated;

      const created = String(right.createdAt || "").localeCompare(
        String(left.createdAt || ""),
      );
      if (created !== 0) return created;

      return String(left.id || "").localeCompare(String(right.id || ""));
    });
  }

  list(limit = 10): NormalizedCapsuleRecord[] {
    return cloneCapsules(this.orderedCapsules().slice(0, limit));
  }

  search(query: unknown, limit = 25): NormalizedCapsuleRecord[] {
    return cloneCapsules(
      this.orderedCapsules()
        .filter((capsule) => capsuleMatchesQuery(capsule, query))
        .slice(0, limit),
    );
  }

  get(id: unknown): NormalizedCapsuleRecord | null {
    return cloneCapsule(this.capsules.get(normalizeCapsuleId(id)));
  }

  create(payload: {
    name?: string;
    draft?: Record<string, unknown> | null;
    saved?: Record<string, unknown> | null;
  }): NormalizedCapsuleRecord {
    const id = this.nextCapsuleId();
    const timestamp = this.nextTimestamp();
    const capsule = toStoredCapsule({
      ...buildE2eCapsule(),
      id,
      name: buildUniqueCapsuleName(this.capsules.values(), payload.name),
      draft: normalizeCapsuleSnapshot(payload.draft ?? null),
      saved: normalizeCapsuleSnapshot(payload.saved ?? null),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return cloneCapsule(this.set(capsule));
  }

  update(id: unknown, draft: Record<string, unknown> | null) {
    const current = this.capsules.get(normalizeCapsuleId(id));
    return current
      ? cloneCapsule(
          this.set({
            ...current,
            draft: normalizeCapsuleSnapshot(draft),
            updatedAt: this.nextTimestamp(),
          }),
        )
      : null;
  }

  setOutfitSetImage(
    id: unknown,
    setIndex: number,
    image: string | null,
  ): OutfitSetImageMutationResult {
    const current = this.capsules.get(normalizeCapsuleId(id));
    if (!current) return { status: "missing-capsule" };

    const draft = buildSnapshotWithOutfitSetImage(
      getEffectiveSnapshot(current),
      setIndex,
      image,
    );
    if (!draft) return { status: "missing-set" };

    return {
      status: "updated",
      capsule: cloneCapsule(
        this.set({
          ...current,
          draft,
          updatedAt: this.nextTimestamp(),
        }),
      ),
      image,
    };
  }

  save(id: unknown) {
    const current = this.capsules.get(normalizeCapsuleId(id));
    return current
      ? cloneCapsule(
          this.set({
            ...current,
            draft: null,
            saved: getEffectiveSnapshot(current),
            updatedAt: this.nextTimestamp(),
          }),
        )
      : null;
  }

  revert(id: unknown) {
    const current = this.capsules.get(normalizeCapsuleId(id));
    return current
      ? cloneCapsule(
          this.set({
            ...current,
            draft: null,
            updatedAt: this.nextTimestamp(),
          }),
        )
      : null;
  }

  rename(id: unknown, name: string) {
    const capsuleId = normalizeCapsuleId(id);
    const current = this.capsules.get(capsuleId);
    if (!current) return null;
    const otherCapsules = this.orderedCapsules().filter(
      (capsule) => capsule.id !== capsuleId,
    );
    return cloneCapsule(
      this.set({
        ...current,
        name: buildUniqueCapsuleName(otherCapsules, name),
        updatedAt: this.nextTimestamp(),
      }),
    );
  }

  duplicate(id: unknown, name?: string) {
    const source = this.capsules.get(normalizeCapsuleId(id));
    return source
      ? cloneCapsule(
          this.create({
            name: buildDuplicateName(source, this.capsules.values(), name),
            draft: null,
            saved: getEffectiveSnapshot(source),
          }),
        )
      : null;
  }

  delete(id: unknown, activeCapsuleId: unknown) {
    const capsuleId = normalizeCapsuleId(id);
    const deleted = this.capsules.delete(capsuleId);
    if (!deleted) return { deleted: false, activeCapsuleId: null };

    const nextActiveId =
      String(activeCapsuleId || "") === capsuleId
        ? getCapsuleIdValue(this.resolve(null))
        : null;
    return { deleted: true, activeCapsuleId: nextActiveId };
  }

  resolve(activeCapsuleId: unknown): NormalizedCapsuleRecord | null {
    const activeId = String(activeCapsuleId || "").trim();
    const activeCapsule = activeId ? this.capsules.get(activeId) : null;
    if (activeCapsule) return cloneCapsule(activeCapsule);

    const [fallback] = this.orderedCapsules();
    if (fallback) return cloneCapsule(fallback);

    return this.create({
      name: DEFAULT_CAPSULE_NAME,
      draft: buildE2eCapsule().draft,
    });
  }

  private nextCapsuleId(): string {
    this.capsuleCounter += 1;
    return `${INITIAL_CAPSULE_ID}-${this.capsuleCounter}`;
  }

  private nextTimestamp(): string {
    this.capsuleClockCounter += 1;
    return deterministicTimestamp(this.capsuleClockCounter);
  }

  private set(capsule: NormalizedCapsuleRecord): NormalizedCapsuleRecord {
    const normalized = toStoredCapsule(capsule);
    this.capsules.set(normalizeCapsuleId(normalized.id), normalized);
    return normalized;
  }
}
