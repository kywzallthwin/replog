import { useEffect } from 'react'

type BodyStyleSnapshot = {
  position: string
  top: string
  width: string
  overflow: string
  scrollY: number
}

let lockCount = 0
let bodyStyleSnapshot: BodyStyleSnapshot | null = null

function lockBodyScroll() {
  if (lockCount === 0) {
    const body = document.body

    bodyStyleSnapshot = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
      scrollY: window.scrollY,
    }

    body.style.position = 'fixed'
    body.style.top = `-${bodyStyleSnapshot.scrollY}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'
  }

  lockCount += 1
}

function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount > 0 || !bodyStyleSnapshot) {
    return
  }

  const body = document.body
  const { position, top, width, overflow, scrollY } = bodyStyleSnapshot
  body.style.position = position
  body.style.top = top
  body.style.width = width
  body.style.overflow = overflow
  bodyStyleSnapshot = null

  if (window.scrollY !== scrollY) {
    window.scrollTo(0, scrollY)
  }
}

export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) {
      return
    }

    lockBodyScroll()

    return unlockBodyScroll
  }, [isLocked])
}
