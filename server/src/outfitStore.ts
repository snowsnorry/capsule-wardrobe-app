import { getEffectiveOutfitSnapshot } from "./outfitStoreModel.js";
import { createOutfitStoreOperations } from "./outfitStoreOperations.js";
import {
  resolveOutfitStoreDeps,
  type OutfitStoreDeps,
} from "./outfitStoreDeps.js";

function createOutfitStore(deps: OutfitStoreDeps = {}) {
  return createOutfitStoreOperations(resolveOutfitStoreDeps(deps));
}

const defaultOutfitStore = createOutfitStore();

const {
  countOutfits,
  createOutfit,
  deleteOutfit,
  duplicateOutfit,
  getOutfit,
  listRecentOutfits,
  renameOutfit,
  revertOutfit,
  saveOutfit,
  searchOutfits,
  updateOutfitReport,
  updateOutfitSnapshot,
} = defaultOutfitStore;

export {
  countOutfits,
  createOutfit,
  createOutfitStore,
  deleteOutfit,
  duplicateOutfit,
  getEffectiveOutfitSnapshot,
  getOutfit,
  listRecentOutfits,
  renameOutfit,
  revertOutfit,
  saveOutfit,
  searchOutfits,
  updateOutfitReport,
  updateOutfitSnapshot,
};
