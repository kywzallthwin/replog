import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { ExerciseCategory } from "../src/generated/prisma/enums.js";

const databaseUrl = process.env["DATABASE_URL"] ?? "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

const demoUser = {
  email: "demo@replog.local",
  username: "demo",
  avatarInitial: "D",
};

const globalExercises = [
  { name: "Bench Press", category: ExerciseCategory.CHEST },
  { name: "Incline Dumbbell Press", category: ExerciseCategory.CHEST },
  { name: "Cable Fly", category: ExerciseCategory.CHEST },
  { name: "Lat Pulldown", category: ExerciseCategory.BACK },
  { name: "Barbell Row", category: ExerciseCategory.BACK },
  { name: "Seated Cable Row", category: ExerciseCategory.BACK },
  { name: "Overhead Press", category: ExerciseCategory.SHOULDERS },
  { name: "Lateral Raise", category: ExerciseCategory.SHOULDERS },
  { name: "Rear Delt Fly", category: ExerciseCategory.SHOULDERS },
  { name: "Squat", category: ExerciseCategory.LEGS },
  { name: "Romanian Deadlift", category: ExerciseCategory.LEGS },
  { name: "Leg Press", category: ExerciseCategory.LEGS },
  { name: "Barbell Curl", category: ExerciseCategory.ARMS },
  { name: "Triceps Pushdown", category: ExerciseCategory.ARMS },
  { name: "Hammer Curl", category: ExerciseCategory.ARMS },
  { name: "Cable Crunch", category: ExerciseCategory.CORE },
  { name: "Plank", category: ExerciseCategory.CORE },
];

const exampleDays = [
  {
    name: "PUSH",
    badgeColor: "bg-rose-100 text-rose-700",
    order: 1,
    exercises: [
      "Bench Press",
      "Incline Dumbbell Press",
      "Overhead Press",
      "Lateral Raise",
      "Triceps Pushdown",
    ],
  },
  {
    name: "PULL",
    badgeColor: "bg-sky-100 text-sky-700",
    order: 2,
    exercises: ["Lat Pulldown", "Barbell Row", "Seated Cable Row", "Barbell Curl"],
  },
  {
    name: "LEGS",
    badgeColor: "bg-emerald-100 text-emerald-700",
    order: 3,
    exercises: ["Squat", "Romanian Deadlift", "Leg Press", "Cable Crunch"],
  },
  {
    name: "TORSO A",
    badgeColor: "bg-violet-100 text-violet-700",
    order: 4,
    exercises: ["Bench Press", "Lat Pulldown", "Lateral Raise", "Barbell Curl"],
  },
  {
    name: "LOWER+ARMS B",
    badgeColor: "bg-amber-100 text-amber-700",
    order: 5,
    exercises: ["Squat", "Romanian Deadlift", "Triceps Pushdown", "Hammer Curl"],
  },
];

async function getOrCreateGlobalExercise(name: string, category: ExerciseCategory) {
  const existing = await prisma.exercise.findFirst({
    where: {
      name,
      category,
      ownerId: null,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.exercise.create({
    data: {
      name,
      category,
    },
  });
}

async function main() {
  const user = await prisma.user.upsert({
    where: { email: demoUser.email },
    update: {
      username: demoUser.username,
      avatarInitial: demoUser.avatarInitial,
    },
    create: demoUser,
  });

  const exerciseByName = new Map<string, string>();

  for (const exercise of globalExercises) {
    const record = await getOrCreateGlobalExercise(exercise.name, exercise.category);
    exerciseByName.set(record.name, record.id);
  }

  const existingProgram = await prisma.program.findFirst({
    where: {
      ownerId: user.id,
      name: "Example Program",
    },
  });

  await prisma.program.updateMany({
    where: {
      ownerId: user.id,
      name: { not: "Example Program" },
    },
    data: { isActive: false },
  });

  const program = existingProgram
    ? await prisma.program.update({
        where: { id: existingProgram.id },
        data: { isActive: true },
      })
    : await prisma.program.create({
        data: {
          ownerId: user.id,
          name: "Example Program",
          isActive: true,
        },
      });

  for (const daySeed of exampleDays) {
    const existingDay = await prisma.day.findFirst({
      where: {
        programId: program.id,
        order: daySeed.order,
      },
    });

    const day = existingDay
      ? await prisma.day.update({
          where: { id: existingDay.id },
          data: {
            name: daySeed.name,
            badgeColor: daySeed.badgeColor,
          },
        })
      : await prisma.day.create({
          data: {
            programId: program.id,
            name: daySeed.name,
            badgeColor: daySeed.badgeColor,
            order: daySeed.order,
          },
        });

    for (const [index, exerciseName] of daySeed.exercises.entries()) {
      const exerciseId = exerciseByName.get(exerciseName);

      if (!exerciseId) {
        throw new Error(`Missing seeded exercise: ${exerciseName}`);
      }

      const order = index + 1;
      const existingDayExercise = await prisma.dayExercise.findFirst({
        where: {
          dayId: day.id,
          order,
        },
      });

      if (existingDayExercise) {
        await prisma.dayExercise.update({
          where: { id: existingDayExercise.id },
          data: { exerciseId },
        });
      } else {
        await prisma.dayExercise.create({
          data: {
            dayId: day.id,
            exerciseId,
            order,
          },
        });
      }
    }
  }

  console.log(
    `Seeded ${globalExercises.length} global exercises and ${exampleDays.length} routine days for ${demoUser.email}.`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
