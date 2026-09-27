import { prisma } from '../../prisma.js'

export function normalizeCategoryName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export async function loadCategoryLabels(userId: string) {
  const labels = await prisma.userCategoryLabel.findMany({ where: { userId }, select: { categoryId: true, displayName: true } })
  return new Map(labels.map((label) => [label.categoryId, label.displayName]))
}

export async function hasCategoryNameConflict(userId: string, name: string, excludedCategoryId?: string) {
  const normalizedName = normalizeCategoryName(name)
  const categories = await prisma.exerciseCategory.findMany({ where: { OR: [{ ownerId: null }, { ownerId: userId }] }, select: { id: true, displayName: true, normalizedName: true, ownerId: true } })
  const labels = await loadCategoryLabels(userId)

  return categories.some((category) => {
    if (category.id === excludedCategoryId) return false
    const effectiveName = category.ownerId === null ? labels.get(category.id) ?? category.displayName : category.displayName
    return normalizeCategoryName(effectiveName) === normalizedName
  })
}
