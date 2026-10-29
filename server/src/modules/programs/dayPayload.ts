export type DayPayloadExerciseSource = {
  id: string
  exerciseId: string
  order: number
  exercise: {
    name: string
    category?: { id: string; displayName: string; ownerId: string | null } | null
  }
}

export type DayPayloadSource = {
  id: string
  name: string
  badgeColor: string
  order: number
  dayExercises: DayPayloadExerciseSource[]
}

export function toDayExercisePayload(dayExercise: DayPayloadExerciseSource, labels: Map<string, string>) {
  return {
    id: dayExercise.id,
    exerciseId: dayExercise.exerciseId,
    name: dayExercise.exercise.name,
    category: dayExercise.exercise.category
      ? {
          id: dayExercise.exercise.category.id,
          name: labels.get(dayExercise.exercise.category.id) ?? dayExercise.exercise.category.displayName,
          isCustom: dayExercise.exercise.category.ownerId !== null,
        }
      : null,
    order: dayExercise.order,
  }
}

export function toDayPayload(day: DayPayloadSource, labels: Map<string, string>) {
  return {
    id: day.id,
    name: day.name,
    badgeColor: day.badgeColor,
    order: day.order,
    exercises: day.dayExercises.map((exercise) => toDayExercisePayload(exercise, labels)),
  }
}
