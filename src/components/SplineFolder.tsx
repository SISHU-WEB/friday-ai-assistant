import { useRef } from 'react'
import Spline from '@splinetool/react-spline'

const SCENE_URL = 'https://prod.spline.design/OkpMpuIIKUGa3LxB/scene.splinecode?v=' + Date.now()

export function SplineFolder() {
  const containerRef = useRef<HTMLDivElement>(null)

  const onLoad = (splineApp: any) => {
    try {
      // Access the Three.js renderer
      const renderer = splineApp.renderer || splineApp._renderer
      if (renderer) {
        // Set clear color to transparent
        if (renderer.setClearColor) {
          renderer.setClearColor(0x000000, 0)
        }
        if (renderer.domElement) {
          renderer.domElement.style.background = 'transparent'
        }
      }
      // Access the scene and remove background
      const scene = splineApp.scene
      if (scene) {
        scene.background = null
      }
    } catch (e) {
      console.log('Spline transparent fix:', e)
    }
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', background: 'transparent' }}>
      <Spline scene={SCENE_URL} onLoad={onLoad} />
    </div>
  )
}