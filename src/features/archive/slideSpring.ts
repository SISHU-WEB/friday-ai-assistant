/**
 * The one-dimensional spring the archive uses to slide its three panels in and
 * out. It is a direct port of the sheetStep / folderStep / readerStep loops from
 * the original archive page (same stiffness, damping and initial velocity), just
 * re-usable for all three panels instead of duplicated three times.
 *
 * It writes `transform` straight onto the DOM node rather than going through
 * React state: the value changes every frame, and re-rendering at 60fps is what
 * makes these transitions stutter.
 */
export interface SlideSpring {
  setOpen(open: boolean): void
  stop(): void
}

interface SlideSpringOptions {
  getElement: () => HTMLElement | null
  axis: 'x' | 'y'
  stiffness: number
  damping: number
  reducedMotion: boolean
}

export function createSlideSpring(options: SlideSpringOptions): SlideSpring {
  let position = 1
  let velocity = 0
  let target = 1
  let running = false
  let lastFrame = 0
  let frame = 0

  const draw = () => {
    const element = options.getElement()
    if (!element) return
    const percent = position * 100
    element.style.transform =
      options.axis === 'y' ? `translateY(${percent}%)` : `translateX(${percent}%)`
  }

  const tick = (now: number) => {
    if (!running) return
    const dt = Math.min((now - lastFrame) / 1000, 0.032)
    lastFrame = now
    const displacement = position - target
    const force = -options.stiffness * displacement - options.damping * velocity
    velocity += force * dt
    position += velocity * dt
    draw()

    if (Math.abs(velocity) < 0.01 && Math.abs(displacement) < 0.005) {
      position = target
      velocity = 0
      running = false
      draw()
      return
    }
    frame = requestAnimationFrame(tick)
  }

  return {
    setOpen(open: boolean) {
      target = open ? 0 : 1

      if (options.reducedMotion) {
        if (frame) cancelAnimationFrame(frame)
        running = false
        position = target
        velocity = 0
        draw()
        return
      }

      velocity = open ? (options.axis === 'y' ? 1.5 : 1.2) : options.axis === 'y' ? -1.5 : -1.2
      if (!running) {
        running = true
        lastFrame = performance.now()
        frame = requestAnimationFrame(tick)
      }
    },
    stop() {
      if (frame) cancelAnimationFrame(frame)
      running = false
    },
  }
}
