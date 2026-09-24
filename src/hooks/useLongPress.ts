import { useRef, useState, type MouseEventHandler, type PointerEventHandler } from 'react'

interface LongPressOptions {
  onPress: () => void
  onLongPress: () => void
  delay?: number
}

export function useLongPress({ onPress, onLongPress, delay = 800 }: LongPressOptions) {
  const timer = useRef<number | null>(null)
  const pressed = useRef(false)
  const longPressed = useRef(false)
  const [isHolding, setIsHolding] = useState(false)

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    pressed.current = false
    setIsHolding(false)
  }

  const onPointerDown: PointerEventHandler<HTMLButtonElement> = (event) => {
    if (event.button !== 0) return
    pressed.current = true
    longPressed.current = false
    setIsHolding(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    timer.current = window.setTimeout(() => {
      if (!pressed.current) return
      longPressed.current = true
      setIsHolding(false)
      onLongPress()
    }, delay)
  }

  const onPointerUp: PointerEventHandler<HTMLButtonElement> = () => {
    const shouldPress = pressed.current && !longPressed.current
    clear()
    if (shouldPress) onPress()
  }

  const onClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    if (event.detail === 0) onPress()
  }

  return {
    isHolding,
    bind: {
      onPointerDown,
      onPointerUp,
      onPointerCancel: clear,
      onPointerLeave: clear,
      onClick,
      onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault(),
    },
  }
}
