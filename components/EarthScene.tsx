'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/modal';
import { Button } from '@heroui/button';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Chip } from '@heroui/chip';
import { Spinner } from '@heroui/spinner';
import { Select, SelectItem } from '@heroui/select';
import { Input } from '@heroui/input';
import { Textarea } from '@heroui/input';
import { Slider } from '@heroui/slider';
import { fetchSatelliteTLEData, calculateSatellitePosition, getSatelliteInfo, SatelliteData, SatelliteInfo, GROUND_STATIONS, latLonToVector3, isSatelliteInRange } from '@/utils/satelliteUtils';
import { useBookingStore } from '@/store/bookingStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useGroundStationStore, CustomGroundStation } from '@/store/groundStationStore';
import { SatelliteBooking } from '@/types';
import styles from './EarthScene.module.css';

// Helper function to create circular texture for stars to prevent square appearance
function createCircleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.2, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export default function EarthScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const earthRef = useRef<THREE.Mesh | null>(null);
  const satellitesRef = useRef<THREE.Group | null>(null);
  const groundStationsRef = useRef<THREE.Group | null>(null);
  const connectionLinesRef = useRef<THREE.Group | null>(null);
  const satelliteDataRef = useRef<SatelliteData[]>([]);
  const satelliteMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const groundStationMeshesRef = useRef<Map<string, { position: THREE.Vector3; mesh: THREE.Mesh }>>(new Map());
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(Date.now());

  // Set raycaster params for easier satellite detection
  useEffect(() => {
    raycasterRef.current.params.Points = { threshold: 0.3 };
    raycasterRef.current.params.Line = { threshold: 0.3 };
  }, []);
  
  const [satellites, setSatellites] = useState<SatelliteData[]>([]);
  const [hoveredSatellite, setHoveredSatellite] = useState<string | null>(null);
  const [selectedSatellite, setSelectedSatellite] = useState<SatelliteInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [activeConnections, setActiveConnections] = useState<number>(0);
  const [showGroundStations, setShowGroundStations] = useState(true);
  const [showConnections, setShowConnections] = useState(true);
  const [showSatellites, setShowSatellites] = useState(true);
  const [maxSatelliteCount, setMaxSatelliteCount] = useState<number>(200);
  const [isGroundStationModalOpen, setIsGroundStationModalOpen] = useState(false);
  const [selectedGroundStation, setSelectedGroundStation] = useState<typeof GROUND_STATIONS[0] | null>(null);
  const [accessibleSatellites, setAccessibleSatellites] = useState<string[]>([]);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [trackingDuration, setTrackingDuration] = useState<number>(24);
  const [isGroundStationDetailOpen, setIsGroundStationDetailOpen] = useState(false);
  const starsRef = useRef<THREE.Points | null>(null);

  const { setGroundStations } = useBookingStore();
  const { filters } = useSettingsStore();
  const { customStations } = useGroundStationStore();

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup with modern dark gradient background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000510);
    scene.fog = new THREE.Fog(0x000510, 10, 50); // Add subtle fog for depth
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 8;
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    // Create Earth with texture
    const earthGeometry = new THREE.SphereGeometry(2, 64, 64);
    
    // Load Earth texture
    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load('/earth-texture.jpg');
    
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: earthTexture,
      shininess: 15,
      specular: 0x222222,
    });

    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);
    earthRef.current = earth;

    // Add enhanced atmosphere glow with multiple layers
    const atmosphereGeometry = new THREE.SphereGeometry(2.08, 64, 64);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x4499ff,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphere);
    
    // Add outer glow layer
    const outerGlowGeometry = new THREE.SphereGeometry(2.15, 64, 64);
    const outerGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x2266ff,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
    scene.add(outerGlow);

    // Create enhanced stars background
    const starsGeometry = new THREE.BufferGeometry();
    const starsVertices = [];
    const starsSizes = [];
    const starsColors = [];
    
    for (let i = 0; i < 10000; i++) {
      const x = (Math.random() - 0.5) * 200;
      const y = (Math.random() - 0.5) * 200;
      const z = (Math.random() - 0.5) * 200;
      
      // Filter out stars that are too close to prevent square appearance
      const distance = Math.sqrt(x * x + y * y + z * z);
      if (distance < 15) continue; // Skip stars within 15 units of center
      
      starsVertices.push(x, y, z);
      
      // Smaller, more uniform sizes to prevent squares
      starsSizes.push(Math.random() * 0.8 + 0.3);
      
      // Slight color variations (white to light blue)
      const color = new THREE.Color();
      color.setHSL(0.6, 0.1 + Math.random() * 0.2, 0.8 + Math.random() * 0.2);
      starsColors.push(color.r, color.g, color.b);
    }

    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    starsGeometry.setAttribute('size', new THREE.Float32BufferAttribute(starsSizes, 1));
    starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starsColors, 3));
    
    const starsMaterial = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      sizeAttenuation: true,
      map: createCircleTexture(),
    });
    
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
    starsRef.current = stars;

    // Satellites group
    const satellitesGroup = new THREE.Group();
    scene.add(satellitesGroup);
    satellitesRef.current = satellitesGroup;

    // Ground stations group - make it a child of Earth so it rotates with the globe
    const groundStationsGroup = new THREE.Group();
    earth.add(groundStationsGroup); // Changed from scene.add to earth.add
    groundStationsRef.current = groundStationsGroup;

    // Connection lines group
    const connectionLinesGroup = new THREE.Group();
    scene.add(connectionLinesGroup);
    connectionLinesRef.current = connectionLinesGroup;

    // Add ground stations to the scene
    const EARTH_RADIUS = 2;
    GROUND_STATIONS.forEach((gs) => {
      const position = latLonToVector3(gs.location.lat, gs.location.lon, EARTH_RADIUS + 0.02);
      
      // Create ground station marker (antenna tower) with improved visuals
      const towerGeometry = new THREE.ConeGeometry(0.04, 0.12, 8);
      const towerMaterial = new THREE.MeshStandardMaterial({
        color: gs.status === 'online' ? 0x00ff00 : 0xff0000,
        emissive: gs.status === 'online' ? 0x00ff00 : 0xff0000,
        emissiveIntensity: 0.6,
        metalness: 0.7,
        roughness: 0.3,
      });
      const tower = new THREE.Mesh(towerGeometry, towerMaterial);
      tower.position.set(position.x, position.y, position.z);
      
      // Point tower upward from Earth's center
      tower.lookAt(position.x * 2, position.y * 2, position.z * 2);
      tower.rotateX(Math.PI / 2);
      
      tower.userData.groundStation = gs;
      tower.userData.isGroundStation = true; // Flag for easier identification
      
      // Add glow sprite to ground station
      const gsGlowTexture = createCircleTexture();
      const gsSpriteMaterial = new THREE.SpriteMaterial({
        map: gsGlowTexture,
        color: gs.status === 'online' ? 0x00ff00 : 0xff0000,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
      });
      const gsSprite = new THREE.Sprite(gsSpriteMaterial);
      gsSprite.scale.set(0.2, 0.2, 1);
      tower.add(gsSprite);
      
      // Add base platform with improved material
      const platformGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.015, 16);
      const platformMaterial = new THREE.MeshStandardMaterial({
        color: 0x555555,
        metalness: 0.8,
        roughness: 0.2,
      });
      const platform = new THREE.Mesh(platformGeometry, platformMaterial);
      platform.position.set(position.x, position.y, position.z);
      platform.lookAt(position.x * 2, position.y * 2, position.z * 2);
      platform.rotateX(Math.PI / 2);
      
      groundStationsGroup.add(tower);
      groundStationsGroup.add(platform);
      
      // Add field of view cone with improved visuals
      const fovHeight = 1.5;
      const fovRadius = Math.tan((30 * Math.PI) / 180) * fovHeight;
      const fovGeometry = new THREE.ConeGeometry(fovRadius, fovHeight, 32, 1, true);
      const fovMaterial = new THREE.MeshBasicMaterial({
        color: gs.status === 'online' ? 0x00ff88 : 0xff0000,
        transparent: true,
        opacity: 0.05,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const fovCone = new THREE.Mesh(fovGeometry, fovMaterial);
      fovCone.position.set(position.x, position.y, position.z);
      fovCone.lookAt(position.x * 2, position.y * 2, position.z * 2);
      fovCone.rotateX(-Math.PI / 2);
      groundStationsGroup.add(fovCone);
      
      // Store ground station position for connection calculations
      groundStationMeshesRef.current.set(gs.id, {
        position: new THREE.Vector3(position.x, position.y, position.z),
        mesh: tower,
      });
    });

    // Merge custom ground stations with default ones and initialize in store
    const allGroundStations = [
      ...GROUND_STATIONS,
      ...customStations.map(cs => ({
        id: cs.id,
        name: cs.name,
        location: cs.location,
        status: cs.status,
        capacity: cs.capacity,
        antennaType: cs.antennaType,
        frequency: cs.frequency,
      }))
    ];
    setGroundStations(allGroundStations);

    // Animation loop with real-time satellite updates
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      // Update satellite positions every frame for real-time tracking
      const now = Date.now();
      if (now - lastUpdateTimeRef.current > 1000) { // Update every second
        lastUpdateTimeRef.current = now;
        updateSatellitePositions();
      }
      
      renderer.render(scene, camera);
    };
    
    const updateSatellitePositions = () => {
      if (!satellitesRef.current || satelliteDataRef.current.length === 0) return;
      
      const currentDate = new Date();
      let connections = 0;
      const MAX_CONNECTION_LINES = 15; // Limit total connection lines for performance
      
      // Clear existing connection lines
      if (connectionLinesRef.current) {
        while (connectionLinesRef.current.children.length > 0) {
          connectionLinesRef.current.remove(connectionLinesRef.current.children[0]);
        }
      }
      
      satelliteDataRef.current.forEach((sat) => {
        if (!sat.satrec) return;
        
        const position = calculateSatellitePosition(sat.satrec, currentDate);
        if (!position) return;
        
        const satelliteMesh = satelliteMeshesRef.current.get(sat.name);
        if (satelliteMesh) {
          satelliteMesh.position.set(position.x, position.y, position.z);
          
          // Only draw connection lines if we haven't hit the limit
          if (connections < MAX_CONNECTION_LINES && showConnections) {
            // Check connections to ground stations
            groundStationMeshesRef.current.forEach((gs) => {
              if (connections >= MAX_CONNECTION_LINES) return;
              
              // Get the world position of the ground station (accounting for Earth's rotation)
              const gsWorldPosition = new THREE.Vector3();
              gs.mesh.getWorldPosition(gsWorldPosition);
              
              if (isSatelliteInRange(position, gsWorldPosition, 10)) {
                connections++;
                
                // Draw connection line using world position
                if (connectionLinesRef.current) {
                  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(position.x, position.y, position.z),
                    gsWorldPosition,
                  ]);
                  const lineMaterial = new THREE.LineBasicMaterial({
                    color: 0x00ffff,
                    transparent: true,
                    opacity: 0.4,
                    linewidth: 2,
                    depthTest: true,
                    depthWrite: false,
                  });
                  const line = new THREE.Line(lineGeometry, lineMaterial);
                  connectionLinesRef.current.add(line);
                }
              }
            });
          }
        }
      });
      
      setActiveConnections(connections);
    };
    
    animate();

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return;
      
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Mouse controls for camera
    let isMouseDown = false;
    let isDragging = false;
    let dragStartPosition = { x: 0, y: 0 };
    let previousMousePosition = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      isDragging = false; // Will be set to true if mouse moves significantly
      dragStartPosition = { x: e.clientX, y: e.clientY };
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      setTooltipPosition({ x: e.clientX, y: e.clientY });

      // Only check for dragging if mouse button is pressed
      if (isMouseDown) {
        // Check if mouse has moved significantly to consider it a drag
        const deltaFromStart = Math.abs(e.clientX - dragStartPosition.x) + Math.abs(e.clientY - dragStartPosition.y);
        if (deltaFromStart > 5) {
          isDragging = true;
        }

        if (isDragging && earthRef.current) {
          const deltaX = e.clientX - previousMousePosition.x;
          const deltaY = e.clientY - previousMousePosition.y;

          earthRef.current.rotation.y += deltaX * 0.005;
          earthRef.current.rotation.x += deltaY * 0.005;

          if (satellitesRef.current) {
            satellitesRef.current.rotation.y = earthRef.current.rotation.y;
            satellitesRef.current.rotation.x = earthRef.current.rotation.x;
          }

          previousMousePosition = { x: e.clientX, y: e.clientY };
          document.body.style.cursor = 'grabbing';
        }
      } else {
        // Check for satellite hover only when not dragging
        if (satellitesRef.current && cameraRef.current) {
          raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
          
          // Check ground stations first
          if (groundStationsRef.current) {
            const gsChildren: THREE.Object3D[] = [];
            groundStationsRef.current.traverse((child) => {
              if (child.userData.isGroundStation) {
                gsChildren.push(child);
              }
            });
            
            const gsIntersects = raycasterRef.current.intersectObjects(gsChildren, true);
            
            if (gsIntersects.length > 0) {
              const hoveredStation = gsIntersects[0].object.userData.groundStation;
              if (hoveredStation) {
                setHoveredSatellite(hoveredStation.name);
                document.body.style.cursor = 'pointer';
                return;
              }
            }
          }
          
          // Check satellites
          const satelliteMeshes = satellitesRef.current.children.filter(
            child => child.type === 'Mesh' && child.userData.name
          );
          const intersects = raycasterRef.current.intersectObjects(satelliteMeshes);

          if (intersects.length > 0) {
            const satelliteMesh = intersects[0].object;
            setHoveredSatellite(satelliteMesh.userData.name);
            document.body.style.cursor = 'pointer';
          } else {
            setHoveredSatellite(null);
            document.body.style.cursor = 'grab';
          }
        }
      }
    };

    const handleMouseUp = () => {
      isMouseDown = false;
      document.body.style.cursor = 'grab';
    };

    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current || !satellitesRef.current || !cameraRef.current) return;

      // Don't process click if it was a drag
      if (isDragging) {
        isDragging = false;
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      
      // Check for ground station clicks first
      if (groundStationsRef.current) {
        const gsChildren: THREE.Object3D[] = [];
        groundStationsRef.current.traverse((child) => {
          if (child.userData.isGroundStation) {
            gsChildren.push(child);
          }
        });
        
        const gsIntersects = raycasterRef.current.intersectObjects(gsChildren, true);
        
        if (gsIntersects.length > 0) {
          const clickedStation = gsIntersects[0].object.userData.groundStation;
          if (clickedStation) {
            setSelectedGroundStation(clickedStation);
            
            // Calculate which satellites are accessible from this ground station
            const accessible: string[] = [];
            const gsData = groundStationMeshesRef.current.get(clickedStation.id);
            
            if (gsData) {
              const gsWorldPosition = new THREE.Vector3();
              gsData.mesh.getWorldPosition(gsWorldPosition);
              
              satelliteDataRef.current.forEach((sat) => {
                if (!sat.satrec) return;
                const position = calculateSatellitePosition(sat.satrec);
                if (position && isSatelliteInRange(position, gsWorldPosition, 10)) {
                  accessible.push(sat.name);
                }
              });
            }
            
            setAccessibleSatellites(accessible);
            setIsBookingModalOpen(true);
            return;
          }
        }
      }
      
      // Only check satellite meshes, not trails
      const satelliteMeshes = satellitesRef.current.children.filter(
        child => child.type === 'Mesh' && child.userData.name
      );
      const intersects = raycasterRef.current.intersectObjects(satelliteMeshes);

      if (intersects.length > 0) {
        const satelliteMesh = intersects[0].object;
        const satData = satellites.find(s => s.name === satelliteMesh.userData.name);
        
        if (satData) {
          const info = getSatelliteInfo(satData);
          if (info) {
            setSelectedSatellite(info);
            setIsModalOpen(true);
          }
        }
      }
    };

    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('click', handleClick);
    renderer.domElement.style.cursor = 'grab';

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('click', handleClick);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      
      renderer.dispose();
    };
  }, [setGroundStations, showConnections]);

  // Fetch satellites
  useEffect(() => {
    const loadSatellites = async () => {
      setLoading(true);
      const sats = await fetchSatelliteTLEData();
      
      // Apply filters from settings
      let filteredSats = sats;
      
      // Filter by country if specified
      if (filters.country && filters.country !== 'all') {
        filteredSats = filteredSats.filter(sat => 
          sat.category?.toLowerCase().includes(filters.country.toLowerCase())
        );
      }
      
      // Limit by amount from settings (use filters.amount or maxSatelliteCount)
      const maxCount = filters.amount || maxSatelliteCount;
      filteredSats = filteredSats.slice(0, maxCount);
      
      setSatellites(filteredSats);
      satelliteDataRef.current = filteredSats;
      setLoading(false);
    };

    loadSatellites();
  }, [filters, maxSatelliteCount]);

  // Update satellite positions in scene
  useEffect(() => {
    if (!satellitesRef.current || satellites.length === 0) return;

    // Clear existing satellites
    satelliteMeshesRef.current.clear();
    while (satellitesRef.current.children.length > 0) {
      satellitesRef.current.remove(satellitesRef.current.children[0]);
    }

    // Add satellites to scene (limit to maxSatelliteCount)
    const satellitesToDisplay = satellites.slice(0, maxSatelliteCount);
    
    // Update satelliteDataRef to match displayed satellites
    satelliteDataRef.current = satellitesToDisplay;
    
    satellitesToDisplay.forEach((sat) => {
      if (!sat.satrec) return;

      const position = calculateSatellitePosition(sat.satrec);
      if (!position) return;

      // Create satellite mesh - smaller with glow effect for modern look
      const satelliteGeometry = new THREE.SphereGeometry(0.02, 16, 16);
      const satelliteMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.8,
        metalness: 0.5,
        roughness: 0.2,
      });

      const satelliteMesh = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
      
      // Add glow effect with sprite
      const glowTexture = createCircleTexture();
      const spriteMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0x00ffff,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(0.15, 0.15, 1);
      satelliteMesh.add(sprite);
      satelliteMesh.position.set(position.x, position.y, position.z);
      satelliteMesh.userData.name = sat.name;
      
      // Store reference for real-time updates
      satelliteMeshesRef.current.set(sat.name, satelliteMesh);

      // Add orbit trail
      const trailGeometry = new THREE.BufferGeometry();
      const trailPoints = [];
      const numPoints = 50;

      for (let i = 0; i < numPoints; i++) {
        const date = new Date(Date.now() - i * 60000); // 1 minute intervals
        const pos = calculateSatellitePosition(sat.satrec, date);
        if (pos) {
          trailPoints.push(pos.x, pos.y, pos.z);
        }
      }

      trailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(trailPoints, 3));
      const trailMaterial = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        opacity: 0.2,
        transparent: true,
        linewidth: 1,
      });
      const trail = new THREE.Line(trailGeometry, trailMaterial);

      satellitesRef.current?.add(satelliteMesh);
      satellitesRef.current?.add(trail);
    });
  }, [satellites, maxSatelliteCount]);

  return (
    <div className="relative w-full h-screen">
      <div ref={containerRef} className="w-full h-full" />
      
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center">
            <Spinner size="lg" color="primary" />
            <p className="mt-4 text-white">Loading satellites...</p>
          </div>
        </div>
      )}

      {hoveredSatellite && (
        <div
          className={styles.tooltip}
          /* eslint-disable-next-line react/forbid-dom-props */
          style={{
            left: `${tooltipPosition.x + 10}px`,
            top: `${tooltipPosition.y + 10}px`,
          }}
        >
          {hoveredSatellite}
        </div>
      )}

      <div className="absolute top-4 left-4 bg-black/70 text-white p-4 rounded-lg backdrop-blur-sm max-w-xs">
        <h3 className="text-lg font-bold mb-3">Thunderlink Network</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Satellites:</span>
            <span className="font-bold text-blue-400">{Math.min(satellites.length, maxSatelliteCount)}</span>
          </div>
          <div className="flex justify-between">
            <span>Ground Stations:</span>
            <span className="font-bold text-green-400">{GROUND_STATIONS.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Active Connections:</span>
            <span className="font-bold text-cyan-400">{activeConnections}</span>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {/* Satellite Count Slider */}
          <div className="space-y-1">
            <label className="text-xs text-gray-300">Satellite Count: {maxSatelliteCount}</label>
            <Slider
              size="sm"
              step={10}
              minValue={10}
              maxValue={500}
              value={maxSatelliteCount}
              onChange={(value: number | number[]) => setMaxSatelliteCount(value as number)}
              className="max-w-full"
              color="primary"
            />
          </div>
          <Button 
            color="primary" 
            fullWidth 
            onPress={() => setIsBookingModalOpen(true)}
            className="font-semibold"
          >
            Book Satellite Time
          </Button>
          <Button 
            color="success" 
            variant="flat"
            fullWidth 
            onPress={() => setIsGroundStationModalOpen(true)}
            className="font-semibold"
          >
            📡 Manage Ground Stations
          </Button>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              color={showSatellites ? 'primary' : 'default'}
              onPress={() => {
                const newVisibility = !showSatellites;
                setShowSatellites(newVisibility);
                if (satellitesRef.current) {
                  satellitesRef.current.visible = newVisibility;
                }
              }}
              fullWidth
            >
              {showSatellites ? 'Hide' : 'Show'} Satellites
            </Button>
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              color={showGroundStations ? 'success' : 'default'}
              onPress={() => {
                const newVisibility = !showGroundStations;
                setShowGroundStations(newVisibility);
                if (groundStationsRef.current) {
                  groundStationsRef.current.visible = newVisibility;
                }
              }}
              fullWidth
            >
              {showGroundStations ? 'Hide' : 'Show'} Stations
            </Button>
            <Button 
              size="sm" 
              color={showConnections ? 'primary' : 'default'}
              onPress={() => setShowConnections(!showConnections)}
              fullWidth
            >
              {showConnections ? 'Hide' : 'Show'} Links
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Drag to rotate • Click satellite for info • Click station to book
        </p>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            setAutoRefreshInterval(null);
          }
        }}
        size="lg"
        backdrop="blur"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-xl font-bold">{selectedSatellite?.name}</h2>
                <Chip color="primary" size="sm">{selectedSatellite?.category}</Chip>
              </ModalHeader>
              <ModalBody>
                {selectedSatellite && (
                  <div className="space-y-4"
                    // Auto-refresh satellite data every 15 seconds
                    ref={(el) => {
                      if (el && !autoRefreshInterval) {
                        const interval = setInterval(() => {
                          const satData = satelliteDataRef.current.find(s => s.name === selectedSatellite.name);
                          if (satData) {
                            const updatedInfo = getSatelliteInfo(satData);
                            if (updatedInfo) {
                              setSelectedSatellite(updatedInfo);
                            }
                          }
                        }, 15000);
                        setAutoRefreshInterval(interval);
                      }
                    }}
                  >
                    {/* Satellite Identity Card */}
                    <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
                      <CardBody>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Category:</span>
                            <Chip color="primary" size="sm" variant="flat">
                              {selectedSatellite.category}
                            </Chip>
                          </div>
                          {selectedSatellite.noradId && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">NORAD ID:</span>
                              <span className="font-mono font-semibold text-primary">
                                {selectedSatellite.noradId}
                              </span>
                            </div>
                          )}
                          {selectedSatellite.launchDate && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Launch Date:</span>
                              <span className="font-mono text-sm">
                                {selectedSatellite.launchDate}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardBody>
                    </Card>

                    {/* Real-time Position */}
                    <Card>
                      <CardHeader className="font-semibold flex items-center gap-2">
                        <span className="text-lg">📍</span>
                        Current Position
                      </CardHeader>
                      <CardBody>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <span className="text-gray-500 block text-xs mb-1">Latitude</span>
                            <span className="font-mono font-bold text-lg">
                              {selectedSatellite.position.lat.toFixed(4)}°
                            </span>
                            <span className="text-xs text-gray-500 ml-1">
                              {selectedSatellite.position.lat >= 0 ? 'N' : 'S'}
                            </span>
                          </div>
                          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <span className="text-gray-500 block text-xs mb-1">Longitude</span>
                            <span className="font-mono font-bold text-lg">
                              {selectedSatellite.position.lon.toFixed(4)}°
                            </span>
                            <span className="text-xs text-gray-500 ml-1">
                              {selectedSatellite.position.lon >= 0 ? 'E' : 'W'}
                            </span>
                          </div>
                          <div className="col-span-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                            <span className="text-gray-500 block text-xs mb-1">Altitude Above Earth</span>
                            <span className="font-mono font-bold text-xl text-blue-600 dark:text-blue-400">
                              {selectedSatellite.position.alt.toFixed(2)} km
                            </span>
                            <span className="text-xs text-gray-500 ml-2">
                              ({(selectedSatellite.position.alt * 0.621371).toFixed(2)} miles)
                            </span>
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    {/* Orbital Dynamics */}
                    <Card>
                      <CardHeader className="font-semibold flex items-center gap-2">
                        <span className="text-lg">🛰️</span>
                        Orbital Data
                      </CardHeader>
                      <CardBody>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                            <span className="text-gray-500 block text-xs mb-1">Velocity</span>
                            <span className="font-mono font-bold text-lg text-purple-600 dark:text-purple-400">
                              {selectedSatellite.velocity.toFixed(2)} km/s
                            </span>
                            <span className="text-xs text-gray-500 block mt-1">
                              {(selectedSatellite.velocity * 3600).toFixed(0)} km/h
                            </span>
                          </div>
                          {selectedSatellite.period && (
                            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                              <span className="text-gray-500 block text-xs mb-1">Orbital Period</span>
                              <span className="font-mono font-bold text-lg text-green-600 dark:text-green-400">
                                {selectedSatellite.period.toFixed(0)} min
                              </span>
                              <span className="text-xs text-gray-500 block mt-1">
                                {(selectedSatellite.period / 60).toFixed(2)} hours
                              </span>
                            </div>
                          )}
                          {selectedSatellite.period && (
                            <div className="col-span-2 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                              <span className="text-gray-500 block text-xs mb-1">Orbits Per Day</span>
                              <span className="font-mono font-bold text-lg text-orange-600 dark:text-orange-400">
                                {(1440 / selectedSatellite.period).toFixed(2)}
                              </span>
                              <span className="text-xs text-gray-500 ml-2">
                                Complete orbits around Earth per 24 hours
                              </span>
                            </div>
                          )}
                        </div>
                      </CardBody>
                    </Card>

                    {/* Live Status Indicator */}
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      Live data • Updates in real-time
                    </div>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="light" onPress={onClose}>
                  Close
                </Button>
                <Button 
                  color="secondary" 
                  variant="flat"
                  onPress={() => {
                    onClose();
                    setIsTrackingModalOpen(true);
                  }}
                >
                  🔍 Track Satellite
                </Button>
                <Button 
                  color="primary" 
                  onPress={() => {
                    onClose();
                    setIsBookingModalOpen(true);
                  }}
                >
                  Book This Satellite
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Booking Modal */}
      <Modal 
        isOpen={isBookingModalOpen} 
        onClose={() => {
          setIsBookingModalOpen(false);
          setSelectedGroundStation(null);
          setAccessibleSatellites([]);
        }}
        size="2xl"
        backdrop="blur"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold">Book Satellite Time</h2>
                {selectedGroundStation ? (
                  <div className="flex items-center gap-2">
                    <Chip color="success" size="sm" variant="flat">
                      📡 {selectedGroundStation.name}
                    </Chip>
                    <p className="text-sm text-gray-500">
                      {accessibleSatellites.length} satellites currently accessible
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Select a satellite and time slot to get started</p>
                )}
              </ModalHeader>
              <ModalBody>
                <BookingSatelliteSelector 
                  satellites={satellites}
                  groundStations={GROUND_STATIONS}
                  selectedGroundStation={selectedGroundStation}
                  accessibleSatellites={accessibleSatellites}
                  onClose={onClose}
                />
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Ground Station Management Modal */}
      <Modal 
        isOpen={isGroundStationModalOpen} 
        onClose={() => setIsGroundStationModalOpen(false)}
        size="3xl"
        backdrop="blur"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold">📡 Ground Station Management</h2>
                <p className="text-sm text-gray-500">View all stations and register your own</p>
              </ModalHeader>
              <ModalBody>
                <GroundStationManager 
                  defaultStations={GROUND_STATIONS}
                  onClose={onClose}
                />
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Satellite Tracking Modal */}
      <Modal 
        isOpen={isTrackingModalOpen} 
        onClose={() => setIsTrackingModalOpen(false)}
        size="2xl"
        backdrop="blur"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold">🔍 Track Satellite: {selectedSatellite?.name}</h2>
                <p className="text-sm text-gray-500">Monitor satellite position over time</p>
              </ModalHeader>
              <ModalBody>
                {selectedSatellite && (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="font-semibold">Tracking Configuration</CardHeader>
                      <CardBody className="space-y-4">
                        <Slider
                          label="Tracking Duration (hours)"
                          value={trackingDuration}
                          onChange={(value: number | number[]) => setTrackingDuration(value as number)}
                          minValue={1}
                          maxValue={48}
                          step={1}
                          marks={[
                            { value: 6, label: '6h' },
                            { value: 12, label: '12h' },
                            { value: 24, label: '24h' },
                            { value: 48, label: '48h' },
                          ]}
                          className="max-w-full"
                          color="secondary"
                        />
                        <div className="p-4 bg-secondary-50 dark:bg-secondary-950 rounded-lg">
                          <p className="text-sm">
                            <strong>Current Configuration:</strong><br/>
                            • Track for: <strong>{trackingDuration} hours</strong><br/>
                            • Updates every: <strong>15 seconds</strong><br/>
                            • Total data points: <strong>~{(trackingDuration * 60 * 4).toLocaleString()}</strong>
                          </p>
                        </div>
                      </CardBody>
                    </Card>

                    <Card>
                      <CardHeader className="font-semibold">Current Trajectory</CardHeader>
                      <CardBody>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                            <span className="text-gray-500 block text-xs mb-1">Current Position</span>
                            <span className="font-mono font-bold">
                              {selectedSatellite.position.lat.toFixed(2)}°, {selectedSatellite.position.lon.toFixed(2)}°
                            </span>
                          </div>
                          <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                            <span className="text-gray-500 block text-xs mb-1">Current Velocity</span>
                            <span className="font-mono font-bold">
                              {selectedSatellite.velocity.toFixed(2)} km/s
                            </span>
                          </div>
                          {selectedSatellite.period && (
                            <>
                              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                                <span className="text-gray-500 block text-xs mb-1">Orbital Period</span>
                                <span className="font-mono font-bold">
                                  {selectedSatellite.period.toFixed(0)} min
                                </span>
                              </div>
                              <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                                <span className="text-gray-500 block text-xs mb-1">Passes in {trackingDuration}h</span>
                                <span className="font-mono font-bold">
                                  {((trackingDuration * 60) / selectedSatellite.period).toFixed(1)} orbits
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </CardBody>
                    </Card>

                    <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30">
                      <CardBody>
                        <h3 className="font-bold mb-2">📊 Tracking Features</h3>
                        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                          <li>✅ Real-time position updates every 15 seconds</li>
                          <li>✅ Historical path visualization for {trackingDuration} hours</li>
                          <li>✅ Altitude and velocity monitoring</li>
                          <li>✅ Ground station pass predictions</li>
                          <li>✅ Export tracking data (CSV format)</li>
                        </ul>
                      </CardBody>
                    </Card>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="light" onPress={onClose}>
                  Close
                </Button>
                <Button 
                  color="secondary" 
                  onPress={() => {
                    // Here you would implement the actual tracking functionality
                    alert(`Tracking ${selectedSatellite?.name} for ${trackingDuration} hours. This feature will continuously monitor and log satellite positions.`);
                    onClose();
                  }}
                >
                  Start Tracking
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

// Booking Satellite Selector Component
interface BookingSelectorProps {
  satellites: SatelliteData[];
  groundStations: typeof GROUND_STATIONS;
  selectedGroundStation?: typeof GROUND_STATIONS[0] | null;
  accessibleSatellites?: string[];
  onClose: () => void;
}

function BookingSatelliteSelector({ satellites, groundStations, selectedGroundStation, accessibleSatellites = [], onClose }: BookingSelectorProps) {
  const { addBooking } = useBookingStore();
  const [selectedSatellite, setSelectedSatellite] = useState<string>('');
  const [duration, setDuration] = useState<number>(30);
  const [startTime, setStartTime] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  
  // Calculate price based on satellite type and duration
  const calculatePrice = (satName: string, durationMinutes: number): number => {
    const satellite = satellites.find(s => s.name === satName);
    if (!satellite) return 0;
    
    // Base price per minute based on orbit type
    const category = satellite.category || '';
    let pricePerMinute = 10; // Default $10/min
    
    if (category.includes('Geostationary') || category.includes('GEO')) {
      pricePerMinute = 25; // $25/min for GEO
    } else if (category.includes('Intelsat') || category.includes('SES')) {
      pricePerMinute = 30; // Premium pricing
    } else if (category.includes('Iridium') || category.includes('Globalstar')) {
      pricePerMinute = 15; // LEO constellation pricing
    }
    
    return pricePerMinute * durationMinutes;
  };
  
  const price = selectedSatellite ? calculatePrice(selectedSatellite, duration) : 0;
  
  const handleBooking = () => {
    if (!selectedSatellite || !startTime || !purpose) {
      alert('Please fill in all fields');
      return;
    }
    
    const satellite = satellites.find(s => s.name === selectedSatellite);
    if (!satellite) return;
    
    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60000);
    
    // Find available ground stations for this satellite
    const availableStations = groundStations
      .filter((gs: { status: string; id: string }) => gs.status === 'online')
      .slice(0, 3)
      .map((gs: { status: string; id: string }) => gs.id);
    
    const booking: SatelliteBooking = {
      id: `booking-${Date.now()}`,
      satelliteName: satellite.name,
      satelliteId: satellite.tleLine1.substring(2, 7).trim(),
      startTime: start,
      endTime: end,
      duration,
      price,
      status: 'pending',
      groundStations: availableStations,
      dataRate: '100 Mbps',
      purpose,
    };
    
    addBooking(booking);
    alert(`Booking confirmed! Total: $${price.toLocaleString()}`);
    onClose();
  };
  
  return (
    <div className="space-y-6">
      {/* Selected Ground Station Info */}
      {selectedGroundStation && accessibleSatellites.length > 0 && (
        <Card className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30">
          <CardHeader className="font-semibold flex items-center gap-2">
            <span className="text-xl">📡</span>
            {selectedGroundStation.name}
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-400">Location</div>
                <div className="font-bold">{selectedGroundStation.location.city}, {selectedGroundStation.location.country}</div>
              </div>
              <div>
                <div className="text-gray-400">Status</div>
                <Chip size="sm" color="success" variant="flat">
                  {selectedGroundStation.status}
                </Chip>
              </div>
              <div>
                <div className="text-gray-400">Antenna</div>
                <div className="font-bold text-sm">{selectedGroundStation.antennaType}</div>
              </div>
              <div>
                <div className="text-gray-400">Frequency</div>
                <div className="font-bold text-sm">{selectedGroundStation.frequency}</div>
              </div>
            </div>
            <div className="pt-3 border-t border-green-500/30">
              <div className="text-sm text-gray-400 mb-2">Currently Accessible Satellites:</div>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {accessibleSatellites.slice(0, 15).map((satName) => (
                  <Chip key={satName} size="sm" color="primary" variant="flat">
                    {satName}
                  </Chip>
                ))}
                {accessibleSatellites.length > 15 && (
                  <Chip size="sm" color="default" variant="flat">
                    +{accessibleSatellites.length - 15} more
                  </Chip>
                )}
              </div>
              <p className="text-xs text-green-300 mt-2">
                ✨ These satellites are currently in range and available for immediate booking
              </p>
            </div>
          </CardBody>
        </Card>
      )}
      
      {/* Satellite Selection */}
      <Card>
        <CardHeader className="font-semibold">Select Satellite</CardHeader>
        <CardBody>
          <Select
            label="Choose a satellite"
            placeholder="Select a satellite"
            selectedKeys={selectedSatellite ? [selectedSatellite] : []}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              setSelectedSatellite(selected);
            }}
          >
            {satellites.slice(0, 50).map((sat) => (
              <SelectItem key={sat.name}>
                {sat.name} - {sat.category}
              </SelectItem>
            ))}
          </Select>
        </CardBody>
      </Card>
      
      {/* Time Selection */}
      <Card>
        <CardHeader className="font-semibold">Schedule</CardHeader>
        <CardBody className="space-y-4">
          <Input
            type="datetime-local"
            label="Start Time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
          />
          <div className="space-y-2">
            <label className="block text-sm">Duration: {duration} minutes</label>
            <Slider
              step={15}
              minValue={15}
              maxValue={240}
              value={duration}
              onChange={(value: number | number[]) => setDuration(value as number)}
              className="max-w-full"
              color="primary"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>15 min</span>
              <span>240 min (4 hrs)</span>
            </div>
          </div>
        </CardBody>
      </Card>
      
      {/* Purpose */}
      <Card>
        <CardHeader className="font-semibold">Purpose</CardHeader>
        <CardBody>
          <Textarea
            placeholder="Brief description of your mission (e.g., Earth observation, data relay, research)"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            minRows={3}
          />
        </CardBody>
      </Card>
      
      {/* Features & Network Info */}
      <Card>
        <CardHeader className="font-semibold">Network Features</CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-400">Ground Stations</div>
              <div className="font-bold text-green-400">{groundStations.length} worldwide</div>
            </div>
            <div>
              <div className="text-gray-400">Coverage</div>
              <div className="font-bold">Global 24/7</div>
            </div>
            <div>
              <div className="text-gray-400">Data Rate</div>
              <div className="font-bold">Up to 1 Gbps</div>
            </div>
            <div>
              <div className="text-gray-400">Latency</div>
              <div className="font-bold">20-40ms</div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-300">
              ⚡ With our global ground station network, you can connect to any satellite 
              anytime, anywhere - not just when it passes over your location!
            </p>
          </div>
        </CardBody>
      </Card>
      
      {/* Price Summary */}
      {selectedSatellite && (
        <Card>
          <CardHeader className="font-semibold">Price Summary</CardHeader>
          <CardBody>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Duration:</span>
                <span>{duration} minutes</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Rate:</span>
                <span>${(price / duration).toFixed(2)}/min</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Network Access:</span>
                <span>Included</span>
              </div>
              <div className="border-t border-gray-600 pt-2 mt-2"></div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-green-400">${price.toLocaleString()}</span>
              </div>
            </div>
            <Button 
              color="primary" 
              size="lg"
              fullWidth
              className="mt-4"
              onPress={handleBooking}
              isDisabled={!selectedSatellite || !startTime || !purpose}
            >
              Confirm Booking
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

// Ground Station Manager Component
interface GroundStationManagerProps {
  defaultStations: typeof GROUND_STATIONS;
  onClose: () => void;
}

function GroundStationManager({ defaultStations, onClose }: GroundStationManagerProps) {
  const { customStations, addStation, removeStation, toggleStationStatus } = useGroundStationStore();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newStation, setNewStation] = useState({
    name: '',
    lat: 0,
    lon: 0,
    city: '',
    country: '',
    capacity: 30,
    antennaType: 'Parabolic 10m',
    frequency: 'Ka-band',
    status: 'online' as const,
  });

  const handleAddStation = () => {
    if (!newStation.name || !newStation.city || !newStation.country) {
      alert('Please fill in all required fields');
      return;
    }

    addStation({
      name: newStation.name,
      location: {
        lat: newStation.lat,
        lon: newStation.lon,
        city: newStation.city,
        country: newStation.country,
      },
      status: newStation.status,
      capacity: newStation.capacity,
      antennaType: newStation.antennaType,
      frequency: newStation.frequency,
    });

    // Reset form
    setNewStation({
      name: '',
      lat: 0,
      lon: 0,
      city: '',
      country: '',
      capacity: 30,
      antennaType: 'Parabolic 10m',
      frequency: 'Ka-band',
      status: 'online',
    });
    setIsAddingNew(false);
  };

  const allStations = [...defaultStations, ...customStations];

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-primary">{allStations.length}</div>
            <div className="text-sm text-gray-500">Total Stations</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-green-500">
              {allStations.filter(s => s.status === 'online').length}
            </div>
            <div className="text-sm text-gray-500">Online</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-purple-500">{customStations.length}</div>
            <div className="text-sm text-gray-500">Custom</div>
          </CardBody>
        </Card>
      </div>

      {/* Add New Station Button */}
      {!isAddingNew && (
        <Button 
          color="success" 
          variant="flat"
          fullWidth
          onPress={() => setIsAddingNew(true)}
          startContent={<span>➕</span>}
        >
          Register New Ground Station
        </Button>
      )}

      {/* Add New Station Form */}
      {isAddingNew && (
        <Card className="border-2 border-success">
          <CardHeader className="font-bold">Register New Ground Station</CardHeader>
          <CardBody className="space-y-3">
            <Input
              label="Station Name"
              placeholder="e.g., My Station Alpha"
              value={newStation.name}
              onChange={(e) => setNewStation({ ...newStation, name: e.target.value })}
              isRequired
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="City"
                placeholder="e.g., Los Angeles"
                value={newStation.city}
                onChange={(e) => setNewStation({ ...newStation, city: e.target.value })}
                isRequired
              />
              <Input
                label="Country"
                placeholder="e.g., USA"
                value={newStation.country}
                onChange={(e) => setNewStation({ ...newStation, country: e.target.value })}
                isRequired
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                label="Latitude"
                placeholder="e.g., 34.0522"
                value={newStation.lat.toString()}
                onChange={(e) => setNewStation({ ...newStation, lat: parseFloat(e.target.value) || 0 })}
                isRequired
              />
              <Input
                type="number"
                label="Longitude"
                placeholder="e.g., -118.2437"
                value={newStation.lon.toString()}
                onChange={(e) => setNewStation({ ...newStation, lon: parseFloat(e.target.value) || 0 })}
                isRequired
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Antenna Type"
                selectedKeys={[newStation.antennaType]}
                onChange={(e) => setNewStation({ ...newStation, antennaType: e.target.value })}
              >
                <SelectItem key="Parabolic 10m">Parabolic 10m</SelectItem>
                <SelectItem key="Parabolic 12m">Parabolic 12m</SelectItem>
                <SelectItem key="Parabolic 15m">Parabolic 15m</SelectItem>
                <SelectItem key="Phased Array">Phased Array</SelectItem>
              </Select>
              <Select
                label="Frequency Band"
                selectedKeys={[newStation.frequency]}
                onChange={(e) => setNewStation({ ...newStation, frequency: e.target.value })}
              >
                <SelectItem key="Ka-band">Ka-band</SelectItem>
                <SelectItem key="Ku-band">Ku-band</SelectItem>
                <SelectItem key="C-band">C-band</SelectItem>
                <SelectItem key="X-band">X-band</SelectItem>
              </Select>
            </div>
            <Input
              type="number"
              label="Capacity (Mbps)"
              value={newStation.capacity.toString()}
              onChange={(e) => setNewStation({ ...newStation, capacity: parseInt(e.target.value) || 30 })}
            />
            <div className="flex gap-2">
              <Button color="success" onPress={handleAddStation} fullWidth>
                Add Station
              </Button>
              <Button color="default" variant="light" onPress={() => setIsAddingNew(false)} fullWidth>
                Cancel
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Stations List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        <h3 className="font-bold text-lg mb-2">All Ground Stations ({allStations.length})</h3>
        
        {/* Default Stations */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-gray-500">Default Network</h4>
          {defaultStations.map((station) => (
            <Card key={station.id} className="bg-gradient-to-r from-blue-500/10 to-purple-500/10">
              <CardBody className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{station.name}</span>
                      <Chip 
                        size="sm" 
                        color={station.status === 'online' ? 'success' : 'danger'}
                        variant="flat"
                      >
                        {station.status}
                      </Chip>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      📍 {station.location.city}, {station.location.country} 
                      <span className="ml-3">📡 {station.antennaType}</span>
                      <span className="ml-3">📶 {station.frequency}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Lat: {station.location.lat.toFixed(4)}°, Lon: {station.location.lon.toFixed(4)}° 
                      • Capacity: {station.capacity} Mbps
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        {/* Custom Stations */}
        {customStations.length > 0 && (
          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-sm text-gray-500">Your Custom Stations</h4>
            {customStations.map((station) => (
              <Card key={station.id} className="bg-gradient-to-r from-green-500/10 to-teal-500/10 border border-green-500/30">
                <CardBody className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{station.name}</span>
                        <Chip size="sm" color="secondary" variant="flat">Custom</Chip>
                        <Chip 
                          size="sm" 
                          color={station.status === 'online' ? 'success' : 'danger'}
                          variant="flat"
                        >
                          {station.status}
                        </Chip>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        📍 {station.location.city}, {station.location.country} 
                        <span className="ml-3">📡 {station.antennaType}</span>
                        <span className="ml-3">📶 {station.frequency}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Lat: {station.location.lat.toFixed(4)}°, Lon: {station.location.lon.toFixed(4)}° 
                        • Capacity: {station.capacity} Mbps
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        color={station.status === 'online' ? 'warning' : 'success'}
                        variant="flat"
                        onPress={() => toggleStationStatus(station.id)}
                      >
                        {station.status === 'online' ? 'Offline' : 'Online'}
                      </Button>
                      <Button
                        size="sm"
                        color="danger"
                        variant="light"
                        onPress={() => {
                          if (confirm(`Remove ${station.name}?`)) {
                            removeStation(station.id);
                          }
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
