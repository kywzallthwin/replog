import { z } from 'zod'

export const DAY_BADGE_COLORS = [
  'bg-amber-100 text-amber-800',
  'bg-blue-100 text-blue-800',
  'bg-pink-100 text-pink-800',
  'bg-indigo-100 text-indigo-800',
  'bg-green-100 text-green-800',
  'bg-purple-100 text-purple-800',
  'bg-rose-100 text-rose-800',
  'bg-teal-100 text-teal-800',
] as const

export const createDaySchema = z.object({
  name: z.string().min(1).max(60),
  badgeColor: z.enum(DAY_BADGE_COLORS),
})

export const updateDaySchema = z.object({
  name: z.string().min(1).max(60).optional(),
  badgeColor: z.enum(DAY_BADGE_COLORS).optional(),
})

export const dayExerciseSchema = z.object({
  exerciseId: z.string().min(1),
})

export const reorderDayExerciseSchema = z.object({
  targetIndex: z.number().int().min(0),
})
