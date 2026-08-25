type StrengthSet = {
  weightKg: number
  reps: number
}

export function estimateOneRepMaxKg(set: StrengthSet) {
  if (set.reps === 1) {
    return set.weightKg
  }

  return set.weightKg * (1 + set.reps / 30)
}

export function isBetterEstimatedSet(candidate: StrengthSet, current: StrengthSet | null) {
  if (!current) {
    return true
  }

  const candidateEstimate = estimateOneRepMaxKg(candidate)
  const currentEstimate = estimateOneRepMaxKg(current)
  const estimateDifference = candidateEstimate - currentEstimate

  if (Math.abs(estimateDifference) > 1e-9) {
    return estimateDifference > 0
  }

  if (candidate.weightKg !== current.weightKg) {
    return candidate.weightKg > current.weightKg
  }

  return candidate.reps > current.reps
}
