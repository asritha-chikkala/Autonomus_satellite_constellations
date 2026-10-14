"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { resolvePlaceName } from "./AddTaskModal";

interface SatelliteData {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  altitude: number;
  latitude: number;
  longitude: number;
  battery: number;
  health: number;
  risk: number;
  status: string;
  active_links: number;
  is_faulty?: boolean;
  is_busy?: boolean;
  in_eclipse?: boolean;
  power_state?: string;
}

interface TaskData {
  id: string;
  name?: string;
  place_name?: string;
  target: { latitude: number; longitude: number; priority?: string; name?: string; place_name?: string };
  assigned_satellite?: string;
  start_position?: number[];
  phase: string;
  progress: number;
  mpc_trajectory?: number[][];
  isl_route?: string[];
}

interface EarthViewerProps {
  satellites: SatelliteData[];
  spaceStation?: any;
  tasks?: TaskData[];
  isAllocating?: boolean;
  activeLinks?: Array<{ source: string; target: string; distance_km: number; link_quality: number }>;
  eventLogs?: any[];
  selectedSatelliteId?: string;
  selectedTaskId?: string;
  onSelectSatellite?: (satId: string) => void;
  showTargetsAndPaths?: boolean;
  showHud?: boolean;
  enableZoom?: boolean;
  simTime?: number;
  simSpeed?: number;
}

export const DEFAULT_SATELLITES: SatelliteData[] = Array.from({ length: 20 }, (_, i) => {
  const satId = `SAT-${String(i + 1).padStart(2, "0")}`;
  const inc = [53.0, 64.0, 78.0, 97.5][i % 4];
  const raan = [0.0, 72.0, 144.0, 216.0, 288.0, 45.0, 117.0, 189.0, 261.0, 333.0,
                90.0, 162.0, 234.0, 306.0, 18.0, 135.0, 207.0, 279.0, 351.0, 63.0][i];
  const nu = [15.0, 87.0, 159.0, 231.0, 303.0, 30.0, 102.0, 174.0, 246.0, 318.0,
              45.0, 117.0, 189.0, 261.0, 333.0, 60.0, 132.0, 204.0, 276.0, 348.0][i];
  const alt = 540.0 + 5.0 * (i % 6);
  const r = (6378.137 + alt) / 1000.0;
  const incRad = (inc * Math.PI) / 180;
  const raanRad = (raan * Math.PI) / 180;
  const nuRad = (nu * Math.PI) / 180;

  const xOrb = r * Math.cos(nuRad);
  const yOrb = r * Math.sin(nuRad);
  const x = xOrb * Math.cos(raanRad) - yOrb * Math.cos(incRad) * Math.sin(raanRad);
  const y = yOrb * Math.sin(incRad);
  const z = -(xOrb * Math.sin(raanRad) + yOrb * Math.cos(incRad) * Math.cos(raanRad));

  return {
    id: satId,
    position: [x * 1000, -z * 1000, y * 1000],
    velocity: [0, 7.5, 0],
    altitude: alt,
    latitude: 16.5 + (i * 2),
    longitude: 80.6 + (i * 15),
    active_links: 2,
    battery: [87.5, 63.2, 92.0, 45.5, 78.0, 82.5, 69.0, 94.0, 88.0, 74.5,
              91.0, 84.0, 77.5, 89.0, 62.0, 95.0, 79.0, 85.0, 71.0, 90.5][i],
    health: 0.96,
    risk: 0.12,
    status: "NOMINAL",
    is_faulty: false,
    is_busy: false,
  };
});

export default function EarthViewer3D({
  satellites = [],
  spaceStation,
  tasks = [],
  isAllocating = false,
  activeLinks = [],
  eventLogs = [],
  selectedSatelliteId,
  selectedTaskId,
  onSelectSatellite,
  showTargetsAndPaths = true,
  showHud = true,
  enableZoom = true,
  simTime = 0,
  simSpeed = 1,
}: EarthViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const cloudsMeshRef = useRef<THREE.Mesh | null>(null);
  const moonMeshRef = useRef<THREE.Mesh | null>(null);

  const simTimeRef = useRef(simTime);
  const simSpeedRef = useRef(simSpeed);
  useEffect(() => {
    simTimeRef.current = simTime;
  }, [simTime]);
  useEffect(() => {
    simSpeedRef.current = simSpeed;
  }, [simSpeed]);

  const enableZoomRef = useRef(enableZoom);
  useEffect(() => {
    enableZoomRef.current = enableZoom;
  }, [enableZoom]);

  const satellitesRef = useRef(satellites);
  const tasksRef = useRef(tasks);
  const selectedSatIdRef = useRef(selectedSatelliteId);

  useEffect(() => {
    satellitesRef.current = satellites && satellites.length > 0 ? satellites : DEFAULT_SATELLITES;
  }, [satellites]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    selectedSatIdRef.current = selectedSatelliteId;
  }, [selectedSatelliteId]);

  const satMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const linkLinesRef = useRef<THREE.LineSegments | null>(null);
  const dashedLinksRef = useRef<THREE.Group | null>(null);
  const targetMarkersGroupRef = useRef<THREE.Group | null>(null);
  const taskPathsGroupRef = useRef<THREE.Group | null>(null);
  const orbitRingsGroupRef = useRef<THREE.Group | null>(null);
  const observationConeGroupRef = useRef<THREE.Group | null>(null);
  const dynamicSwathGroupRef = useRef<THREE.Group | null>(null);
  const dynamicIslGroupRef = useRef<THREE.Group | null>(null);
  const islPacketBeadRef = useRef<THREE.Mesh | null>(null);
  const issMeshRef = useRef<THREE.Group | null>(null);

  const [hoveredSat, setHoveredSat] = useState<SatelliteData | null>(null);
  const [cameraMode, setCameraMode] = useState<"FREE" | "CHASE" | "GROUND">("FREE");
  const cameraModeRef = useRef<"FREE" | "CHASE" | "GROUND">("FREE");
  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  const [targetInAperture, setTargetInAperture] = useState<boolean>(false);
  const targetInApertureRef = useRef<boolean>(false);

  const EARTH_RADIUS = 6.378; // 1 unit = 1000 km
  const SCALE = 1.0 / 1000.0;

  // Convert lat/long to 3D Cartesian coordinates on sphere
  const latLongToVector3 = (lat: number, lon: number, radius: number): THREE.Vector3 => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
  };

  // Helper to construct delicate, very light orbital lines (LEO Walker Delta constellation)
  const buildConstellationOrbitRings = (group: THREE.Group) => {
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    // Distinct orbit planes based on Walker Delta inclination & RAAN
    const orbitPlanes = [
      { inc: 53.0, raan: 0.0, r: EARTH_RADIUS + 0.540 },
      { inc: 53.0, raan: 72.0, r: EARTH_RADIUS + 0.545 },
      { inc: 53.0, raan: 144.0, r: EARTH_RADIUS + 0.540 },
      { inc: 53.0, raan: 216.0, r: EARTH_RADIUS + 0.545 },
      { inc: 53.0, raan: 288.0, r: EARTH_RADIUS + 0.540 },
      { inc: 64.0, raan: 45.0, r: EARTH_RADIUS + 0.550 },
      { inc: 64.0, raan: 117.0, r: EARTH_RADIUS + 0.555 },
      { inc: 64.0, raan: 189.0, r: EARTH_RADIUS + 0.550 },
      { inc: 64.0, raan: 261.0, r: EARTH_RADIUS + 0.555 },
      { inc: 64.0, raan: 333.0, r: EARTH_RADIUS + 0.550 },
      { inc: 78.0, raan: 90.0, r: EARTH_RADIUS + 0.550 },
      { inc: 78.0, raan: 162.0, r: EARTH_RADIUS + 0.555 },
      { inc: 78.0, raan: 234.0, r: EARTH_RADIUS + 0.550 },
      { inc: 78.0, raan: 306.0, r: EARTH_RADIUS + 0.555 },
      { inc: 97.5, raan: 18.0, r: EARTH_RADIUS + 0.560 }, // Sun-synchronous polar
      { inc: 97.5, raan: 135.0, r: EARTH_RADIUS + 0.560 },
      { inc: 97.5, raan: 279.0, r: EARTH_RADIUS + 0.560 },
    ];

    const orbitMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8, // Soft elegant cyan
      transparent: true,
      opacity: 0.16, // Very light line as requested
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    orbitPlanes.forEach((plane) => {
      const segments = 128;
      const pts: THREE.Vector3[] = [];
      const incRad = (plane.inc * Math.PI) / 180;
      const raanRad = (plane.raan * Math.PI) / 180;

      for (let i = 0; i <= segments; i++) {
        const u = (i / segments) * Math.PI * 2;
        const x_orb = plane.r * Math.cos(u);
        const y_orb = plane.r * Math.sin(u);
        const x = x_orb * Math.cos(raanRad) - y_orb * Math.cos(incRad) * Math.sin(raanRad);
        const z = -(x_orb * Math.sin(raanRad) + y_orb * Math.cos(incRad) * Math.cos(raanRad));
        const y = y_orb * Math.sin(incRad);
        pts.push(new THREE.Vector3(x, y, z));
      }

      const orbitGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
      group.add(orbitLine);
    });
  };

  // Helper to generate circular glowing cyan halo texture directly matching media_1791267381025.png
  const createHaloTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
      grad.addColorStop(0.0, "rgba(224, 242, 254, 1.0)");   // bright white-cyan core
      grad.addColorStop(0.25, "rgba(56, 189, 248, 0.95)");  // electric cyan
      grad.addColorStop(0.55, "rgba(2, 132, 199, 0.55)");   // aerospace sky blue
      grad.addColorStop(0.85, "rgba(14, 165, 233, 0.15)");  // soft fading halo rim
      grad.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");         // transparent outer edge
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(64, 64, 64, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  };

  // Shared halo texture reference for performance
  const haloTextureRef = useRef<THREE.CanvasTexture | null>(null);

  // Build 3D Satellite Model (Realistic Proportions & Aerospace Materials matching User Spec)
  const createSatelliteMesh = (sat: SatelliteData): THREE.Group => {
    const satGroup = new THREE.Group();

    if (!haloTextureRef.current) {
      haloTextureRef.current = createHaloTexture();
    }

    // 1. Active Optical Telemetry Beacon: Expanding translucent optical glow halo
    const haloMat = new THREE.SpriteMaterial({
      map: haloTextureRef.current,
      transparent: true,
      opacity: 0.90,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const haloSprite = new THREE.Sprite(haloMat);
    haloSprite.scale.set(0.40, 0.40, 1.0);
    haloSprite.name = "haloSprite";
    satGroup.add(haloSprite);

    // 2. Satellite Bus Body: Gold Multi-Layer Insulation (MLI) thermal foil (metalness: 0.9, roughness: 0.2)
    const bodyGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // Gold MLI foil
      metalness: 0.90,
      roughness: 0.20,
      emissive: 0x78350f,
      emissiveIntensity: 0.45,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.name = "satelliteBody";
    satGroup.add(bodyMesh);

    // 3. Dual Solar Wings: Thin rectangular panels with dark silicon blue solar cells (color: 0x132a75, emissive: 0x07153a)
    const panelGeo = new THREE.BoxGeometry(0.56, 0.012, 0.12);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x132a75, // Silicon blue solar cells
      metalness: 0.85,
      roughness: 0.25,
      emissive: 0x07153a,
      emissiveIntensity: 0.60,
    });
    const solarWing = new THREE.Mesh(panelGeo, panelMat);
    solarWing.name = "solarWing";
    satGroup.add(solarWing);

    // 4. High-Gain Communication Antenna: Parabolic metallic dish mounted on nadir deck
    const dishGeo = new THREE.CylinderGeometry(0.035, 0.012, 0.035, 16);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.90, roughness: 0.20 });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.set(0, 0, 0.07);
    satGroup.add(dish);

    // 5. Active Optical Telemetry Beacon (Solid core LED sphere)
    const beaconGeo = new THREE.SphereGeometry(0.028, 12, 12);
    const beaconColor = sat.is_faulty ? 0xff2a55 : (sat.is_busy ? 0x00ff88 : 0x00f2fe);
    const beaconMat = new THREE.MeshBasicMaterial({ color: beaconColor });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 0, 0.075);
    beacon.name = "beacon";
    satGroup.add(beacon);

    // 6. Highlight Selection Ring (Proportional to satellite size)
    const ringGeo = new THREE.RingGeometry(0.24, 0.32, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.name = "selectionRing";
    satGroup.add(ring);

    // 7. Ion Thruster Plasma Plume (Fires during active task maneuver)
    const plumeGeo = new THREE.ConeGeometry(0.05, 0.22, 12);
    const plumeMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.0,
    });
    const plume = new THREE.Mesh(plumeGeo, plumeMat);
    plume.position.set(0, -0.15, 0);
    plume.rotation.x = Math.PI;
    plume.name = "thrusterPlume";
    satGroup.add(plume);

    satGroup.userData = { satId: sat.id };
    return satGroup;
  };

  // Build 3D Space Station (ISS style)
  const createSpaceStationMesh = (): THREE.Group => {
    const iss = new THREE.Group();
    const modGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.7, 16);
    const modMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.85 });
    const module = new THREE.Mesh(modGeo, modMat);
    module.rotation.z = Math.PI / 2;
    iss.add(module);

    const trussGeo = new THREE.BoxGeometry(1.5, 0.03, 0.03);
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const truss = new THREE.Mesh(trussGeo, trussMat);
    iss.add(truss);

    const panelGeo = new THREE.BoxGeometry(0.35, 0.015, 0.25);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0xd49b28, metalness: 0.9, roughness: 0.2 });
    const p1 = new THREE.Mesh(panelGeo, panelMat); p1.position.set(-0.55, 0, 0.18); iss.add(p1);
    const p2 = new THREE.Mesh(panelGeo, panelMat); p2.position.set(-0.55, 0, -0.18); iss.add(p2);
    const p3 = new THREE.Mesh(panelGeo, panelMat); p3.position.set(0.55, 0, 0.18); iss.add(p3);
    const p4 = new THREE.Mesh(panelGeo, panelMat); p4.position.set(0.55, 0, -0.18); iss.add(p4);

    return iss;
  };

  // Initialize Three.js Photorealistic Scene
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020408);
    sceneRef.current = scene;
    satMeshesRef.current.clear();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(0, 10, 24);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const textureLoader = new THREE.TextureLoader();

    // 1. Deep Space Starfield with Milky Way background
    const starCount = 3500;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 250 + Math.random() * 400;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);

      const col = Math.random();
      if (col > 0.85) {
        starColors[i * 3] = 0.65; starColors[i * 3 + 1] = 0.85; starColors[i * 3 + 2] = 1.0;
      } else if (col > 0.65) {
        starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 0.82; starColors[i * 3 + 2] = 0.55;
      } else {
        starColors[i * 3] = 0.95; starColors[i * 3 + 1] = 0.95; starColors[i * 3 + 2] = 1.0;
      }
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({ size: 1.1, vertexColors: true, transparent: true, opacity: 0.85 });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 2. Photorealistic NASA Blue Marble Earth
    const earthDayMap = textureLoader.load("/textures/earth_day.jpg");
    const earthNormalMap = textureLoader.load("/textures/earth_normal.jpg");
    const earthSpecularMap = textureLoader.load("/textures/earth_specular.jpg");
    const earthCloudsMap = textureLoader.load("/textures/earth_clouds.png");
    const moonMap = textureLoader.load("/textures/moon.jpg");

    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 96, 96);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthDayMap,
      normalMap: earthNormalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: earthSpecularMap,
      roughness: 0.45,
      metalness: 0.1,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earthMesh);
    earthMeshRef.current = earthMesh;

    // 3. Rayleigh Atmospheric Glow (Inner Soft Scattering)
    const atmoGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.02, 64, 64);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x4fa3e3,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmoMesh);

    // 4. Outer Cyan Fresnel Atmospheric Rim
    const outerHaloGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.045, 64, 64);
    const outerHaloMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.10,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const outerHalo = new THREE.Mesh(outerHaloGeo, outerHaloMat);
    scene.add(outerHalo);

    // 5. Realistic Swirling Clouds Layer
    const cloudsGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.012, 64, 64);
    const cloudsMat = new THREE.MeshStandardMaterial({
      map: earthCloudsMap,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    });
    const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    scene.add(cloudsMesh);
    cloudsMeshRef.current = cloudsMesh;

    // 6. Realistic 3D Moon in Background (matching user reference image)
    const moonGeo = new THREE.SphereGeometry(0.85, 32, 32);
    const moonMat = new THREE.MeshStandardMaterial({
      map: moonMap,
      roughness: 0.9,
      metalness: 0.05,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(24, 18, -35); // Upper-right celestial position
    scene.add(moonMesh);
    moonMeshRef.current = moonMesh;

    // 7. Sunlight & Studio Lighting
    const ambientLight = new THREE.AmbientLight(0x1a2638, 1.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 3.2);
    sunLight.position.set(45, 25, 40);
    scene.add(sunLight);

    const moonRimLight = new THREE.DirectionalLight(0x8ab4f8, 0.4);
    moonRimLight.position.set(-30, -20, -30);
    scene.add(moonRimLight);

    // 8. Space Station (ISS) located in lower orbital layer
    const iss = createSpaceStationMesh();
    iss.position.set(0, -EARTH_RADIUS - 0.45, 2.5);
    scene.add(iss);
    issMeshRef.current = iss;

    // 9. Groups for Dynamic Multi-Task Beacons & Curved Trajectories
    const targetGroup = new THREE.Group();
    scene.add(targetGroup);
    targetMarkersGroupRef.current = targetGroup;

    const taskPathsGroup = new THREE.Group();
    scene.add(taskPathsGroup);
    taskPathsGroupRef.current = taskPathsGroup;

    const dashedLinksGroup = new THREE.Group();
    scene.add(dashedLinksGroup);
    dashedLinksRef.current = dashedLinksGroup;

    // 10. Groups for Satellite Orbital Rings & Camera Nadir Observation Cone
    const orbitRingsGroup = new THREE.Group();
    buildConstellationOrbitRings(orbitRingsGroup);
    scene.add(orbitRingsGroup);
    orbitRingsGroupRef.current = orbitRingsGroup;

    const observationConeGroup = new THREE.Group();
    scene.add(observationConeGroup);
    observationConeGroupRef.current = observationConeGroup;

    // Groups for Dynamic Sensor Swath Cone, Ground Footprint Ring & Multi-Hop ISL Mesh Routing
    const dynamicSwathGroup = new THREE.Group();
    scene.add(dynamicSwathGroup);
    dynamicSwathGroupRef.current = dynamicSwathGroup;

    const dynamicIslGroup = new THREE.Group();
    scene.add(dynamicIslGroup);
    dynamicIslGroupRef.current = dynamicIslGroup;

    const packetGeo = new THREE.SphereGeometry(0.09, 16, 16);
    const packetMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const packetBead = new THREE.Mesh(packetGeo, packetMat);
    packetBead.visible = false;
    dynamicIslGroup.add(packetBead);
    islPacketBeadRef.current = packetBead;

    // Orbit Camera Controls
    let isDragging = false;
    let clickStartX = 0;
    let clickStartY = 0;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let cameraDistance = 24;
    let rotX = 0.35;
    let rotY = 0.6;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      clickStartX = e.clientX;
      clickStartY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      rotY += deltaX * 0.005;
      rotX = Math.max(-Math.PI / 2.15, Math.min(Math.PI / 2.15, rotX + deltaY * 0.005));
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseUp = () => { isDragging = false; };
    const onWheel = (e: WheelEvent) => {
      if (!enableZoomRef.current) return; // Allow natural page scroll without zoom lock
      cameraDistance = Math.max(9, Math.min(50, cameraDistance + e.deltaY * 0.02));
      e.preventDefault();
    };

    // Raycaster for clicking satellites directly in 3D
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (e: MouseEvent) => {
      const movedDist = Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY);
      if (movedDist > 6) return;
      if (!containerRef.current || !cameraRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, cameraRef.current);

      const candidates: THREE.Object3D[] = [];
      satMeshesRef.current.forEach((mesh) => candidates.push(mesh));
      const intersects = raycaster.intersectObjects(candidates, true);
      if (intersects.length > 0) {
        let cur: THREE.Object3D | null = intersects[0].object;
        while (cur && !cur.userData?.satId) {
          cur = cur.parent;
        }
        if (cur && cur.userData?.satId && onSelectSatellite) {
          onSelectSatellite(cur.userData.satId);
        }
      }
    };

    const domEl = renderer.domElement;
    domEl.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    domEl.addEventListener("wheel", onWheel, { passive: false });
    domEl.addEventListener("click", onClick);

    // Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      if (!isDragging) {
        rotY += 0.000075 * (simSpeedRef.current || 1.0);
      }
      const earthRot = elapsedTime * 0.0003125 * (simSpeedRef.current || 1.0);

      if (earthMeshRef.current) earthMeshRef.current.rotation.y = earthRot;
      if (targetMarkersGroupRef.current) targetMarkersGroupRef.current.rotation.y = earthRot;
      if (taskPathsGroupRef.current) taskPathsGroupRef.current.rotation.y = earthRot;
      if (cloudsMeshRef.current) cloudsMeshRef.current.rotation.y = earthRot + (elapsedTime * 0.0000625);
      if (moonMeshRef.current) moonMeshRef.current.rotation.y = (elapsedTime * 0.000025) % (Math.PI * 2);
      if (issMeshRef.current) issMeshRef.current.rotation.y = earthRot;

      // Update camera position
      camera.position.x = cameraDistance * Math.cos(rotX) * Math.sin(rotY);
      camera.position.y = cameraDistance * Math.sin(rotX);
      camera.position.z = cameraDistance * Math.cos(rotX) * Math.cos(rotY);
      camera.lookAt(0, 0, 0);

      // Animate target markers (radar pulse expansion)
      if (targetMarkersGroupRef.current) {
        targetMarkersGroupRef.current.children.forEach((tgtGroup) => {
          const pRing = tgtGroup.getObjectByName("pulseRing");
          if (pRing) {
            const s = 1.0 + 0.45 * Math.sin(elapsedTime * 6);
            pRing.scale.set(s, s, s);
          }
        });
      }

      // Active satellite fleet: guarantee all 20 satellites are present and moving
      const effectiveSatellites = (satellitesRef.current && satellitesRef.current.length > 0)
        ? satellitesRef.current
        : DEFAULT_SATELLITES;
      const effectiveTasks = tasksRef.current || [];
      const focusedSatId = selectedSatIdRef.current;
      const activeTask = effectiveTasks.find((t: any) => t.phase !== "COMPLETED");

      // Astrodynamics Sun Direction Vector for Solar Occultation / Eclipse Test
      const sunDir = new THREE.Vector3(45, 25, 40).normalize();

      effectiveSatellites.forEach((sat, i) => {
        let satGroup = satMeshesRef.current.get(sat.id);
        if (!satGroup) {
          satGroup = createSatelliteMesh(sat);
          satMeshesRef.current.set(sat.id, satGroup);
        }
        if (sceneRef.current && satGroup.parent !== sceneRef.current) {
          sceneRef.current.add(satGroup);
        }
        if (!satGroup) return;

        // Check if this satellite is assigned to an active mission
        const isTaskSat = !!activeTask && activeTask.assigned_satellite === sat.id;
        const isSelected = sat.id === focusedSatId;

        const ring = satGroup.getObjectByName("selectionRing") as THREE.Mesh;
        const plume = satGroup.getObjectByName("thrusterPlume") as THREE.Mesh;
        const beacon = satGroup.getObjectByName("beacon") as THREE.Mesh;
        const haloSprite = satGroup.getObjectByName("haloSprite") as THREE.Sprite;
        const bodyMesh = satGroup.getObjectByName("satelliteBody") as THREE.Mesh;
        const solarWing = satGroup.getObjectByName("solarWing") as THREE.Mesh;

        const inc = [53.0, 64.0, 78.0, 97.5][i % 4];
        const raan = [0.0, 72.0, 144.0, 216.0, 288.0, 45.0, 117.0, 189.0, 261.0, 333.0,
                      90.0, 162.0, 234.0, 306.0, 18.0, 135.0, 207.0, 279.0, 351.0, 63.0][i % 20];
        const baseNu = [15.0, 87.0, 159.0, 231.0, 303.0, 30.0, 102.0, 174.0, 246.0, 318.0,
                        45.0, 117.0, 189.0, 261.0, 333.0, 60.0, 132.0, 204.0, 276.0, 348.0][i % 20];
        const alt = 540.0 + 5.0 * (i % 6);
        const r = (6378.137 + alt) / 1000.0;

        // PHYSICAL KEPLERIAN PROPAGATION & ECI MAPPING (REAL-TIME ORBITAL SPEED):
        if (sat.position && sat.position.length === 3 && (sat.position[0] !== 0 || sat.position[1] !== 0)) {
          // Backend position is [X, Y, Z] in km. Three.js coordinates: 1 unit = 1000 km.
          // ECI X -> X, ECI Z -> Y (North), ECI Y -> -Z
          satGroup.position.set(
            sat.position[0] / 1000.0,
            sat.position[2] / 1000.0,
            -sat.position[1] / 1000.0
          );
        } else {
          const currentNu = (baseNu * Math.PI / 180) + elapsedTime * 0.00625 * (simSpeedRef.current || 1.0);
          const incRad = (inc * Math.PI) / 180;
          const raanRad = (raan * Math.PI) / 180;

          const xOrb = r * Math.cos(currentNu);
          const yOrb = r * Math.sin(currentNu);
          const orbPos = new THREE.Vector3(
            xOrb * Math.cos(raanRad) - yOrb * Math.cos(incRad) * Math.sin(raanRad),
            yOrb * Math.sin(incRad),
            -(xOrb * Math.sin(raanRad) + yOrb * Math.cos(incRad) * Math.cos(raanRad))
          );
          satGroup.position.copy(orbPos);
        }

        if (isTaskSat && activeTask) {
          // =========================================================================
          // ALLOCATED SATELLITE: ORIENTS GIMBAL AND PAYLOAD TOWARD GROUND TARGET
          // =========================================================================
          const tgtLat = activeTask.target?.latitude ?? 16.5;
          const tgtLon = activeTask.target?.longitude ?? 80.6;
          const tgtPos = latLongToVector3(tgtLat, tgtLon, EARTH_RADIUS + 0.06);

          satGroup.lookAt(tgtPos); // Point optical sensor payload toward target!

          if (plume) {
            plume.visible = true;
            plume.scale.set(1.0, 1.2 + 0.3 * Math.sin(elapsedTime * 30), 1.0);
            (plume.material as THREE.MeshBasicMaterial).opacity = 0.95;
          }
          if (beacon) {
            (beacon.material as THREE.MeshBasicMaterial).color.set(0x00ff88);
          }
        } else {
          satGroup.lookAt(0, 0, 0); // Nadir pointing to Earth center
          if (plume) plume.visible = false;
        }

        // Feature 3: Solar Eclipse Occultation Check & Visual Dimming
        const sPos = satGroup.position;
        const dotSun = sPos.dot(sunDir);
        let inEclipse = !!sat.in_eclipse;
        if (dotSun < 0) {
          const proj = sunDir.clone().multiplyScalar(dotSun);
          const perpDist = sPos.clone().sub(proj).length();
          if (perpDist < EARTH_RADIUS) {
            inEclipse = true;
          }
        }

        if (solarWing && solarWing.material) {
          const mat = solarWing.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = inEclipse ? 0.05 : 0.60;
          mat.color.set(inEclipse ? 0x091438 : 0x132a75);
        }
        if (bodyMesh && bodyMesh.material) {
          const mat = bodyMesh.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = inEclipse ? 0.08 : 0.45;
        }

        // Subtle optical breathing for beacon
        const satOffset = i * 0.65;
        const pulse = 0.5 + 0.5 * Math.sin(elapsedTime * 3.8 + satOffset);
        if (haloSprite) {
          const baseScale = isTaskSat ? 0.48 : isSelected ? 0.44 : 0.36;
          const s = baseScale + 0.02 * pulse;
          haloSprite.scale.set(s, s, 1.0);
          (haloSprite.material as THREE.SpriteMaterial).opacity = inEclipse
            ? 0.22
            : (isTaskSat ? 0.95 : 0.80 + 0.10 * pulse);
        }

        if (beacon) {
          (beacon.material as THREE.MeshBasicMaterial).color.set(
            sat.is_faulty ? 0xff2a55 : isTaskSat ? 0x00ff88 : isSelected ? 0x00f2fe : 0x00f2fe
          );
        }

        if (ring) {
          ring.visible = false;
        }
      });

      // =========================================================================
      // FEATURE 1: SENSOR GROUND SWATH & FOV CONE + APERTURE DETECTION
      // =========================================================================
      const focalSatId = (activeTask && activeTask.assigned_satellite)
        ? activeTask.assigned_satellite
        : (focusedSatId || (satellites.length > 0 ? satellites[0].id : "SAT-01"));
      const focalSatGroup = satMeshesRef.current.get(focalSatId);

      if (focalSatGroup && showTargetsAndPaths && dynamicSwathGroupRef.current) {
        const swGroup = dynamicSwathGroupRef.current;
        while (swGroup.children.length > 0) {
          swGroup.remove(swGroup.children[0]);
        }

        const satPos = focalSatGroup.position;
        const nadirPos = satPos.clone().normalize().multiplyScalar(EARTH_RADIUS + 0.02);
        const altitude = satPos.distanceTo(nadirPos);
        const fovHalfAngle = 25 * (Math.PI / 180);
        const footprintRadius = altitude * Math.tan(fovHalfAngle);

        // Check if ground target is inside the 25-degree aperture cone
        let insideAperture = false;
        if (activeTask && activeTask.target) {
          const tgtPos = latLongToVector3(activeTask.target.latitude, activeTask.target.longitude, EARTH_RADIUS);
          const nadirNorm = nadirPos.clone().normalize();
          const tgtNorm = tgtPos.clone().normalize();
          const cosAngle = nadirNorm.dot(tgtNorm);
          if (cosAngle >= Math.cos(fovHalfAngle)) { // cos(25 deg) ~ 0.9063
            insideAperture = true;
          }
        }

        if (insideAperture !== targetInApertureRef.current) {
          targetInApertureRef.current = insideAperture;
          setTargetInAperture(insideAperture);
        }

        const swathColor = insideAperture ? 0x00ff88 : 0x00f2fe;

        // Inverted Sensor FOV Cone (Tip at satellite, base touching Earth surface)
        const coneGeo = new THREE.ConeGeometry(footprintRadius, altitude, 32, 1, true);
        const coneMat = new THREE.MeshBasicMaterial({
          color: swathColor,
          transparent: true,
          opacity: insideAperture ? 0.22 : 0.12,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const coneMesh = new THREE.Mesh(coneGeo, coneMat);
        const midPoint = new THREE.Vector3().addVectors(satPos, nadirPos).multiplyScalar(0.5);
        coneMesh.position.copy(midPoint);
        coneMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), nadirPos.clone().sub(satPos).normalize());
        swGroup.add(coneMesh);

        // Circular Ground Intersection Footprint Ring on Earth's surface
        const ringGeo = new THREE.RingGeometry(footprintRadius * 0.88, footprintRadius, 36);
        const ringMat = new THREE.MeshBasicMaterial({
          color: swathColor,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: insideAperture ? 0.95 : 0.65,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.copy(nadirPos);
        ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nadirPos.clone().normalize());
        swGroup.add(ringMesh);

        // Nadir Central Targeting Laser
        const lineGeo = new THREE.BufferGeometry().setFromPoints([satPos, nadirPos]);
        const lineMat = new THREE.LineBasicMaterial({
          color: swathColor,
          transparent: true,
          opacity: insideAperture ? 0.95 : 0.55,
        });
        const nadirLine = new THREE.Line(lineGeo, lineMat);
        swGroup.add(nadirLine);
      } else if (dynamicSwathGroupRef.current) {
        while (dynamicSwathGroupRef.current.children.length > 0) {
          dynamicSwathGroupRef.current.remove(dynamicSwathGroupRef.current.children[0]);
        }
      }

      // =========================================================================
      // FEATURE 2: MULTI-HOP ISL MESH ROUTING PACKET BEAD ANIMATION
      // =========================================================================
      if (dynamicIslGroupRef.current && showTargetsAndPaths) {
        const islGroup = dynamicIslGroupRef.current;
        for (let k = islGroup.children.length - 1; k >= 0; k--) {
          if (islGroup.children[k] !== islPacketBeadRef.current) {
            islGroup.remove(islGroup.children[k]);
          }
        }

        const routeSatIds = (activeTask && activeTask.isl_route && activeTask.isl_route.length >= 2)
          ? activeTask.isl_route
          : ["SAT-01", "SAT-06", "SAT-11", "SAT-16"];

        const routePoints: THREE.Vector3[] = [];
        routeSatIds.forEach((id) => {
          const m = satMeshesRef.current.get(id);
          if (m) routePoints.push(m.position.clone());
        });

        if (routePoints.length >= 2) {
          const islLineGeo = new THREE.BufferGeometry().setFromPoints(routePoints);
          const islLineMat = new THREE.LineBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.70,
            blending: THREE.AdditiveBlending,
          });
          const islLine = new THREE.Line(islLineGeo, islLineMat);
          islGroup.add(islLine);

          if (islPacketBeadRef.current) {
            const numSegs = routePoints.length - 1;
            const travel = (elapsedTime * 1.8) % numSegs;
            const segIndex = Math.floor(travel);
            const alpha = travel - segIndex;
            islPacketBeadRef.current.position.lerpVectors(routePoints[segIndex], routePoints[segIndex + 1], alpha);
            islPacketBeadRef.current.visible = true;
          }
        } else if (islPacketBeadRef.current) {
          islPacketBeadRef.current.visible = false;
        }
      }

      // =========================================================================
      // FEATURE 5: CINEMATIC CAMERA MODES (FREE | CHASE | GROUND)
      // =========================================================================
      const currentCamMode = cameraModeRef.current;
      if (currentCamMode === "CHASE" && focalSatGroup) {
        // Chase Camera: Positioned behind & slightly above the satellite in its orbit
        const satPos = focalSatGroup.position.clone();
        const satNorm = satPos.clone().normalize();
        const chasePos = satPos.clone().add(satNorm.clone().multiplyScalar(0.70)).add(new THREE.Vector3(0.3, 0.25, 0.3));
        camera.position.lerp(chasePos, 0.08);
        camera.lookAt(satPos);
      } else if (currentCamMode === "GROUND" && activeTask?.target) {
        // Ground Station Camera: View from Earth target looking straight up at satellite passing overhead
        const tgtPos = latLongToVector3(activeTask.target.latitude, activeTask.target.longitude, EARTH_RADIUS + 0.12);
        camera.position.lerp(tgtPos, 0.08);
        if (focalSatGroup) {
          camera.lookAt(focalSatGroup.position);
        } else {
          camera.lookAt(0, 0, 0);
        }
      } else {
        // Free Orbit Camera
        camera.position.x = cameraDistance * Math.cos(rotX) * Math.sin(rotY);
        camera.position.y = cameraDistance * Math.sin(rotX);
        camera.position.z = cameraDistance * Math.cos(rotX) * Math.cos(rotY);
        camera.lookAt(0, 0, 0);
      }

      // Clear any temporary glowing link lines around satellites
      if (dashedLinksRef.current && dashedLinksRef.current.children.length > 0) {
        while (dashedLinksRef.current.children.length > 0) {
          dashedLinksRef.current.remove(dashedLinksRef.current.children[0]);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      domEl.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      domEl.removeEventListener("wheel", onWheel);
      domEl.removeEventListener("click", onClick);
      satMeshesRef.current.clear();
      if (renderer.domElement && renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update Satellites (20 Satellites)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const fleet = (satellites && satellites.length > 0) ? satellites : DEFAULT_SATELLITES;

    fleet.forEach((sat) => {
      let satGroup = satMeshesRef.current.get(sat.id);
      if (!satGroup) {
        satGroup = createSatelliteMesh(sat);
        satMeshesRef.current.set(sat.id, satGroup);
      }
      if (sceneRef.current && satGroup.parent !== sceneRef.current) {
        sceneRef.current.add(satGroup);
      }

      // Check if satellite has an active task or is currently selected
      const isTaskSat = tasks.some((t) => t.assigned_satellite === sat.id && t.phase !== "COMPLETED");
      const isSelected = sat.id === selectedSatelliteId;

      const ring = satGroup.getObjectByName("selectionRing") as THREE.Mesh;
      const plume = satGroup.getObjectByName("thrusterPlume") as THREE.Mesh;
      const beacon = satGroup.getObjectByName("beacon") as THREE.Mesh;
      const haloSprite = satGroup.getObjectByName("haloSprite") as THREE.Sprite;

      if (ring) {
        ring.visible = isTaskSat || isSelected;
        if (ring.material) {
          (ring.material as THREE.MeshBasicMaterial).color.set(
            isSelected ? 0x00f2fe : (isTaskSat ? 0x00ff88 : 0x00f2fe)
          );
          ring.scale.set(isSelected ? 1.4 : 1.0, isSelected ? 1.4 : 1.0, isSelected ? 1.4 : 1.0);
        }
      }

      if (plume) plume.visible = isTaskSat && sat.status === "MANEUVERING";
      if (beacon) {
        (beacon.material as THREE.MeshBasicMaterial).color.set(
          sat.is_faulty ? 0xff2a55 : isSelected ? 0x00f2fe : (isTaskSat ? 0x00ff88 : 0x00f2fe)
        );
      }
    });

    // Space station position
    if (spaceStation && issMeshRef.current) {
      const issPos = new THREE.Vector3(
        spaceStation.position[0] * SCALE,
        spaceStation.position[2] * SCALE,
        -spaceStation.position[1] * SCALE
      );
      issMeshRef.current.position.copy(issPos);
    }
  }, [satellites, spaceStation, tasks, selectedSatelliteId]);

  // Update Orbital Paths (Very Light Delicate LEO Orbit Rings for the Constellation)
  useEffect(() => {
    const group = orbitRingsGroupRef.current;
    if (!group) return;
    buildConstellationOrbitRings(group);
  }, []);


  // Update Dynamic Multi-Task Target Markers (Concentric Pulse Rings + Target Pins + 3D Place Name Badges)
  useEffect(() => {
    const group = targetMarkersGroupRef.current;
    if (!group) return;

    // Clear previous target markers
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    // Helper to generate 3D billboard text sprite
    const createTargetBadge = (title: string, sub: string, phase?: string): THREE.Sprite => {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 140;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const isFailed = phase === "FAILED";
        const isCompleted = phase === "COMPLETED";

        // High-contrast glowing dark panel
        ctx.fillStyle = "rgba(3, 7, 18, 0.92)";
        ctx.strokeStyle = isFailed ? "#ff2a55" : isCompleted ? "#00ff88" : "#00f2fe";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(8, 8, 496, 124, 16);
        ctx.fill();
        ctx.stroke();

        // Top title: Task Name & Place Name
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 26px monospace";
        ctx.textAlign = "center";
        ctx.fillText(title, 256, 52);

        // Bottom info: Coords & Assigned Satellite & Status
        ctx.fillStyle = isFailed ? "#ff6b81" : isCompleted ? "#00ff88" : "#38bdf8";
        ctx.font = "bold 20px monospace";
        ctx.fillText(sub, 256, 100);
      }
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(1.6, 0.44, 1);
      return sprite;
    };

    // When no tasks are initialized or in clean mode, do not show any target markers on the globe
    if (!showTargetsAndPaths || tasks.length === 0) return;

    const displayTargets = tasks.map(t => ({
      id: t.id,
      name: t.name || t.id,
      place_name: t.place_name || t.target?.place_name,
      lat: t.target.latitude,
      lon: t.target.longitude,
      assigned_satellite: t.assigned_satellite,
      phase: t.phase
    }));

    displayTargets.forEach((tgt) => {
      const tgtGroup = new THREE.Group();
      tgtGroup.name = `task_target_${tgt.id}`;

      const tgtPos = latLongToVector3(tgt.lat, tgt.lon, EARTH_RADIUS + 0.06);
      tgtGroup.position.copy(tgtPos);
      tgtGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tgtPos.clone().normalize());

      // Target concentric rings
      const ringGeo = new THREE.RingGeometry(0.18, 0.32, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xff2a55, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
      const pulseRing = new THREE.Mesh(ringGeo, ringMat);
      pulseRing.name = "pulseRing";
      tgtGroup.add(pulseRing);

      // Inner white bullseye
      const innerRingGeo = new THREE.RingGeometry(0.04, 0.09, 24);
      const innerRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
      tgtGroup.add(innerRing);

      // Vertical holographic targeting laser beacon
      const beamGeo = new THREE.CylinderGeometry(0.025, 0.07, 2.2, 16);
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xff2a55, transparent: true, opacity: 0.85 });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = 1.1;
      tgtGroup.add(beam);

      // 3D Billboard Place Name Badge floating above beacon!
      const place = tgt.place_name || resolvePlaceName(tgt.lat, tgt.lon);
      const satText = tgt.assigned_satellite ? `[SAT: ${tgt.assigned_satellite}]` : "[MAS ALLOCATING]";
      const statusText = tgt.phase ? `[${tgt.phase}]` : "";
      const line1 = `📍 ${tgt.id}: ${place}`;
      const line2 = `${tgt.lat.toFixed(2)}° N, ${tgt.lon.toFixed(2)}° E • ${satText} ${statusText}`;
      const badge = createTargetBadge(line1, line2, tgt.phase);
      badge.position.y = 2.4;
      tgtGroup.add(badge);

      group.add(tgtGroup);
    });
  }, [tasks, showTargetsAndPaths]);

  // Update Curved Trajectory Paths connecting Each Satellite to Its Target (Thick 3D Tubes reaching Earth with 0 gap)
  useEffect(() => {
    const group = taskPathsGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    // When no tasks are initialized, clean mode active, or no satellites exist, do not show trajectory paths
    if (!showTargetsAndPaths || tasks.length === 0 || satellites.length === 0) return;

    tasks.forEach((task) => {
      // Find assigned satellite or closest candidate
      let sat = satellites.find((s) => s.id === task.assigned_satellite);
      if (!sat && satellites.length > 0) {
        sat = satellites[0];
      }
      if (!sat) return;

      // Only show trajectory once satellite is assigned and planning/execution has started
      if (!task.assigned_satellite && task.phase !== "COMPLETED") return;

      // Exact ground target position on Earth surface (at base of beacon pin)
      const targetPos = latLongToVector3(task.target.latitude, task.target.longitude, EARTH_RADIUS + 0.06);

      // Overflight point directly above the target at satellite orbital altitude
      const overflightPos = targetPos.clone().normalize().multiplyScalar(EARTH_RADIUS + 0.70);

      // Starting orbital point (use frozen start_position if completed or executing, or current sat position)
      const startPos = (task.start_position)
        ? new THREE.Vector3(task.start_position[0] * SCALE, task.start_position[2] * SCALE, -task.start_position[1] * SCALE)
        : new THREE.Vector3(sat.position[0] * SCALE, sat.position[2] * SCALE, -sat.position[1] * SCALE);

      // Build full path points array
      const fullPathPoints: THREE.Vector3[] = [];

      if (task.mpc_trajectory && task.mpc_trajectory.length > 0) {
        // Full 6-DOF MPC Trajectory points from backend
        task.mpc_trajectory.forEach((pt: number[]) => {
          fullPathPoints.push(new THREE.Vector3(pt[0] * SCALE, pt[2] * SCALE, -pt[1] * SCALE));
        });
        // Connect smoothly from the MPC orbital overflight point down directly to the target on Earth with 0 gap!
        const lastMpc = fullPathPoints[fullPathPoints.length - 1];
        for (let k = 1; k <= 8; k++) {
          const alpha = k / 8.0;
          fullPathPoints.push(new THREE.Vector3().lerpVectors(lastMpc, targetPos, alpha));
        }
      } else {
        // Geodesic orbital arc from satellite entry point to overflight nadir point
        const numArc = 16;
        for (let i = 0; i <= numArc; i++) {
          const alpha = i / numArc;
          const p = new THREE.Vector3().lerpVectors(startPos, overflightPos, alpha);
          p.normalize().multiplyScalar(EARTH_RADIUS + 0.70);
          fullPathPoints.push(p);
        }
        // Descent / targeting corridor from orbital overflight directly down to target pin on Earth
        const numDescent = 10;
        for (let i = 1; i <= numDescent; i++) {
          const alpha = i / numDescent;
          fullPathPoints.push(new THREE.Vector3().lerpVectors(overflightPos, targetPos, alpha));
        }
      }

      // Ensure last point is strictly targetPos (zero gap to target marker)
      fullPathPoints[fullPathPoints.length - 1] = targetPos.clone();

      if (fullPathPoints.length < 2) return;

      const fullCurve = new THREE.CatmullRomCurve3(fullPathPoints);

      // Compute progress fraction:
      // Path grows smoothly as task progresses, and once done (COMPLETED), full path is displayed!
      const isCompleted = task.phase === "COMPLETED";
      let progressFrac = 1.0;
      if (!isCompleted) {
        const rawProg = task.progress || 0;
        if (rawProg <= 45) {
          progressFrac = 0.10;
        } else {
          // Smoothly scale from 0.10 to 0.96 as progress goes from 45% to 96%
          progressFrac = Math.min(0.96, 0.10 + ((rawProg - 45) / 55.0) * 0.86);
        }
      }

      // Sample curve points up to progressFrac
      const numDivisions = Math.max(8, Math.floor(72 * progressFrac));
      const progressivePoints: THREE.Vector3[] = [];
      for (let i = 0; i <= numDivisions; i++) {
        const u = (i / numDivisions) * progressFrac;
        progressivePoints.push(fullCurve.getPoint(u));
      }

      // When task is completed, ensure the final point is strictly targetPos on Earth (zero gap!)
      if (isCompleted) {
        progressivePoints[progressivePoints.length - 1] = targetPos.clone();
      }

      if (progressivePoints.length < 2) return;

      const progressiveCurve = new THREE.CatmullRomCurve3(progressivePoints);

      // 1. THICK 3D TUBE (Self-illuminated MeshBasicMaterial)
      const tubeColor = isCompleted ? 0x00f2fe : 0x00ff88; // Cyan if completed, Neon green if active!
      const tubeGeo = new THREE.TubeGeometry(progressiveCurve, numDivisions, 0.075, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: tubeColor,
        transparent: true,
        opacity: isCompleted ? 0.85 : 0.95,
      });
      const pathTube = new THREE.Mesh(tubeGeo, tubeMat);
      pathTube.name = `trajectory_${task.id}`;
      group.add(pathTube);

      // 2. High-contrast luminous core centerline for maximum visibility
      const curvePoints = progressiveCurve.getPoints(numDivisions);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 });
      const lineMesh = new THREE.Line(lineGeo, lineMat);
      group.add(lineMesh);

      // 3. Leading Thruster Head Pulse Bead (advancing forward along the path as task progresses)
      if (!isCompleted) {
        const headPos = progressivePoints[progressivePoints.length - 1];
        const headGeo = new THREE.SphereGeometry(0.12, 12, 12);
        const headMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
        const headMesh = new THREE.Mesh(headGeo, headMat);
        headMesh.position.copy(headPos);
        group.add(headMesh);
      }

      // 4. Glowing Touchdown Ring & Bead at Earth target contact point (illuminates when completed or arrived at target)
      if (isCompleted || progressFrac >= 0.95) {
        const ringGeo = new THREE.RingGeometry(0.12, 0.26, 24);
        const ringMat = new THREE.MeshBasicMaterial({
          color: tubeColor,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.copy(targetPos);
        ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), targetPos.clone().normalize());
        group.add(ringMesh);

        const beadGeo = new THREE.SphereGeometry(0.08, 12, 12);
        const beadMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const beadMesh = new THREE.Mesh(beadGeo, beadMat);
        beadMesh.position.copy(targetPos);
        group.add(beadMesh);
      }
    });
  }, [tasks, satellites, showTargetsAndPaths]);

  // Ensure inter-satellite lines around satellites are removed
  useEffect(() => {
    const dashedGroup = dashedLinksRef.current;
    if (!dashedGroup) return;
    while (dashedGroup.children.length > 0) {
      dashedGroup.remove(dashedGroup.children[0]);
    }
  }, [activeLinks, showTargetsAndPaths]);

  const [showEventLog, setShowEventLog] = useState<boolean>(false);
  const [sideLogTask, setSideLogTask] = useState<string>("ALL");

  const uniqueTasks = Array.from(new Set(tasks.map(t => t.id))).sort();

  const filteredSideLogs = (eventLogs || []).filter(log => {
    return sideLogTask === "ALL" || log.task_id === sideLogTask;
  });

  return (
    <div className={`relative w-full h-full min-h-[640px] overflow-hidden ${
      showHud ? "rounded-2xl hud-panel border border-cyan-500/30 shadow-2xl bg-space-950" : "bg-transparent"
    }`}>
      {/* 3D Canvas */}
      <div ref={containerRef} className="w-full h-full min-h-[640px] cursor-grab active:cursor-grabbing" />

      {/* Internal Overlays & Satellite Bar - Only Render When showHud is true */}
      {showHud && (
        <>


      {/* Top Left: Cinematic Camera Modes Selector Pill (FREE | CHASE | GROUND) */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 pointer-events-auto">
        <div className="flex items-center gap-1 bg-space-950/85 backdrop-blur-xl border border-slate-700/80 p-1 rounded-xl text-xs font-mono shadow-2xl">
          <span className="text-[10px] text-slate-400 font-bold px-2 uppercase tracking-wider hidden sm:inline">
            CAMERA:
          </span>
          <button
            onClick={() => setCameraMode("FREE")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              cameraMode === "FREE"
                ? "bg-cyan-500/25 border border-cyan-400 text-cyan-200 shadow-md shadow-cyan-950/50"
                : "text-slate-400 hover:text-white"
            }`}
          >
            🌐 FREE
          </button>
          <button
            onClick={() => setCameraMode("CHASE")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              cameraMode === "CHASE"
                ? "bg-cyan-500/25 border border-cyan-400 text-cyan-200 shadow-md shadow-cyan-950/50"
                : "text-slate-400 hover:text-white"
            }`}
          >
            🛰️ CHASE
          </button>
          <button
            onClick={() => setCameraMode("GROUND")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              cameraMode === "GROUND"
                ? "bg-cyan-500/25 border border-cyan-400 text-cyan-200 shadow-md shadow-cyan-950/50"
                : "text-slate-400 hover:text-white"
            }`}
          >
            📍 GROUND
          </button>
        </div>
      </div>

      {/* Top Center: Feature 1 Target In-Swath Aperture Banner */}
      {targetInAperture && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-emerald-950/90 border border-emerald-400/80 text-emerald-300 px-4 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-2 shadow-2xl shadow-emerald-500/40 animate-pulse pointer-events-none backdrop-blur-xl">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>🎯 TARGET IN SENSOR APERTURE • 25° FOV SWATH LOCKED</span>
        </div>
      )}

      {/* Top Right Buttons: EVENT LOG & Camera Reset */}
      <div className="absolute top-4 right-4 flex items-center gap-2 pointer-events-auto">
        {/* User-requested Event Log button right on the side of the globe */}
        <button
          onClick={() => setShowEventLog(!showEventLog)}
          className="bg-space-900/90 hover:bg-space-800 border border-cyan-400/60 hover:border-cyan-300 text-xs px-3.5 py-1.5 rounded-xl font-mono text-cyan-300 flex items-center gap-2 transition-all shadow-lg shadow-cyan-950/50 cursor-pointer"
        >
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-bold">EVENT LOG</span>
          {eventLogs && eventLogs.length > 0 && (
            <span className="bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 px-1.5 py-0.2 rounded-full text-[10px]">
              {eventLogs.length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setCameraMode("FREE");
            if (cameraRef.current) cameraRef.current.position.set(0, 10, 24);
          }}
          className="bg-space-900/85 hover:bg-space-800 border border-slate-700 hover:border-slate-500 text-xs px-3 py-1.5 rounded-xl font-mono text-slate-200 transition-all shadow-md cursor-pointer"
        >
          Reset Camera
        </button>
      </div>

      {/* Side Event Log Drawer (User Requested: "add it side of globe keep a button called event log when we click it it should shoe the log and also differnet event logs for different task") */}
      {showEventLog && (
        <div className="absolute top-0 right-0 bottom-0 w-80 sm:w-96 bg-space-950/95 border-l border-cyan-500/40 backdrop-blur-xl z-20 flex flex-col p-4 shadow-2xl font-mono pointer-events-auto">
          {/* Drawer Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>LIVE GLOBE EVENT LOG</span>
            </div>
            <button
              onClick={() => setShowEventLog(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-space-900 text-xs"
            >
              ✕ CLOSE
            </button>
          </div>

          {/* Task Log Selector Tabs */}
          <div className="flex flex-wrap gap-1.5 pb-2 border-b border-slate-800/80 mb-2">
            <button
              onClick={() => setSideLogTask("ALL")}
              className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
                sideLogTask === "ALL"
                  ? "bg-cyan-500/25 border-cyan-400 text-cyan-200"
                  : "bg-space-900 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              ALL TASKS
            </button>
            {uniqueTasks.map((tId) => (
              <button
                key={tId}
                onClick={() => setSideLogTask(tId)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
                  sideLogTask === tId
                    ? "bg-emerald-500/25 border-emerald-400 text-emerald-200"
                    : "bg-space-900 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                EVENT LOG FOR {tId}
              </button>
            ))}
          </div>

          {/* Log Stream */}
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5 text-[11px]">
            {filteredSideLogs.length === 0 ? (
              <div className="text-slate-500 text-center py-10">
                No events recorded for {sideLogTask}.
              </div>
            ) : (
              filteredSideLogs.map((entry, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-space-900/80 border border-slate-800/80 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-bold text-slate-500">[{entry.timestamp}]</span>
                    {entry.task_id && (
                      <span className="px-1 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold">
                        {entry.task_id}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-200 leading-snug">{entry.message}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Bottom 20 Satellites Fleet Bar */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 pointer-events-auto">
          {satellites.map((s) => {
            const isAssigned = tasks.some((t) => t.assigned_satellite === s.id && t.phase !== "COMPLETED");
            return (
              <div
                key={s.id}
                onMouseEnter={() => setHoveredSat(s)}
                onMouseLeave={() => setHoveredSat(null)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer backdrop-blur-md ${
                  isAssigned
                    ? "bg-emerald-500/25 border-emerald-400 text-emerald-200 font-bold shadow-md shadow-emerald-500/30 animate-pulse"
                    : s.is_faulty
                    ? "bg-red-950/70 border-red-500 text-red-300"
                    : "bg-space-900/80 border-slate-800 text-slate-300 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${isAssigned ? "bg-emerald-400" : s.is_faulty ? "bg-red-500" : "bg-cyan-400"}`} />
                  <span>{s.id}</span>
                  <span className="text-[9px] text-slate-400">{s.battery.toFixed(0)}%</span>
                  {s.in_eclipse && <span className="text-[8px] text-amber-300">🌑</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Hover telemetry tooltip */}
        {hoveredSat && (
          <div className="bg-space-900/95 border border-cyan-500/50 rounded-xl p-3 text-xs font-mono text-slate-200 shadow-2xl backdrop-blur-lg pointer-events-auto">
            <div className="text-cyan-400 font-bold flex justify-between gap-4">
              <span>{hoveredSat.id}</span>
              <span className={hoveredSat.is_faulty ? "text-red-400" : hoveredSat.is_busy ? "text-amber-400" : "text-emerald-400"}>
                {hoveredSat.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-400">
              <div>Alt: <span className="text-white">{hoveredSat.altitude.toFixed(1)} km</span></div>
              <div>Battery: <span className="text-white">{hoveredSat.battery.toFixed(1)}%</span></div>
              <div>Health: <span className="text-white">{hoveredSat.health.toFixed(3)}</span></div>
              <div>Solar: <span className={hoveredSat.in_eclipse ? "text-amber-400" : "text-emerald-400"}>
                {hoveredSat.in_eclipse ? "🌑 Umbra (Eclipse)" : "☀️ Sunlit (100%)"}
              </span></div>
            </div>
          </div>
        )}
      </div>
    </>
  )}
</div>
  );
}
