const outfitSetImageJobs = new Map();

export function createOutfitSetImageJobKey(email, capsuleId, setIndex) {
  return `${String(email || "")
    .trim()
    .toLowerCase()}::${String(capsuleId || "").trim()}::${Number.parseInt(setIndex, 10)}`;
}

export function getOutfitSetImageJob(email, capsuleId) {
  const emailPrefix = `${String(email || "")
    .trim()
    .toLowerCase()}::${String(capsuleId || "").trim()}::`;
  const pendingSetIndexes = [];

  for (const [key, job] of outfitSetImageJobs.entries()) {
    if (!key.startsWith(emailPrefix) || job?.status !== "pending") {
      continue;
    }
    pendingSetIndexes.push(job.setIndex);
  }

  if (pendingSetIndexes.length === 0) {
    return null;
  }

  return {
    status: "pending",
    pendingSetIndexes: pendingSetIndexes.sort((left, right) => left - right),
  };
}

export function getOutfitSetImageJobByKey(jobKey) {
  return outfitSetImageJobs.get(jobKey);
}

export function setPendingOutfitSetImageJob(jobKey, job) {
  outfitSetImageJobs.set(jobKey, job);
}

export function deleteOutfitSetImageJob(jobKey) {
  outfitSetImageJobs.delete(jobKey);
}

export function clearOutfitSetImageJobsForEmail(email) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalizedEmail) {
    return;
  }
  const keyPrefix = `${normalizedEmail}::`;
  for (const key of outfitSetImageJobs.keys()) {
    if (key === normalizedEmail || key.startsWith(keyPrefix)) {
      outfitSetImageJobs.delete(key);
    }
  }
}
