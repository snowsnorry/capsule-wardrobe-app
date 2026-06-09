const outfitImageJobs = new Map();

export function createOutfitImageJobKey(email, outfitId) {
  return `${String(email || "")
    .trim()
    .toLowerCase()}::${String(outfitId || "").trim()}`;
}

export function getOutfitImageJob(email, outfitId) {
  const job = outfitImageJobs.get(createOutfitImageJobKey(email, outfitId));
  return job?.status === "pending" ? { status: "pending" } : null;
}

export function getOutfitImageJobByKey(jobKey) {
  return outfitImageJobs.get(jobKey);
}

export function setPendingOutfitImageJob(jobKey, job) {
  outfitImageJobs.set(jobKey, job);
}

export function deleteOutfitImageJob(jobKey) {
  outfitImageJobs.delete(jobKey);
}

export function clearOutfitImageJobsForEmail(email) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalizedEmail) {
    return;
  }
  const keyPrefix = `${normalizedEmail}::`;
  for (const key of outfitImageJobs.keys()) {
    if (key === normalizedEmail || key.startsWith(keyPrefix)) {
      outfitImageJobs.delete(key);
    }
  }
}
