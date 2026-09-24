import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

interface ThreeFolderProps {
  color?: string
}

export function ThreeFolder({ color = '#e8e8e8' }: ThreeFolderProps) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mountRef.current) return

    const mount = mountRef.current
    const width = mount.clientWidth
    const height = mount.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = null

    // Camera
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100)
    camera.position.set(0, 0, 3.5)
    camera.lookAt(0, 0, 0)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5)
    dirLight.position.set(2, 3, 4)
    scene.add(dirLight)

    const rimLight = new THREE.DirectionalLight(0x42db7a, 0.3)
    rimLight.position.set(-2, -1, -2)
    scene.add(rimLight)

    // Load GLB model
    const loader = new GLTFLoader()
    let model: THREE.Object3D | null = null
    let frameId: number

    loader.load('/folder.glb', (gltf) => {
      model = gltf.scene

      // Scale and center the model
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 1.2 / maxDim
      model.scale.setScalar(scale)

      // Center
      const center = box.getCenter(new THREE.Vector3())
      model.position.sub(center.multiplyScalar(scale))

      // Recolor
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          mats.forEach((m) => {
            if (m instanceof THREE.MeshStandardMaterial) {
              m.color = new THREE.Color(color)
              m.roughness = 0.3
              m.metalness = 0.1
            }
          })
        }
      })

      scene.add(model)
    })

    // Animation loop
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      if (model) {
        model.rotation.y += 0.005
      }
      renderer.render(scene, camera)
    }
    animate()

    // Handle resize
    const handleResize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [color])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}
