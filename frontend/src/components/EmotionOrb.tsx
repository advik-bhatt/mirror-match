'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sphere, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

const LEVEL_COLORS = [
  new THREE.Color('#1d4ed8'), // 0 calm — blue
  new THREE.Color('#d97706'), // 1 frustrated — amber
  new THREE.Color('#dc2626'), // 2 angry — red
  new THREE.Color('#7f1d1d'), // 3 furious — deep red
]

const LEVEL_EMISSIVE = [
  new THREE.Color('#1e3a8a'),
  new THREE.Color('#92400e'),
  new THREE.Color('#991b1b'),
  new THREE.Color('#450a0a'),
]

function OrbMesh({ emotionLevel, anger }: { emotionLevel: number; anger: number }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const t = useRef(0)

  const baseColor = useMemo(() => {
    const lo = LEVEL_COLORS[Math.min(emotionLevel, 3)]
    const hi = LEVEL_COLORS[Math.min(emotionLevel + 1, 3)]
    return lo.clone().lerp(hi, anger % 1)
  }, [emotionLevel, anger])

  const emissiveColor = useMemo(() => {
    const lo = LEVEL_EMISSIVE[Math.min(emotionLevel, 3)]
    const hi = LEVEL_EMISSIVE[Math.min(emotionLevel + 1, 3)]
    return lo.clone().lerp(hi, anger % 1)
  }, [emotionLevel, anger])

  const pulseSpeed = lerp(0.4, 3.0, Math.min(anger, 1))
  const distort = lerp(0.1, 0.7, Math.min(anger, 1))

  useFrame((_, delta) => {
    t.current += delta * pulseSpeed
    if (!meshRef.current) return
    const pulse = Math.sin(t.current) * 0.08 + 1
    meshRef.current.scale.setScalar(pulse)
    meshRef.current.rotation.y += delta * lerp(0.1, 0.8, Math.min(anger, 1))
  })

  return (
    <Sphere ref={meshRef} args={[1, 64, 64]}>
      <MeshDistortMaterial
        color={baseColor}
        emissive={emissiveColor}
        emissiveIntensity={lerp(0.3, 1.8, Math.min(anger, 1))}
        distort={distort}
        speed={pulseSpeed * 2}
        roughness={0.1}
        metalness={0.4}
      />
    </Sphere>
  )
}

function PointLights({ emotionLevel }: { emotionLevel: number }) {
  const lightRef = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    if (!lightRef.current) return
    lightRef.current.position.x = Math.sin(clock.getElapsedTime() * 0.8) * 3
    lightRef.current.position.z = Math.cos(clock.getElapsedTime() * 0.8) * 3
  })
  const intensity = lerp(1, 4, emotionLevel / 3)
  return (
    <>
      <pointLight ref={lightRef} color={LEVEL_COLORS[emotionLevel]} intensity={intensity} distance={8} />
      <pointLight position={[0, 3, 0]} color="#ffffff" intensity={0.5} />
      <ambientLight intensity={0.2} />
    </>
  )
}

interface Props {
  emotionLevel: number
  anger: number
}

export default function EmotionOrb({ emotionLevel, anger }: Props) {
  return (
    <Canvas camera={{ position: [0, 0, 3.5], fov: 45 }}>
      <PointLights emotionLevel={emotionLevel} />
      <OrbMesh emotionLevel={emotionLevel} anger={anger} />
    </Canvas>
  )
}
