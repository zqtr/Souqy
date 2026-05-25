'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Image as DreiImage } from '@react-three/drei';
import * as THREE from 'three';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type MotionValue,
} from 'motion/react';
import type { Showcase3Item, Showcase3Props as BlockShowcase3Props } from '@/lib/blocks/types';
import { souqnaFxClassName, SouqnaFxStyles } from './souqna-fx-styles';

type Props = BlockShowcase3Props & {
  dir?: 'ltr' | 'rtl';
};

const FALLBACK_ITEMS: Showcase3Item[] = [
  {
    id: 'showcase-3-1',
    title: 'Nothing Great Comes Alive Alone',
    category: 'Brand Identity',
    imageUrl:
      'https://cdn.dribbble.com/userupload/46030284/file/8dfdc9a8b09fdbd99b010c1dcb279841.jpg?resize=1024x1693&vertical=center',
  },
  {
    id: 'showcase-3-2',
    title: 'Lost in the Abstract',
    category: 'Art Direction',
    imageUrl:
      'https://cdn.dribbble.com/userupload/46029941/file/f3b0e906d38980bf48e008f5542a58b5.jpg?resize=1024x1693&vertical=center',
  },
  {
    id: 'showcase-3-3',
    title: 'Geometric Perspectives',
    category: 'Digital Art',
    imageUrl:
      'https://cdn.dribbble.com/userupload/45777759/file/acf14657b38cd25e64bb16b4f201bef8.jpg?resize=1024x1529&vertical=center',
  },
];

const CARD_WIDTH = 3.1;
const CARD_HEIGHT = 4.35;
const FINAL_RADIUS = 2.1;

function normalizeItems(items?: Showcase3Item[]): Showcase3Item[] {
  const cleaned = (items ?? []).filter((item) => item.imageUrl?.trim());
  return cleaned.length ? cleaned.slice(0, 6) : FALLBACK_ITEMS;
}

function CarouselCard({
  item,
  index,
  count,
  introSpring,
}: {
  item: Showcase3Item;
  index: number;
  count: number;
  introSpring: MotionValue<number>;
}) {
  const angle = (index / count) * Math.PI * 2;
  const group = useRef<THREE.Group>(null);
  const imageRef = useRef<THREE.Mesh & { material: THREE.Material & { opacity: number } }>(null);

  useFrame(() => {
    if (!group.current || !imageRef.current) return;
    const progress = introSpring.get();

    group.current.position.z = THREE.MathUtils.lerp(0, FINAL_RADIUS, progress);
    group.current.scale.setScalar(THREE.MathUtils.lerp(0.5, 1, progress));
    imageRef.current.material.opacity = progress;
    group.current.position.y = THREE.MathUtils.lerp(-2, 0, progress);
  });

  return (
    <group rotation={[0, angle, 0]}>
      <group ref={group} position={[0, 0, FINAL_RADIUS]}>
        <DreiImage
          ref={imageRef}
          url={item.imageUrl}
          transparent
          side={THREE.DoubleSide}
          toneMapped={false}
          scale={[CARD_WIDTH, CARD_HEIGHT] as [number, number]}
        />
      </group>
    </group>
  );
}

function ResizeHandler() {
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const { gl, camera } = useThree();

  useEffect(() => {
    glRef.current = gl;
    cameraRef.current = camera;
  }, [gl, camera]);

  useEffect(() => {
    const canvas = gl.domElement;
    const parent = canvas.parentElement;
    if (!parent) return;

    const updateSize = () => {
      const currentGl = glRef.current;
      const currentCamera = cameraRef.current;
      if (!currentGl || !currentCamera) return;

      const width = parent.clientWidth;
      const height = parent.clientHeight;
      if (width > 0 && height > 0) {
        currentGl.setSize(width, height);
        if (currentCamera instanceof THREE.PerspectiveCamera) {
          currentCamera.aspect = width / height;
          currentCamera.updateProjectionMatrix();
        }
      }
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(parent);

    const interval = setInterval(updateSize, 500);
    const timeouts = [
      setTimeout(updateSize, 100),
      setTimeout(updateSize, 300),
      setTimeout(updateSize, 1000),
    ];

    return () => {
      observer.disconnect();
      clearInterval(interval);
      timeouts.forEach(clearTimeout);
    };
  }, [gl]);

  return null;
}

function Rig({
  items,
  reducedMotion,
  onActiveIndexChange,
}: {
  items: Showcase3Item[];
  reducedMotion: boolean;
  onActiveIndexChange: (index: number) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);

  const dragX = useMotionValue(0);
  const rotation = useSpring(dragX, {
    stiffness: reducedMotion ? 360 : 260,
    damping: reducedMotion ? 35 : 20,
    mass: 1,
  });

  const introSpring = useSpring(reducedMotion ? 1 : 0, {
    stiffness: 50,
    damping: 15,
  });

  useEffect(() => {
    if (reducedMotion) {
      introSpring.set(1);
      return;
    }
    const timeout = setTimeout(() => introSpring.set(1), 200);
    return () => clearTimeout(timeout);
  }, [introSpring, reducedMotion]);

  const { viewport } = useThree();
  const isMobile = viewport.width < 10;
  const baseScale = isMobile ? 0.7 : 1;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const segment = (Math.PI * 2) / items.length;
      const currentTarget = dragX.get();
      const currentIndex = Math.round(currentTarget / segment);

      if (e.key === 'ArrowLeft') {
        dragX.set((currentIndex - 1) * segment);
        onActiveIndexChange(((-(currentIndex - 1) % items.length) + items.length) % items.length);
      } else if (e.key === 'ArrowRight') {
        dragX.set((currentIndex + 1) * segment);
        onActiveIndexChange(((-(currentIndex + 1) % items.length) + items.length) % items.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dragX, items.length, onActiveIndexChange]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    setIsDragging(true);
    setStartX(e.nativeEvent.clientX);
    (e.nativeEvent.target as Element).setPointerCapture(e.nativeEvent.pointerId);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging) return;
    const deltaX = e.nativeEvent.clientX - startX;
    setStartX(e.nativeEvent.clientX);
    dragX.set(dragX.get() + deltaX * 0.005);
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    setIsDragging(false);
    (e.nativeEvent.target as Element).releasePointerCapture(e.nativeEvent.pointerId);

    const segment = (Math.PI * 2) / items.length;
    const currentLogicalIndex = dragX.get() / segment;
    const velocity = rotation.getVelocity();
    let snapIndex = Math.round(currentLogicalIndex);

    if (Math.abs(velocity) > 0.2) {
      const direction = Math.sign(velocity);
      const currentVisualIndex = Math.round(rotation.get() / segment);
      snapIndex = currentVisualIndex + direction;
    }

    dragX.set(snapIndex * segment);
    onActiveIndexChange(((-snapIndex % items.length) + items.length) % items.length);
  };

  useFrame(() => {
    if (!group.current) return;
    group.current.rotation.y = rotation.get();
  });

  return (
    <>
      <mesh
        position={[0, 0, FINAL_RADIUS]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        visible={false}
      >
        <planeGeometry args={[100, 100]} />
      </mesh>

      <group ref={group} scale={baseScale}>
        {items.map((item, i) => (
          <CarouselCard
            key={item.id ?? `${item.title}-${i}`}
            item={item}
            index={i}
            count={items.length}
            introSpring={introSpring}
          />
        ))}
      </group>
    </>
  );
}

export function Showcase3({
  title = 'Case Studies',
  subtitle = "See others we've helped with this program",
  items,
  dir = 'ltr',
}: Props) {
  const shouldReduceMotion = useReducedMotion();
  const normalizedItems = useMemo(() => normalizeItems(items), [items]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeItem = normalizedItems[activeIndex % normalizedItems.length] ?? normalizedItems[0];

  useEffect(() => {
    if (activeIndex >= normalizedItems.length) setActiveIndex(0);
  }, [activeIndex, normalizedItems.length]);

  useLayoutEffect(() => {
    const checkReady = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setIsReady(true);
        } else {
          requestAnimationFrame(checkReady);
        }
      }
    };
    checkReady();
  }, []);

  return (
    <section
      dir={dir}
      className={`${souqnaFxClassName} w-full overflow-hidden bg-white py-8 text-neutral-900 dark:bg-neutral-950 dark:text-white sm:py-10`}
    >
      <SouqnaFxStyles />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-5 text-center">
          {title ? (
            <motion.h2
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="mb-3 text-2xl font-semibold text-neutral-900 dark:text-white sm:text-3xl md:text-4xl"
            >
              {title}
            </motion.h2>
          ) : null}
          {subtitle ? (
            <motion.p
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
              className="text-sm text-neutral-600 dark:text-neutral-400"
            >
              {subtitle}
            </motion.p>
          ) : null}
        </div>

        <div className="relative flex w-full flex-col items-center justify-center">
          <div
            ref={containerRef}
            className="h-[240px] w-full cursor-grab active:cursor-grabbing sm:h-[320px]"
          >
            {isReady ? (
              <Canvas
                camera={{ position: [0, 0, 11], fov: 45 }}
                gl={{ antialias: true, alpha: true }}
                dpr={[1, 2]}
                frameloop="always"
              >
                <ResizeHandler />
                <ambientLight intensity={0.5} />
                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
                <Rig
                  items={normalizedItems}
                  reducedMotion={Boolean(shouldReduceMotion)}
                  onActiveIndexChange={setActiveIndex}
                />
              </Canvas>
            ) : null}
          </div>

          {activeItem ? (
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
              className="pointer-events-none mt-5 w-full text-center"
            >
              <div className="inline-block">
                {activeItem.category ? (
                  <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
                    {activeItem.category}
                  </span>
                ) : null}
                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white sm:text-2xl">
                  {activeItem.title}
                </h3>
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
