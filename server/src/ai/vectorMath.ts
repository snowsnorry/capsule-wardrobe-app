function normalizeVector(vector = []) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("Vector must be a non-empty array");
  }

  let sumSquares = 0;
  const normalizedInput = vector.map((value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new Error("Vector contains non-finite values");
    }
    sumSquares += number * number;
    return number;
  });

  if (sumSquares === 0) {
    throw new Error("Vector magnitude must be greater than zero");
  }

  const magnitude = Math.sqrt(sumSquares);
  return normalizedInput.map((value) => value / magnitude);
}

function buildShiftedTargetVector(
  targetVector,
  rejectedVectors = [],
  alpha = 0.2,
) {
  const normalizedTarget = normalizeVector(targetVector);
  if (!Array.isArray(rejectedVectors) || rejectedVectors.length === 0) {
    return normalizedTarget;
  }

  const dimension = normalizedTarget.length;
  const usableRejectedVectors = rejectedVectors.map((vector) => {
    if (!Array.isArray(vector) || vector.length !== dimension) {
      throw new Error("Rejected vectors must match target vector dimensions");
    }

    return vector.map((value) => {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        throw new Error("Rejected vectors contain non-finite values");
      }
      return number;
    });
  });

  const centroid = Array.from(
    { length: dimension },
    (_, index) =>
      usableRejectedVectors.reduce((sum, vector) => sum + vector[index], 0) /
      usableRejectedVectors.length,
  );
  const shiftedVector = normalizedTarget.map(
    (value, index) => value - Number(alpha) * centroid[index],
  );
  const shiftedMagnitude = Math.sqrt(
    shiftedVector.reduce((sum, value) => sum + value * value, 0),
  );

  if (shiftedMagnitude === 0) {
    return normalizedTarget;
  }

  return shiftedVector.map((value) => value / shiftedMagnitude);
}

function normalizeEmbeddingVector(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const normalized = value.map((entry) => Number(entry));
  return normalized.every((entry) => Number.isFinite(entry))
    ? normalized
    : null;
}

export { buildShiftedTargetVector, normalizeEmbeddingVector, normalizeVector };
