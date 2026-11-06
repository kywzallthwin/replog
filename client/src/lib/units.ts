import { useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authMeQueryKey, type AuthUser } from './auth'

export type WeightUnit = 'KG' | 'LB'

export const DEFAULT_WEIGHT_UNIT: WeightUnit = 'KG'
export const LB_PER_KG = 2.2046226218
export const MAX_WEIGHT_KG = 1000

export function normalizeWeightUnit(unit?: string | null): WeightUnit {
  return unit === 'LB' ? 'LB' : 'KG'
}

export function getWeightUnitLabel(unit: WeightUnit = DEFAULT_WEIGHT_UNIT): 'kg' | 'lb' {
  return unit === 'LB' ? 'lb' : 'kg'
}

export function kgToLb(weightKg: number): number {
  return weightKg * LB_PER_KG
}

export function lbToKg(weightLb: number): number {
  return weightLb / LB_PER_KG
}

export function convertWeightFromKg(weightKg: number, unit: WeightUnit = DEFAULT_WEIGHT_UNIT): number {
  return unit === 'LB' ? kgToLb(weightKg) : weightKg
}

export function convertWeightToKg(weight: number, unit: WeightUnit = DEFAULT_WEIGHT_UNIT): number {
  return unit === 'LB' ? lbToKg(weight) : weight
}

export function roundToSingleDecimal(value: number): number {
  const rounded = Math.round((value + Math.sign(value) * Number.EPSILON) * 10) / 10
  return Object.is(rounded, -0) ? 0 : rounded
}

export function formatSingleDecimal(value: number): string {
  const rounded = roundToSingleDecimal(value)
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1)
}

export function formatWeightValue(weightKg: number, unit: WeightUnit = DEFAULT_WEIGHT_UNIT): string {
  return formatSingleDecimal(convertWeightFromKg(weightKg, unit))
}

export function formatWeightInput(weightKg: number, unit: WeightUnit = DEFAULT_WEIGHT_UNIT): string {
  return formatWeightValue(weightKg, unit)
}

export function formatWeight(weightKg: number, unit: WeightUnit = DEFAULT_WEIGHT_UNIT): string {
  return `${formatWeightValue(weightKg, unit)} ${getWeightUnitLabel(unit)}`
}

export function formatEstimatedOneRepMax(weightKg: number, unit: WeightUnit = DEFAULT_WEIGHT_UNIT): string {
  return formatWeight(weightKg, unit)
}

export function formatProgressDelta(progressKg: number, unit: WeightUnit = DEFAULT_WEIGHT_UNIT): string {
  const unitLabel = getWeightUnitLabel(unit)
  const rounded = roundToSingleDecimal(convertWeightFromKg(progressKg, unit))

  if (rounded === 0) {
    return `0 ${unitLabel}`
  }

  const absValue = Math.abs(rounded)
  const formatted = Number.isInteger(absValue) ? absValue.toString() : absValue.toFixed(1)

  return `${rounded > 0 ? '+' : '-'}${formatted} ${unitLabel}`
}

export function formatVolumeSummaryValue(volumeKg: number, unit: WeightUnit = DEFAULT_WEIGHT_UNIT): string {
  const converted = roundToSingleDecimal(convertWeightFromKg(volumeKg, unit))
  return new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(converted)
}

export function formatVolumeSummary(volumeKg: number, unit: WeightUnit = DEFAULT_WEIGHT_UNIT): string {
  return `${formatVolumeSummaryValue(volumeKg, unit)} ${getWeightUnitLabel(unit)}`
}

export function formatDashboardVolume(totalVolumeKg: number, unit: WeightUnit = DEFAULT_WEIGHT_UNIT): string {
  const converted = convertWeightFromKg(totalVolumeKg, unit)

  if (converted >= 1000) {
    return `${(converted / 1000).toFixed(1)}k`
  }

  return Math.round(converted).toString()
}

export function getDashboardVolumeLabel(unit: WeightUnit = DEFAULT_WEIGHT_UNIT): 'Kg Lifted' | 'Lb Lifted' {
  return unit === 'LB' ? 'Lb Lifted' : 'Kg Lifted'
}

export function formatProfileVolume(totalVolumeKg: number, unit: WeightUnit = DEFAULT_WEIGHT_UNIT): string {
  const converted = convertWeightFromKg(totalVolumeKg, unit)
  return `${Math.round(converted)}${getWeightUnitLabel(unit)}`
}

export function getMaxWeightInput(unit: WeightUnit = DEFAULT_WEIGHT_UNIT): number {
  return unit === 'LB' ? roundToSingleDecimal(kgToLb(MAX_WEIGHT_KG)) : MAX_WEIGHT_KG
}

export function validateWeightInput(value: string, unit: WeightUnit = DEFAULT_WEIGHT_UNIT): string {
  const parsed = Number(value)
  if (!value.trim() || !Number.isFinite(parsed)) {
    return 'Enter a weight.'
  }
  if (parsed < 0) {
    return 'Weight cannot be negative.'
  }
  const maxInput = getMaxWeightInput(unit)
  const canonicalKg = convertWeightToKg(parsed, unit)
  if (parsed > maxInput || canonicalKg > MAX_WEIGHT_KG + 1e-6) {
    const formattedMax = new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(maxInput)
    return `Maximum is ${formattedMax} ${getWeightUnitLabel(unit)}.`
  }
  return ''
}

export function resolveSubmittedWeightKg(
  inputValue: string,
  unit: WeightUnit = DEFAULT_WEIGHT_UNIT,
  referenceWeightKg?: number | null,
): number {
  const parsed = Number(inputValue)

  if (typeof referenceWeightKg === 'number' && Number.isFinite(referenceWeightKg)) {
    const referenceDisplay = formatWeightValue(referenceWeightKg, unit)
    if (inputValue.trim() === referenceDisplay || parsed === Number(referenceDisplay)) {
      return Math.min(MAX_WEIGHT_KG, Math.max(0, referenceWeightKg))
    }
  }

  const converted = convertWeightToKg(parsed, unit)
  return Math.min(MAX_WEIGHT_KG, Math.max(0, converted))
}

export function useWeightUnit(): WeightUnit {
  const queryClient = useQueryClient()
  const weightUnit = useSyncExternalStore(
    (onStoreChange) => queryClient.getQueryCache().subscribe(onStoreChange),
    () => queryClient.getQueryData<Pick<AuthUser, 'weightUnit'>>(authMeQueryKey)?.weightUnit,
    () => DEFAULT_WEIGHT_UNIT,
  )

  return normalizeWeightUnit(weightUnit)
}
