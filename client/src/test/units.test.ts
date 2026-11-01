import { describe, expect, it } from 'vitest'
import {
  LB_PER_KG,
  convertWeightFromKg,
  convertWeightToKg,
  formatDashboardVolume,
  formatEstimatedOneRepMax,
  formatProfileVolume,
  formatProgressDelta,
  formatVolumeSummary,
  formatWeight,
  formatWeightInput,
  formatWeightValue,
  getDashboardVolumeLabel,
  getMaxWeightInput,
  getWeightUnitLabel,
  kgToLb,
  lbToKg,
  normalizeWeightUnit,
  resolveSubmittedWeightKg,
  roundToSingleDecimal,
  validateWeightInput,
} from '../lib/units'

describe('weight unit conversion and formatting helpers', () => {
  it('uses the exact 1 kg = 2.2046226218 lb conversion factor', () => {
    expect(LB_PER_KG).toBe(2.2046226218)
    expect(kgToLb(1)).toBe(2.2046226218)
    expect(lbToKg(2.2046226218)).toBe(1)
    expect(convertWeightFromKg(100, 'KG')).toBe(100)
    expect(convertWeightFromKg(100, 'LB')).toBeCloseTo(220.46226218, 8)
    expect(convertWeightToKg(225, 'LB')).toBeCloseTo(225 / 2.2046226218, 10)
  })

  it('normalizes unit preferences and labels with KG as the default', () => {
    expect(normalizeWeightUnit()).toBe('KG')
    expect(normalizeWeightUnit(null)).toBe('KG')
    expect(normalizeWeightUnit('KG')).toBe('KG')
    expect(normalizeWeightUnit('LB')).toBe('LB')
    expect(normalizeWeightUnit('invalid')).toBe('KG')
    expect(getWeightUnitLabel('KG')).toBe('kg')
    expect(getWeightUnitLabel('LB')).toBe('lb')
  })

  it('formats weights and estimated 1RM values to at most 1 decimal place', () => {
    expect(roundToSingleDecimal(-0.01)).toBe(0)
    expect(formatWeightValue(80, 'KG')).toBe('80')
    expect(formatWeightValue(77.5, 'KG')).toBe('77.5')
    expect(formatWeight(80, 'KG')).toBe('80 kg')
    expect(formatWeight(80, 'LB')).toBe('176.4 lb')
    expect(formatWeight(100, 'LB')).toBe('220.5 lb')
    expect(formatEstimatedOneRepMax(101.2, 'KG')).toBe('101.2 kg')
    expect(formatEstimatedOneRepMax(101.2, 'LB')).toBe('223.1 lb')
  })

  it('preserves pound entries across single lb -> kg conversion and display formatting', () => {
    for (const enteredLb of [0, 45, 95.5, 135, 185.5, 225, 315, 405]) {
      const canonicalKg = convertWeightToKg(enteredLb, 'LB')
      expect(formatWeightValue(canonicalKg, 'LB')).toBe(enteredLb.toString())
      expect(formatWeight(canonicalKg, 'LB')).toBe(`${enteredLb} lb`)
    }
  })

  it('avoids cumulative round-trip drift when editing unchanged sets in either unit', () => {
    // 100 kg viewed in LB displays as "220.5"; saving without changing weight preserves 100 kg
    const displayInLb = formatWeightInput(100, 'LB')
    expect(displayInLb).toBe('220.5')
    expect(resolveSubmittedWeightKg(displayInLb, 'LB', 100)).toBe(100)
    expect(resolveSubmittedWeightKg('220.50', 'LB', 100)).toBe(100)

    // 135 lb stored in kg, viewed in KG as "61.2"; saving without changing weight preserves exact kg
    const storedFrom135Lb = convertWeightToKg(135, 'LB')
    const displayInKg = formatWeightInput(storedFrom135Lb, 'KG')
    expect(displayInKg).toBe('61.2')
    expect(resolveSubmittedWeightKg(displayInKg, 'KG', storedFrom135Lb)).toBe(storedFrom135Lb)
    expect(formatWeight(resolveSubmittedWeightKg(displayInKg, 'KG', storedFrom135Lb), 'LB')).toBe('135 lb')

    // Changing the input converts the new value once
    expect(resolveSubmittedWeightKg('225', 'LB', 100)).toBeCloseTo(225 / LB_PER_KG, 10)
  })

  it('formats progress deltas and volume summaries for kg and lb', () => {
    expect(formatProgressDelta(0, 'KG')).toBe('0 kg')
    expect(formatProgressDelta(0, 'LB')).toBe('0 lb')
    expect(formatProgressDelta(7.5, 'KG')).toBe('+7.5 kg')
    expect(formatProgressDelta(7.5, 'LB')).toBe('+16.5 lb')
    expect(formatProgressDelta(-5, 'KG')).toBe('-5 kg')
    expect(formatProgressDelta(-5, 'LB')).toBe('-11 lb')

    expect(formatVolumeSummary(1000, 'KG')).toBe('1,000 kg')
    expect(formatVolumeSummary(1000, 'LB')).toBe('2,204.6 lb')
    expect(formatDashboardVolume(350, 'KG')).toBe('350')
    expect(formatDashboardVolume(350, 'LB')).toBe('772')
    expect(formatDashboardVolume(500, 'LB')).toBe('1.1k')
    expect(getDashboardVolumeLabel('KG')).toBe('Kg Lifted')
    expect(getDashboardVolumeLabel('LB')).toBe('Lb Lifted')
    expect(formatProfileVolume(567, 'KG')).toBe('567kg')
    expect(formatProfileVolume(567, 'LB')).toBe('1250lb')
  })

  it('validates weight inputs in both kg and lb within the 1,000 kg canonical limit', () => {
    expect(getMaxWeightInput('KG')).toBe(1000)
    expect(getMaxWeightInput('LB')).toBe(2204.6)
    expect(validateWeightInput('', 'KG')).toBe('Enter a weight.')
    expect(validateWeightInput('-1', 'LB')).toBe('Weight cannot be negative.')
    expect(validateWeightInput('1000', 'KG')).toBe('')
    expect(validateWeightInput('1001', 'KG')).toBe('Maximum is 1,000 kg.')
    expect(validateWeightInput('1500', 'LB')).toBe('')
    expect(validateWeightInput('2204.6', 'LB')).toBe('')
    expect(validateWeightInput('2205', 'LB')).toBe('Maximum is 2,204.6 lb.')
  })
})
