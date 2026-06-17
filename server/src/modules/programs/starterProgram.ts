import { ExerciseCategory } from '../../generated/prisma/enums.js'
import { prisma } from '../../prisma.js'

const globalExercises = [
  { name: 'Bench Press', category: ExerciseCategory.CHEST },
  { name: 'Incline Dumbbell Press', category: ExerciseCategory.CHEST },
  { name: 'Cable Fly', category: ExerciseCategory.CHEST },
  { name: 'Lat Pulldown', category: ExerciseCategory.BACK },
  { name: 'Barbell Row', category: ExerciseCategory.BACK },
  { name: 'Seated Cable Row', category: ExerciseCategory.BACK },
  { name: 'Overhead Press', category: ExerciseCategory.SHOULDERS },
  { name: 'Lateral Raise', category: ExerciseCategory.SHOULDERS },
  { name: 'Rear Delt Fly', category: ExerciseCategory.SHOULDERS },
  { name: 'Squat', category: ExerciseCategory.LEGS },
  { name: 'Romanian Deadlift', category: ExerciseCategory.LEGS },
  { name: 'Leg Press', category: ExerciseCategory.LEGS },
  { name: 'Barbell Curl', category: ExerciseCategory.ARMS },
  { name: 'Triceps Pushdown', category: ExerciseCategory.ARMS },
  { name: 'Hammer Curl', category: ExerciseCategory.ARMS },
  { name: 'Cable Crunch', category: ExerciseCategory.CORE },
  { name: 'Plank', category: ExerciseCategory.CORE },
]

const exampleDays = [
  {
    name: 'PUSH',
    badgeColor: 'bg-amber-100 text-amber-800',
    order: 1,
    exercises: ['Bench Press', 'Incline Dumbbell Press', 'Overhead Press', 'Lateral Raise', 'Triceps Pushdown'],
  },
  {
    name: 'PULL',
    badgeColor: 'bg-blue-100 text-blue-800',
    order: 2,
    exercises: ['Lat Pulldown', 'Barbell Row', 'Seated Cable Row', 'Barbell Curl'],
  },
  {
    name: 'LEGS',
    badgeColor: 'bg-pink-100 text-pink-800',
    order: 3,
    exercises: ['Squat', 'Romanian Deadlift', 'Leg Press', 'Cable Crunch'],
  },
  {
    name: 'TORSO A',
    badgeColor: 'bg-indigo-100 text-indigo-800',
    order: 4,
    exercises: ['Bench Press', 'Lat Pulldown', 'Lateral Raise', 'Barbell Curl'],
  },
  {
    name: 'LOWER+ARMS B',
    badgeColor: 'bg-green-100 text-green-800',
    order: 5,
    exercises: ['Squat', 'Romanian Deadlift', 'Triceps Pushdown', 'Hammer Curl'],
  },
]

async function getOrCreateGlobalExercise(name: string, category: ExerciseCategory) {
  const existing = await prisma.exercise.findFirst({
    where: {
      name,
      category,
      ownerId: null,
    },
  })

  if (existing) {
    return existing
  }

  return prisma.exercise.create({
    data: {
      name,
      category,
    },
  })
}

export async function createStarterProgramForUser(userId: string) {
  const existingActiveProgram = await prisma.program.findFirst({
    where: {
      ownerId: userId,
      isActive: true,
    },
  })

  if (existingActiveProgram) {
    return existingActiveProgram
  }

  const exerciseByName = new Map<string, string>()

  for (const exercise of globalExercises) {
    const record = await getOrCreateGlobalExercise(exercise.name, exercise.category)
    exerciseByName.set(record.name, record.id)
  }

  const program = await prisma.program.create({
    data: {
      ownerId: userId,
      name: 'Example Program',
      isActive: true,
    },
  })

  for (const daySeed of exampleDays) {
    const day = await prisma.day.create({
      data: {
        programId: program.id,
        name: daySeed.name,
        badgeColor: daySeed.badgeColor,
        order: daySeed.order,
      },
    })

    for (const [index, exerciseName] of daySeed.exercises.entries()) {
      const exerciseId = exerciseByName.get(exerciseName)

      if (!exerciseId) {
        throw new Error(`Missing starter exercise: ${exerciseName}`)
      }

      await prisma.dayExercise.create({
        data: {
          dayId: day.id,
          exerciseId,
          order: index + 1,
        },
      })
    }
  }

  return program
}
