"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
  BOX_DIMENSIONS,
  BOX_FACE_CONFIG,
  BOX_FACE_ORDER,
  type BoxFaceKey,
} from "@/lib/boxLayoutConfig";
import { usePreviewStore } from "@/lib/previewStore";
import { useDocumentStore } from "@/lib/store";

type RotationTuple = [number, number, number];

const FACE_ORIENTATIONS: Record<BoxFaceKey, RotationTuple> = {
  front: [0, 0, 0],
  right: [0, -Math.PI / 2, 0],
  back: [0, Math.PI, 0],
  left: [0, Math.PI / 2, 0],
  top: [-Math.PI / 2, 0, 0],
  bottom: [Math.PI / 2, 0, 0],
};

const FACE_VIEW_SEQUENCE: BoxFaceKey[] = [
  "front",
  "right",
  "back",
  "left",
  "top",
  "bottom",
];

const BOX_SCALE = 0.01;
const BOX_GEOMETRY: [number, number, number] = [
  BOX_DIMENSIONS.width * BOX_SCALE,
  BOX_DIMENSIONS.height * BOX_SCALE,
  BOX_DIMENSIONS.depth * BOX_SCALE,
];

const MAX_TEXTURE_PIXEL_RATIO = 4;

type SceneResources = {
  renderer: THREE.WebGLRenderer;
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
};

export default function RightPanel3DClient() {
  const faces = usePreviewStore((state) => state.faces);
  const canvasRotation = useDocumentStore((state) => state.rotation);
  const [viewIndex, setViewIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneResources | null>(null);
  const animationRef = useRef<number>();
  const targetRotationRef = useRef<RotationTuple>(FACE_ORIENTATIONS.front);
  const textureLoaderRef = useRef(new THREE.TextureLoader());
  const faceVersionsRef = useRef<Record<BoxFaceKey, number>>(
    BOX_FACE_ORDER.reduce((acc, key) => {
      acc[key] = -1;
      return acc;
    }, {} as Record<BoxFaceKey, number>),
  );

  const currentFace = FACE_VIEW_SEQUENCE[viewIndex];
  const targetRotation = useMemo<RotationTuple>(
    () => [...FACE_ORIENTATIONS[currentFace]] as RotationTuple,
    [currentFace],
  );

  useEffect(() => {
    targetRotationRef.current = targetRotation;
  }, [targetRotation]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f8fafc");

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0.6, 1.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio ?? 1, MAX_TEXTURE_PIXEL_RATIO),
    );
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(2.5, 3.2, 4);
    const pointLight = new THREE.PointLight(0xffffff, 0.35);
    pointLight.position.set(-2.5, -1.8, -3);
    scene.add(ambientLight, directionalLight, pointLight);

    const geometry = new THREE.BoxGeometry(...BOX_GEOMETRY);
    const materials = new Array(6).fill(null).map(
      () =>
        new THREE.MeshStandardMaterial({
          color: "#e2e8f0",
          roughness: 0.8,
          metalness: 0.05,
          toneMapped: false,
        }),
    );

    const boxMesh = new THREE.Mesh(geometry, materials);
    boxMesh.castShadow = true;
    boxMesh.receiveShadow = true;

    const edgesGeometry = new THREE.EdgesGeometry(geometry, 1);
    const edgesMaterial = new THREE.LineBasicMaterial({ color: "#94a3b8" });
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    edges.scale.setScalar(1.002);
    boxMesh.add(edges);

    const group = new THREE.Group();
    group.add(boxMesh);
    scene.add(group);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const clock = new THREE.Clock();

    const boxViewDirection = new THREE.Vector3(1.15, 0.6, 1.8).normalize();
    const boxCenter = new THREE.Vector3();
    const boxSize = new THREE.Vector3();
    const boxBoundingBox = new THREE.Box3();

    const updateCameraFraming = () => {
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;

      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      boxBoundingBox.setFromObject(group);
      boxBoundingBox.getCenter(boxCenter);
      boxBoundingBox.getSize(boxSize);

      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov =
        2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect || 1);

      const fitHeightDistance = boxSize.y / (2 * Math.tan(verticalFov / 2));
      const fitWidthDistance = boxSize.x / (2 * Math.tan(horizontalFov / 2));
      const fitDepthDistance = boxSize.z / (2 * Math.tan(horizontalFov / 2));
      const fitDistance =
        Math.max(fitHeightDistance, fitWidthDistance, fitDepthDistance) * 1.15;

      const newCameraPosition = boxViewDirection
        .clone()
        .multiplyScalar(fitDistance)
        .add(boxCenter);

      camera.position.copy(newCameraPosition);
      controls.target.copy(boxCenter);
      controls.minDistance = fitDistance * 0.65;
      controls.maxDistance = fitDistance * 1.6;
      controls.update();
    };

    const renderScene = () => {
      const delta = clock.getDelta();
      const [targetX, targetY, targetZ] = targetRotationRef.current;

      group.rotation.x = THREE.MathUtils.damp(
        group.rotation.x,
        targetX,
        5,
        delta,
      );
      group.rotation.y = THREE.MathUtils.damp(
        group.rotation.y,
        targetY,
        5,
        delta,
      );
      group.rotation.z = THREE.MathUtils.damp(
        group.rotation.z,
        targetZ,
        5,
        delta,
      );

      controls.update();
      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(renderScene);
    };

    const handleResize = () => {
      updateCameraFraming();
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);
    updateCameraFraming();
    renderScene();

    sceneRef.current = {
      renderer,
      group,
      materials,
    };

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }

      resizeObserver.disconnect();
      controls.dispose();
      boxMesh.remove(edges);
      edgesGeometry.dispose();
      edgesMaterial.dispose();
      geometry.dispose();
      materials.forEach((material) => {
        if (material.map) {
          material.map.dispose();
          material.map = null;
        }
        material.dispose();
      });
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const resources = sceneRef.current;
    if (!resources) {
      return;
    }

    BOX_FACE_ORDER.forEach((faceKey) => {
      const face = faces[faceKey];
      if (!face) {
        return;
      }

      if (faceVersionsRef.current[faceKey] === face.version) {
        return;
      }

      faceVersionsRef.current[faceKey] = face.version;

      const materialIndex = BOX_FACE_CONFIG[faceKey].materialIndex;
      const material = resources.materials[materialIndex];
      if (!material) {
        return;
      }

      if (!face.dataUrl) {
        if (material.map) {
          material.map.dispose();
          material.map = null;
        }
        material.color.set("#e2e8f0");
        material.needsUpdate = true;
        return;
      }

      const loader = textureLoaderRef.current;
      const loadVersion = face.version;

      loader.load(
        face.dataUrl,
        (texture) => {
          if (faceVersionsRef.current[faceKey] !== loadVersion) {
            texture.dispose();
            return;
          }

          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(
            resources.renderer.capabilities.getMaxAnisotropy(),
            4,
          );
          texture.needsUpdate = true;

          if (material.map) {
            material.map.dispose();
          }

          material.map = texture;
          material.color.set("#ffffff");
          material.needsUpdate = true;
        },
        undefined,
        (error) => {
          console.error("Unable to load face texture", error);
        },
      );
    });
  }, [faces]);

  const readyFaceCount = useMemo(() => {
    return BOX_FACE_ORDER.reduce((count, key) => {
      return faces[key].dataUrl ? count + 1 : count;
    }, 0);
  }, [faces]);

  const previewPaused = canvasRotation % 360 !== 0;
  const hasTextures = readyFaceCount > 0;

  const status = useMemo(() => {
    if (previewPaused) {
      return { label: "Paused", className: "bg-amber-100 text-amber-700" };
    }

    if (hasTextures) {
      return { label: "Live", className: "bg-emerald-100 text-emerald-700" };
    }

    return { label: "Waiting", className: "bg-slate-200 text-slate-600" };
  }, [hasTextures, previewPaused]);

  const handleStepForward = useCallback(() => {
    setViewIndex((index) => (index + 1) % FACE_VIEW_SEQUENCE.length);
  }, []);

  const handleStepBackward = useCallback(() => {
    setViewIndex((index) =>
      (index - 1 + FACE_VIEW_SEQUENCE.length) % FACE_VIEW_SEQUENCE.length,
    );
  }, []);

  return (
    <aside className="flex h-full w-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">3D Preview</h2>
        <span
          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${status.className}`}
        >
          {status.label}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-3">
        <div className="relative flex min-h-[320px] flex-1 items-stretch justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <div ref={containerRef} className="h-full w-full" />
          {!hasTextures ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-slate-400">
              Add artwork on the template to see it wrapped on the box.
            </div>
          ) : null}
          {previewPaused ? (
            <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-lg bg-white/90 px-4 py-2 text-center text-xs font-medium text-amber-600 shadow">
              3D updates resume once the canvas rotation is reset to 0°.
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-between rounded-full bg-slate-100 px-2 py-1 text-sm text-slate-600">
          <button
            type="button"
            onClick={handleStepBackward}
            className="flex items-center gap-1 rounded-full px-3 py-1 font-medium text-slate-700 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70"
          >
            <span aria-hidden>←</span>
            Backward
          </button>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Viewing: {BOX_FACE_CONFIG[currentFace].label}
          </span>
          <button
            type="button"
            onClick={handleStepForward}
            className="flex items-center gap-1 rounded-full px-3 py-1 font-medium text-slate-700 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70"
          >
            Forward
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Artwork placed on the dieline is captured and applied as textures across
        the box surfaces. Use the arrows or drag the preview to inspect each
        face.
      </p>
    </aside>
  );
}
