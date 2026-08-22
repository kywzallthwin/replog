import { ExerciseCategory } from '../../generated/prisma/enums.js'
import { prisma } from '../../prisma.js'

export const globalExercises = [
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
] as const

export type ProgramTemplate = {
  id: string
  name: string
  description: string
  days: Array<{
    name: string
    badgeColor: string
    exercises: string[]
  }>
}

export const programTemplates: ProgramTemplate[] = [
  {
    id: 'beginner-full-body',
    name: 'Beginner Full Body',
    description: 'Three balanced days for learning the main movement patterns.',
    days: [
      {
        name: 'FULL BODY A',
        badgeColor: 'bg-amber-100 text-amber-800',
        exercises: ['Squat', 'Bench Press', 'Lat Pulldown', 'Overhead Press', 'Cable Crunch'],
      },
      {
        name: 'FULL BODY B',
        badgeColor: 'bg-blue-100 text-blue-800',
        exercises: ['Romanian Deadlift', 'Incline Dumbbell Press', 'Seated Cable Row', 'Lateral Raise', 'Plank'],
      },
      {
        name: 'FULL BODY C',
        badgeColor: 'bg-green-100 text-green-800',
        exercises: ['Leg Press', 'Bench Press', 'Barbell Row', 'Triceps Pushdown', 'Barbell Curl'],
      },
    ],
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    description: 'A four-day split that balances training frequency and recovery.',
    days: [
      {
        name: 'UPPER A',
        badgeColor: 'bg-indigo-100 text-indigo-800',
        exercises: ['Bench Press', 'Barbell Row', 'Overhead Press', 'Lat Pulldown', 'Triceps Pushdown'],
      },
      {
        name: 'LOWER A',
        badgeColor: 'bg-pink-100 text-pink-800',
        exercises: ['Squat', 'Romanian Deadlift', 'Leg Press', 'Cable Crunch'],
      },
      {
        name: 'UPPER B',
        badgeColor: 'bg-purple-100 text-purple-800',
        exercises: ['Incline Dumbbell Press', 'Seated Cable Row', 'Lateral Raise', 'Barbell Curl', 'Rear Delt Fly'],
      },
      {
        name: 'LOWER B',
        badgeColor: 'bg-teal-100 text-teal-800',
        exercises: ['Leg Press', 'Romanian Deadlift', 'Squat', 'Hammer Curl', 'Plank'],
      },
    ],
  },
  {
    id: 'push-pull-legs',
    name: 'Push / Pull / Legs',
    description: 'A simple three-day split organized by movement focus.',
    days: [
      {
        name: 'PUSH',
        badgeColor: 'bg-amber-100 text-amber-800',
        exercises: ['Bench Press', 'Incline Dumbbell Press', 'Overhead Press', 'Lateral Raise', 'Triceps Pushdown'],
      },
      {
        name: 'PULL',
        badgeColor: 'bg-blue-100 text-blue-800',
        exercises: ['Lat Pulldown', 'Barbell Row', 'Seated Cable Row', 'Rear Delt Fly', 'Barbell Curl'],
      },
      {
        name: 'LEGS',
        badgeColor: 'bg-pink-100 text-pink-800',
        exercises: ['Squat', 'Romanian Deadlift', 'Leg Press', 'Cable Crunch', 'Plank'],
      },
    ],
  },
  {
    id: 'example-program',
    name: 'Example Program',
    description: 'The original five-day RepLog example routine.',
    days: [
      {
        name: 'PUSH',
        badgeColor: 'bg-amber-100 text-amber-800',
        exercises: ['Bench Press', 'Incline Dumbbell Press', 'Overhead Press', 'Lateral Raise', 'Triceps Pushdown'],
      },
      {
        name: 'PULL',
        badgeColor: 'bg-blue-100 text-blue-800',
        exercises: ['Lat Pulldown', 'Barbell Row', 'Seated Cable Row', 'Barbell Curl'],
      },
      {
        name: 'LEGS',
        badgeColor: 'bg-pink-100 text-pink-800',
        exercises: ['Squat', 'Romanian Deadlift', 'Leg Press', 'Cable Crunch'],
      },
      {
        name: 'TORSO A',
        badgeColor: 'bg-indigo-100 text-indigo-800',
        exercises: ['Bench Press', 'Lat Pulldown', 'Lateral Raise', 'Barbell Curl'],
      },
      {
        name: 'LOWER+ARMS B',
        badgeColor: 'bg-green-100 text-green-800',
        exercises: ['Squat', 'Romanian Deadlift', 'Triceps Pushdown', 'Hammer Curl'],
      },
    ],
  },
]

export function normalizeProgramName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

async function getOrCreateGlobalExercise(db: typeof prisma, name: string, category: ExerciseCategory) {
  const existing = await db.exercise.findFirst({
    where: {
      name,
      category,
      ownerId: null,
    },
  })

  if (existing) {
    return existing
  }

  return db.exercise.create({
    data: {
      name,
      category,
    },
  })
}

type ProgramDatabase = typeof prisma

export async function createProgramFromDays(
  db: ProgramDatabase,
  userId: string,
  name: string,
  days: ProgramTemplate['days'],
  isActive: boolean,
) {
  const exerciseByName = new Map<string, string>()

  for (const exercise of globalExercises) {
    const record = await getOrCreateGlobalExercise(db, exercise.name, exercise.category)
    exerciseByName.set(record.name, record.id)
  }

  return db.program.create({
    data: {
      ownerId: userId,
      name: name.trim(),
      nameKey: normalizeProgramName(name),
      isActive,
      activeKey: isActive ? 'active' : null,
      days: {
        create: days.map((day, dayIndex) => ({
          name: day.name,
          badgeColor: day.badgeColor,
          order: dayIndex + 1,
          dayExercises: {
            create: day.exercises.map((exerciseName, exerciseIndex) => {
              const exerciseId = exerciseByName.get(exerciseName)

              if (!exerciseId) {
                throw new Error(`Missing program exercise: ${exerciseName}`)
              }

              return { exerciseId, order: exerciseIndex + 1 }
            }),
          },
        })),
      },
    },
  })
}

export async function createProgramFromTemplate(
  userId: string,
  template: ProgramTemplate,
  name = template.name,
  isActive = false,
) {
  return prisma.$transaction(async (tx) => {
    return createProgramFromDays(tx as unknown as typeof prisma, userId, name, template.days, isActive)
  })
}

export async function createStarterProgramForUser(userId: string) {
  return prisma.$transaction(async (tx) => {
    const db = tx as unknown as typeof prisma
    const programs = await db.program.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
    })

    if (programs.length) {
      const activeProgram = programs.find((program) => program.isActive) ?? programs[0]

      if (activeProgram && !activeProgram.isActive) {
        await db.program.updateMany({ where: { ownerId: userId }, data: { isActive: false, activeKey: null } })
        return db.program.update({ where: { id: activeProgram.id }, data: { isActive: true, activeKey: 'active' } })
      }

      return activeProgram
    }

    const starterTemplate = programTemplates[0]

    if (!starterTemplate) {
      throw new Error('Beginner starter template is missing')
    }

    return createProgramFromDays(db, userId, starterTemplate.name, starterTemplate.days, true)
  })
}
