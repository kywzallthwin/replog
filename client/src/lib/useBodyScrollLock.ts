import { useEffect } from 'react'

export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) {
      return
    }

    const scrollY = window.scrollY
    const body = document.body
    const previousPosition = body.style.position
    const previousTop = body.style.top
    const previousWidth = body.style.width
    const previousOverflow = body.style.overflow

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'

    return () => {
      body.style.position = previousPosition
      body.style.top = previousTop
      body.style.width = previousWidth
      body.style.overflow = previousOverflow
      window.scrollTo(0, scrollY)
    }
  }, [isLocked])
}
