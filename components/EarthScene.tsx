'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/modal';
import { Button } from '@heroui/button';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Chip } from '@heroui/chip';
import { Spinner } from '@heroui/spinner';
import { Select, SelectItem } from '@heroui/select';
import { Input } from '@heroui/input';
import { Textarea } from '@heroui/input';
import { Slider } from '@heroui/slider';
import { fetchSatelliteTLEData, calculateSatellitePosition, getSatelliteInfo, SatelliteData, SatelliteInfo, GROUND_STATIONS, latLonToVector3, isSatelliteInRange, predictSatellitePasses, getAccessibleGroundStations, PassPrediction } from '@/utils/satelliteUtils';
import { useBookingStore } from '@/store/bookingStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useGroundStationStore, CustomGroundStation } from '@/store/groundStationStore';
import { SatelliteBooking } from '@/types';
import { calculateDownlinkDataRate, getCurrentSolarActivity, getCurrentWeather, getOptimalFrequencyBand, formatDataRate, getRiskLevelColor, getCertaintyDescription, getWeatherEmoji, getWeatherDisplayName, getSolarActivityEmoji, getSolarActivityDisplayName, getSolarActivityColor, type FrequencyBand, type DetailedWeatherData, type SolarActivityData } from '@/utils/downlinkCalculations';
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

// Helper function to render star ratings
function StarRating({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  return (
    <div className="flex items-center gap-1">
      {[...Array(fullStars)].map((_, i) => (
        <span key={`full-${i}`} className="text-yellow-400">★</span>
      ))}
      {hasHalfStar && <span className="text-yellow-400">⯨</span>}
      {[...Array(emptyStars)].map((_, i) => (
        <span key={`empty-${i}`} className="text-gray-400">☆</span>
      ))}
      <span className="text-xs text-gray-500 ml-1">({rating.toFixed(1)})</span>
    </div>
  );
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
  const selectedSatelliteFilterRef = useRef<string | null>(null);

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
  const [showConnections, setShowConnections] = useState(false);
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
  
  // Satellite search and filtering
  const [satelliteSearchQuery, setSatelliteSearchQuery] = useState<string>('');
  const [filteredSatelliteName, setFilteredSatelliteName] = useState<string | null>(null);
  const [passPredictions, setPassPredictions] = useState<PassPrediction[]>([]);
  const [showPassPredictions, setShowPassPredictions] = useState(false);

  const { setGroundStations } = useBookingStore();
  const { filters, selectedSatelliteFilter, accessibleGroundStations, setSelectedSatelliteFilter, setAccessibleGroundStations, clearSatelliteFilter } = useSettingsStore();
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

    // Renderer setup with performance optimizations
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: "high-performance", // Request high-performance GPU
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio to 2 for better performance
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    // Create Earth with texture - reduced geometry for better performance
    const earthGeometry = new THREE.SphereGeometry(2, 48, 48); // Reduced from 64 to 48
    
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

    // Add enhanced atmosphere glow with multiple layers - reduced geometry for performance
    const atmosphereGeometry = new THREE.SphereGeometry(2.08, 32, 32); // Reduced from 64 to 32
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
    const outerGlowGeometry = new THREE.SphereGeometry(2.15, 32, 32); // Reduced from 64 to 32
    const outerGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x2266ff,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
    scene.add(outerGlow);

    // Create enhanced stars background with better density and visibility
    const starsGeometry = new THREE.BufferGeometry();
    const starsVertices = [];
    const starsSizes = [];
    const starsColors = [];
    
    for (let i = 0; i < 8000; i++) { // Increased to 8000 for better star field density
      const x = (Math.random() - 0.5) * 200;
      const y = (Math.random() - 0.5) * 200;
      const z = (Math.random() - 0.5) * 200;
      
      // Filter out stars that are too close to prevent square appearance
      const distance = Math.sqrt(x * x + y * y + z * z);
      if (distance < 15) continue; // Skip stars within 15 units of center
      
      starsVertices.push(x, y, z);
      
      // Variable sizes for more realistic appearance
      starsSizes.push(Math.random() * 1.2 + 0.4);
      
      // More varied color palette (white, blue-white, slight yellow tints)
      const color = new THREE.Color();
      const hue = Math.random() < 0.7 ? 0.6 : 0.15; // 70% blue-white, 30% warm white
      color.setHSL(hue, 0.05 + Math.random() * 0.15, 0.85 + Math.random() * 0.15);
      starsColors.push(color.r, color.g, color.b);
    }

    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    starsGeometry.setAttribute('size', new THREE.Float32BufferAttribute(starsSizes, 1));
    starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starsColors, 3));
    
    const starsMaterial = new THREE.PointsMaterial({
      size: 0.12, // Increased from 0.08 to make stars more visible
      vertexColors: true,
      transparent: true,
      opacity: 1.0, // Increased from 0.95 to full opacity for brighter stars
      sizeAttenuation: true,
      map: createCircleTexture(),
      blending: THREE.AdditiveBlending, // Add blending for more luminous appearance
    });
    
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
    starsRef.current = stars;

    // Satellites group - make it a child of Earth so satellites rotate with the globe for connection calculations
    const satellitesGroup = new THREE.Group();
    scene.add(satellitesGroup); // Keep satellites in world space for easier position calculations
    satellitesRef.current = satellitesGroup;

    // Ground stations group - make it a child of Earth so it rotates with the globe
    const groundStationsGroup = new THREE.Group();
    earth.add(groundStationsGroup); // Changed from scene.add to earth.add
    groundStationsRef.current = groundStationsGroup;

    // Connection lines group - keep in world space and update positions each frame
    const connectionLinesGroup = new THREE.Group();
    connectionLinesGroup.visible = showConnections; // Initialize based on state
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
        rating: cs.rating,
      }))
    ];
    setGroundStations(allGroundStations);

    // Animation loop with real-time satellite updates
    // Connection lines enabled - dynamically show connections between satellites and ground stations
    const connectionLinePool: THREE.Line[] = [];
    const MAX_CONNECTION_LINES = 50; // Allow up to 50 simultaneous connection lines
    
    // Pre-create connection lines in the pool for reuse
    for (let i = 0; i < MAX_CONNECTION_LINES; i++) {
      const lineGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(6); // 2 points * 3 coordinates
      lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.3,
        linewidth: 1,
      });
      
      const line = new THREE.Line(lineGeometry, lineMaterial);
      line.visible = false;
      connectionLinesRef.current?.add(line);
      connectionLinePool.push(line);
    }
    
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      // Earth rotation removed - user can rotate manually with mouse
      
      // Add subtle star field rotation for depth
      if (starsRef.current) {
        starsRef.current.rotation.y += 0.0001;
      }
      
      // Update satellite positions and connections
      const now = Date.now();
      if (now - lastUpdateTimeRef.current > 2000) { // Update every 2 seconds for better performance
        lastUpdateTimeRef.current = now;
        updateSatellitePositions();
      } else {
        // Update connection line endpoints every frame to follow ground stations as Earth rotates
        updateConnectionLines();
      }
      
      renderer.render(scene, camera);
    };
    
    // Update connection line positions to match ground station world positions
    const updateConnectionLines = () => {
      if (!connectionLinesRef.current || !earthRef.current) return;
      
      // Update Earth's world matrix
      earthRef.current.updateMatrixWorld(true);
      
      // Update each visible connection line
      connectionLinePool.forEach((line, index) => {
        if (!line.visible) return;
        
        // The satellite position is stored in positions[0-2]
        // The ground station position needs to be updated from world coordinates
        const positions = line.geometry.attributes.position.array as Float32Array;
        
        // Get the stored ground station reference (we'll need to add this)
        const gsId = line.userData.groundStationId;
        if (gsId) {
          const gsData = groundStationMeshesRef.current.get(gsId);
          if (gsData) {
            const gsWorldPosition = new THREE.Vector3();
            gsData.mesh.getWorldPosition(gsWorldPosition);
            
            // Update ground station endpoint
            positions[3] = gsWorldPosition.x;
            positions[4] = gsWorldPosition.y;
            positions[5] = gsWorldPosition.z;
            line.geometry.attributes.position.needsUpdate = true;
          }
        }
      });
    };
    
    const updateSatellitePositions = () => {
      if (!satellitesRef.current || satelliteDataRef.current.length === 0 || !earthRef.current) return;
      
      const currentDate = new Date();
      let connections = 0;
      
      // Hide all connection lines first
      connectionLinePool.forEach(line => {
        line.visible = false;
        line.userData.groundStationId = null;
      });
      
      // Force update world matrices before calculating positions
      earthRef.current.updateMatrixWorld(true);
      
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
            groundStationMeshesRef.current.forEach((gs, gsId) => {
              if (connections >= MAX_CONNECTION_LINES) return;
              
              // Get the world position of the ground station
              const gsWorldPosition = new THREE.Vector3();
              gs.mesh.getWorldPosition(gsWorldPosition);
              
              // Check if satellite is in range using world positions
              if (isSatelliteInRange(position, gsWorldPosition, 10)) {
                // Reuse existing line from pool
                const line = connectionLinePool[connections];
                if (line) {
                  // Update line geometry with world positions
                  const positions = line.geometry.attributes.position.array as Float32Array;
                  // Satellite position (world space)
                  positions[0] = position.x;
                  positions[1] = position.y;
                  positions[2] = position.z;
                  // Ground station position (world space)
                  positions[3] = gsWorldPosition.x;
                  positions[4] = gsWorldPosition.y;
                  positions[5] = gsWorldPosition.z;
                  line.geometry.attributes.position.needsUpdate = true;
                  line.visible = true;
                  
                  // Enhance appearance for filtered satellite connections
                  if (line.material && 'color' in line.material && 'opacity' in line.material) {
                    const isFilteredSat = sat.name === selectedSatelliteFilterRef.current;
                    (line.material as THREE.LineBasicMaterial).color.setHex(isFilteredSat ? 0xff00ff : 0x00ffff);
                    (line.material as THREE.LineBasicMaterial).opacity = isFilteredSat ? 0.6 : 0.3;
                  }
                  
                  // Store ground station ID for continuous updates
                  line.userData.groundStationId = gsId;
                  
                  connections++;
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
        const satData = satelliteDataRef.current.find(s => s.name === satelliteMesh.userData.name);
        
        if (satData) {
          const info = getSatelliteInfo(satData);
          if (info) {
            setSelectedSatellite(info);
            setIsModalOpen(true);
            console.log('Satellite clicked:', info.name, 'Modal should open');
          } else {
            console.log('No satellite info available');
          }
        } else {
          console.log('Satellite data not found for:', satelliteMesh.userData.name);
        }
      } else {
        console.log('No satellite intersected');
      }
    };

    // Mouse wheel zoom
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!cameraRef.current) return;
      
      const zoomSpeed = 0.5;
      const minZoom = 3; // Minimum distance (closer)
      const maxZoom = 20; // Maximum distance (farther)
      
      // Update camera z position based on wheel delta
      cameraRef.current.position.z += e.deltaY * 0.01 * zoomSpeed;
      
      // Clamp the zoom within bounds
      cameraRef.current.position.z = Math.max(minZoom, Math.min(maxZoom, cameraRef.current.position.z));
    };

    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('click', handleClick);
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
    renderer.domElement.style.cursor = 'grab';

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      
      renderer.dispose();
    };
  }, [setGroundStations]);

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

    // Filter satellites based on selectedSatelliteFilter
    let satellitesToDisplay: SatelliteData[];
    if (selectedSatelliteFilter) {
      // Show only the filtered satellite
      satellitesToDisplay = satellites.filter(s => s.name === selectedSatelliteFilter);
    } else {
      // Show all satellites up to maxSatelliteCount
      satellitesToDisplay = satellites.slice(0, maxSatelliteCount);
    }
    
    // Update satelliteDataRef to match displayed satellites
    satelliteDataRef.current = satellitesToDisplay;
    
    satellitesToDisplay.forEach((sat) => {
      if (!sat.satrec) return;

      const position = calculateSatellitePosition(sat.satrec);
      if (!position) return;

      // Create satellite mesh - smaller with glow effect for modern look
      // Highlight the filtered satellite with a different color
      const isFiltered = selectedSatelliteFilter === sat.name;
      const satelliteGeometry = new THREE.SphereGeometry(isFiltered ? 0.04 : 0.02, 16, 16);
      const satelliteMaterial = new THREE.MeshStandardMaterial({
        color: isFiltered ? 0xff00ff : 0x00ffff,
        emissive: isFiltered ? 0xff00ff : 0x00ffff,
        emissiveIntensity: isFiltered ? 1.2 : 0.8,
        metalness: 0.5,
        roughness: 0.2,
      });

      const satelliteMesh = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
      
      // Add glow effect with sprite
      const glowTexture = createCircleTexture();
      const spriteMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        color: isFiltered ? 0xff00ff : 0x00ffff,
        transparent: true,
        opacity: isFiltered ? 0.8 : 0.6,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(isFiltered ? 0.25 : 0.15, isFiltered ? 0.25 : 0.15, 1);
      satelliteMesh.add(sprite);
      satelliteMesh.position.set(position.x, position.y, position.z);
      satelliteMesh.userData.name = sat.name;
      
      // Store reference for real-time updates
      satelliteMeshesRef.current.set(sat.name, satelliteMesh);

      // Add orbit trail - make it more visible for filtered satellite
      const trailGeometry = new THREE.BufferGeometry();
      const trailPoints = [];
      const numPoints = isFiltered ? 100 : 50; // More trail points for filtered satellite

      for (let i = 0; i < numPoints; i++) {
        const date = new Date(Date.now() - i * 60000); // 1 minute intervals
        const pos = calculateSatellitePosition(sat.satrec, date);
        if (pos) {
          trailPoints.push(pos.x, pos.y, pos.z);
        }
      }

      trailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(trailPoints, 3));
      const trailMaterial = new THREE.LineBasicMaterial({
        color: isFiltered ? 0xff00ff : 0x00ffff,
        opacity: isFiltered ? 0.5 : 0.2,
        transparent: true,
        linewidth: 1,
      });
      const trail = new THREE.Line(trailGeometry, trailMaterial);

      satellitesRef.current?.add(satelliteMesh);
      satellitesRef.current?.add(trail);
    });
  }, [satellites, maxSatelliteCount, selectedSatelliteFilter]);

  // Update ground station visibility based on accessible ground stations
  useEffect(() => {
    if (!groundStationsRef.current) return;

    // Iterate through all ground station meshes and update their visibility and appearance
    groundStationMeshesRef.current.forEach((gsData, gsId) => {
      const isAccessible = accessibleGroundStations.includes(gsId);
      const shouldShow = !selectedSatelliteFilter || isAccessible;

      // Update visibility of the ground station and its related objects
      gsData.mesh.traverse((child) => {
        child.visible = shouldShow;
      });

      // Update material to highlight accessible stations
      if (gsData.mesh.material && 'emissiveIntensity' in gsData.mesh.material) {
        (gsData.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = isAccessible ? 1.0 : 0.6;
        if (isAccessible && selectedSatelliteFilter) {
          // Make accessible stations glow brighter
          (gsData.mesh.material as THREE.MeshStandardMaterial).color.setHex(0x00ff00);
          (gsData.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x00ff00);
        }
      }
    });
  }, [selectedSatelliteFilter, accessibleGroundStations]);

  // Automatically enable connections when a satellite is filtered
  useEffect(() => {
    selectedSatelliteFilterRef.current = selectedSatelliteFilter;
    if (selectedSatelliteFilter) {
      setShowConnections(true);
      if (connectionLinesRef.current) {
        connectionLinesRef.current.visible = true;
      }
    }
  }, [selectedSatelliteFilter]);

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
          // @ts-ignore - Dynamic inline styles required for tooltip positioning
          style={{ left: `${tooltipPosition.x + 10}px`, top: `${tooltipPosition.y + 10}px` }}
        >
          {hoveredSatellite}
        </div>
      )}

      <div className="absolute top-4 left-4 bg-black/70 text-white p-4 rounded-lg backdrop-blur-sm max-w-xs">
        <h3 className="text-lg font-bold mb-3">Thunderlink Network</h3>
        
        {/* Satellite Search Feature */}
        <div className="mb-4 space-y-2">
          <div className="relative">
            <Input
              size="sm"
              placeholder="Search satellite..."
              value={satelliteSearchQuery}
              onChange={(e) => setSatelliteSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && satelliteSearchQuery.trim()) {
                  // Find matching satellite
                  const matchingSat = satellites.find(s => 
                    s.name.toLowerCase().includes(satelliteSearchQuery.toLowerCase())
                  );
                  if (matchingSat && matchingSat.satrec) {
                    setFilteredSatelliteName(matchingSat.name);
                    setSelectedSatelliteFilter(matchingSat.name);
                    
                    // Calculate accessible ground stations
                    const accessible = getAccessibleGroundStations(matchingSat.satrec, GROUND_STATIONS, 24);
                    setAccessibleGroundStations(accessible);
                    
                    // Get detailed pass predictions
                    const predictions = predictSatellitePasses(matchingSat.satrec, GROUND_STATIONS, new Date(), 24);
                    setPassPredictions(predictions);
                    setShowPassPredictions(true);
                  }
                }
              }}
              className="w-full"
              startContent={<span className="text-gray-400">🔍</span>}
              endContent={
                satelliteSearchQuery && (
                  <button
                    onClick={() => {
                      setSatelliteSearchQuery('');
                      setFilteredSatelliteName(null);
                      clearSatelliteFilter();
                      setShowPassPredictions(false);
                      setPassPredictions([]);
                    }}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                )
              }
            />
            
            {/* Autocomplete dropdown */}
            {satelliteSearchQuery && satelliteSearchQuery.length > 2 && (
              <Card className="absolute top-full mt-1 w-full z-50 max-h-48 overflow-y-auto">
                <CardBody className="p-1">
                  {satellites
                    .filter(s => s.name.toLowerCase().includes(satelliteSearchQuery.toLowerCase()))
                    .slice(0, 10)
                    .map(sat => (
                      <button
                        key={sat.name}
                        className="w-full text-left px-3 py-2 hover:bg-primary/20 rounded text-sm"
                        onClick={() => {
                          if (sat.satrec) {
                            setSatelliteSearchQuery(sat.name);
                            setFilteredSatelliteName(sat.name);
                            setSelectedSatelliteFilter(sat.name);
                            
                            // Calculate accessible ground stations
                            const accessible = getAccessibleGroundStations(sat.satrec, GROUND_STATIONS, 24);
                            setAccessibleGroundStations(accessible);
                            
                            // Get detailed pass predictions
                            const predictions = predictSatellitePasses(sat.satrec, GROUND_STATIONS, new Date(), 24);
                            setPassPredictions(predictions);
                            setShowPassPredictions(true);
                          }
                        }}
                      >
                        <div className="font-semibold">{sat.name}</div>
                        <div className="text-xs text-gray-400">{sat.category}</div>
                      </button>
                    ))}
                </CardBody>
              </Card>
            )}
          </div>
          
          {/* Active filter display */}
          {filteredSatelliteName && (
            <Card className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30">
              <CardBody className="py-2 px-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-400">Tracking:</div>
                    <div className="font-bold text-sm truncate">{filteredSatelliteName}</div>
                    <div className="text-xs text-purple-300">
                      {accessibleGroundStations.length} stations accessible
                    </div>
                  </div>
                  <Button
                    size="sm"
                    color="primary"
                    variant="flat"
                    onPress={() => setShowPassPredictions(!showPassPredictions)}
                  >
                    {showPassPredictions ? 'Hide' : 'View'} Passes
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
        
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
              maxValue={200}
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
            Manage Ground Stations
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
                  // Also set visibility on all children
                  satellitesRef.current.traverse((child) => {
                    child.visible = newVisibility;
                  });
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
                  // Also set visibility on all children
                  groundStationsRef.current.traverse((child) => {
                    child.visible = newVisibility;
                  });
                }
              }}
              fullWidth
            >
              {showGroundStations ? 'Hide' : 'Show'} Stations
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
                <h2 className="text-2xl font-bold">Ground Station Management</h2>
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
      
      {/* Pass Predictions Modal */}
      <Modal 
        isOpen={showPassPredictions} 
        onClose={() => setShowPassPredictions(false)}
        size="3xl"
        backdrop="blur"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold">🛰️ Ground Station Passes</h2>
                <p className="text-sm text-gray-500">
                  {filteredSatelliteName} - Next 24 hours
                </p>
              </ModalHeader>
              <ModalBody>
                {passPredictions.length > 0 ? (
                  <div className="space-y-3">
                    {passPredictions.map((prediction) => {
                      // Find the full ground station data
                      const groundStationData = GROUND_STATIONS.find(gs => gs.id === prediction.groundStationId);
                      
                      return (
                        <Card 
                          key={prediction.groundStationId} 
                          className="border border-primary/30 hover:border-primary/60 transition-all cursor-pointer"
                          isPressable
                          onPress={() => {
                            if (groundStationData) {
                              setSelectedGroundStation(groundStationData);
                              
                              // Calculate which satellites are accessible from this ground station
                              const accessible: string[] = [];
                              const gsData = groundStationMeshesRef.current.get(groundStationData.id);
                              
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
                              setShowPassPredictions(false);
                              setIsBookingModalOpen(true);
                            }
                          }}
                        >
                          <CardHeader className="font-semibold flex items-center gap-2">
                            <span className="text-lg">📡</span>
                            {prediction.groundStationName}
                            <Chip size="sm" color="primary" variant="flat">
                              {prediction.passes.length} {prediction.passes.length === 1 ? 'pass' : 'passes'}
                            </Chip>
                            <span className="text-xs text-gray-400 ml-auto">Click to view station details →</span>
                          </CardHeader>
                          <CardBody className="space-y-2">
                          {prediction.passes.map((pass, index) => (
                            <Card key={index} className="bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                              <CardBody className="py-2 px-3">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <div className="text-xs text-gray-400">Start Time</div>
                                    <div className="font-mono font-semibold">
                                      {pass.startTime.toLocaleTimeString()}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {pass.startTime.toLocaleDateString()}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-400">End Time</div>
                                    <div className="font-mono font-semibold">
                                      {pass.endTime.toLocaleTimeString()}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {pass.endTime.toLocaleDateString()}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-400">Duration</div>
                                    <div className="font-bold text-green-600 dark:text-green-400">
                                      {Math.floor(pass.duration / 60)}m {Math.floor(pass.duration % 60)}s
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-400">Max Elevation</div>
                                    <div className="font-bold text-purple-600 dark:text-purple-400">
                                      {pass.maxElevation.toFixed(1)}°
                                    </div>
                                  </div>
                                </div>
                              </CardBody>
                            </Card>
                          ))}
                        </CardBody>
                      </Card>
                      );
                    })}
                  </div>
                ) : (
                  <Card>
                    <CardBody className="text-center py-8">
                      <div className="text-4xl mb-3">🔍</div>
                      <p className="text-gray-500">No passes found in the next 24 hours.</p>
                      <p className="text-sm text-gray-400 mt-2">
                        This satellite may not be visible from any ground stations during this time period.
                      </p>
                    </CardBody>
                  </Card>
                )}
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="light" onPress={onClose}>
                  Close
                </Button>
                <Button 
                  color="primary" 
                  onPress={() => {
                    // Export pass data
                    const csvData = passPredictions.map(p => 
                      p.passes.map(pass => 
                        `${p.groundStationName},${pass.startTime.toISOString()},${pass.endTime.toISOString()},${pass.duration},${pass.maxElevation}`
                      ).join('\n')
                    ).join('\n');
                    const blob = new Blob([`Ground Station,Start Time,End Time,Duration (s),Max Elevation (°)\n${csvData}`], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${filteredSatelliteName}_passes.csv`;
                    a.click();
                  }}
                >
                  Export CSV
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
  const { addBooking, placeBid, getAuctionBids } = useBookingStore();
  const [selectedSatellite, setSelectedSatellite] = useState<string>('');
  const [duration, setDuration] = useState<number>(30);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [purpose, setPurpose] = useState<string>('');
  const [bookingType, setBookingType] = useState<'instant' | 'auction'>('instant');
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [auctionDuration, setAuctionDuration] = useState<number>(24); // hours
  const [selectedFrequencyBand, setSelectedFrequencyBand] = useState<FrequencyBand>('Ka-band');
  
  // Downlink prediction (calculate when satellite and ground station are selected)
  const downlinkPrediction = selectedSatellite && selectedGroundStation ? (() => {
    const solarActivity = getCurrentSolarActivity();
    const weather = getCurrentWeather(selectedGroundStation.location.lat, selectedGroundStation.location.lon);
    // Simulate elevation angle (in production, calculate from satellite position)
    const elevationAngle = 45 + Math.random() * 30; // 45-75 degrees
    
    return calculateDownlinkDataRate(
      selectedFrequencyBand,
      elevationAngle,
      solarActivity,
      weather,
      selectedGroundStation.location.lat,
      selectedGroundStation.location.lon
    );
  })() : null;
  
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
  const minimumBid = Math.floor(price * 0.8); // Auction starts at 80% of instant price
  
  const handleBooking = () => {
    if (!selectedSatellite || !startTime || !purpose) {
      alert('Please fill in all fields');
      return;
    }
    
    const satellite = satellites.find(s => s.name === selectedSatellite);
    if (!satellite) return;
    
    const start = startTime;
    const end = new Date(start.getTime() + duration * 60000);
    
    // Find available ground stations for this satellite
    const availableStations = groundStations
      .filter((gs: { status: string; id: string }) => gs.status === 'online')
      .slice(0, 3)
      .map((gs: { status: string; id: string }) => gs.id);
    
    if (bookingType === 'auction') {
      // Create auction booking
      const auctionEnd = new Date(Date.now() + auctionDuration * 60 * 60 * 1000);
      const booking: SatelliteBooking = {
        id: `booking-${Date.now()}`,
        satelliteName: satellite.name,
        satelliteId: satellite.tleLine1.substring(2, 7).trim(),
        startTime: start,
        endTime: end,
        duration,
        price: minimumBid,
        status: 'pending',
        groundStations: availableStations,
        dataRate: '100 Mbps',
        purpose,
        isAuction: true,
        currentHighBid: minimumBid,
        auctionEndTime: auctionEnd,
      };
      
      addBooking(booking);
      alert(`Auction created! Minimum bid: $${minimumBid.toLocaleString()}\nAuction ends in ${auctionDuration} hours.`);
    } else {
      // Instant booking
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
        isAuction: false,
      };
      
      addBooking(booking);
      alert(`Booking confirmed! Total: $${price.toLocaleString()}`);
    }
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
              {selectedGroundStation.rating && (
                <div className="col-span-2">
                  <div className="text-gray-400 mb-1">Rating</div>
                  <StarRating rating={selectedGroundStation.rating} />
                </div>
              )}
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
      
      {/* Downlink Data Rate Prediction */}
      {selectedSatellite && selectedGroundStation && downlinkPrediction && (
        <Card className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-2 border-cyan-500/30">
          <CardHeader className="font-semibold flex items-center gap-2">
            <span className="text-xl">📡</span>
            Projected Downlink Performance
            <Chip 
              size="sm" 
              color={getRiskLevelColor(downlinkPrediction.riskLevel) as any}
              variant="flat"
              className="ml-auto"
            >
              {downlinkPrediction.riskLevel.toUpperCase()} RISK
            </Chip>
          </CardHeader>
          <CardBody className="space-y-4">
            {/* Frequency Band Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Frequency Band</label>
              <Select
                selectedKeys={[selectedFrequencyBand]}
                onChange={(e) => setSelectedFrequencyBand(e.target.value as FrequencyBand)}
                size="sm"
              >
                <SelectItem key="Ka-band">Ka-band (26.5-40 GHz) - High Speed</SelectItem>
                <SelectItem key="Ku-band">Ku-band (12-18 GHz) - Balanced</SelectItem>
                <SelectItem key="X-band">X-band (8-12 GHz) - Reliable</SelectItem>
                <SelectItem key="C-band">C-band (4-8 GHz) - Weather Resistant</SelectItem>
                <SelectItem key="S-band">S-band (2-4 GHz) - Robust</SelectItem>
                <SelectItem key="L-band">L-band (1-2 GHz) - Most Stable</SelectItem>
              </Select>
            </div>

            {/* Data Rate Display */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <div className="text-xs text-gray-400">Ideal Conditions</div>
                <div className="font-bold text-xl text-blue-400">
                  {formatDataRate(downlinkPrediction.baseDataRate)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Maximum possible</div>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                <div className="text-xs text-gray-400">Projected Rate</div>
                <div className="font-bold text-xl text-green-400">
                  {formatDataRate(downlinkPrediction.adjustedDataRate)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {Math.round((downlinkPrediction.adjustedDataRate / downlinkPrediction.baseDataRate) * 100)}% of ideal
                </div>
              </div>
            </div>

            {/* Certainty Factor */}
            <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Prediction Certainty</span>
                <Chip size="sm" variant="flat" color="secondary">
                  {getCertaintyDescription(downlinkPrediction.certaintyFactor)}
                </Chip>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-500"
                  style={{ width: `${downlinkPrediction.certaintyFactor * 100}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {(downlinkPrediction.certaintyFactor * 100).toFixed(1)}% confidence in prediction
              </div>
            </div>

            {/* Environmental Factors */}
            <div>
              <div className="text-sm font-semibold mb-2">Environmental Impact Factors</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between p-2 bg-default-100 rounded">
                  <span>☀️ Solar Activity</span>
                  <span className={`font-bold ${
                    downlinkPrediction.degradationFactors.solar > 0.9 ? 'text-green-400' :
                    downlinkPrediction.degradationFactors.solar > 0.7 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {(downlinkPrediction.degradationFactors.solar * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-default-100 rounded">
                  <span>🌧️ Weather</span>
                  <span className={`font-bold ${
                    downlinkPrediction.degradationFactors.weather > 0.9 ? 'text-green-400' :
                    downlinkPrediction.degradationFactors.weather > 0.7 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {(downlinkPrediction.degradationFactors.weather * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-default-100 rounded">
                  <span>🌍 Atmospheric</span>
                  <span className={`font-bold ${
                    downlinkPrediction.degradationFactors.atmospheric > 0.9 ? 'text-green-400' :
                    downlinkPrediction.degradationFactors.atmospheric > 0.7 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {(downlinkPrediction.degradationFactors.atmospheric * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-default-100 rounded">
                  <span>📐 Elevation</span>
                  <span className={`font-bold ${
                    downlinkPrediction.degradationFactors.elevation > 0.9 ? 'text-green-400' :
                    downlinkPrediction.degradationFactors.elevation > 0.7 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {(downlinkPrediction.degradationFactors.elevation * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Detailed Weather Conditions */}
            <Card className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30">
              <CardHeader className="font-semibold flex items-center gap-2">
                {getWeatherEmoji(downlinkPrediction.weatherData.condition)}
                <span>Current Weather Conditions</span>
                <Chip size="sm" variant="flat" color={
                  downlinkPrediction.weatherData.condition === 'clear' || downlinkPrediction.weatherData.condition === 'partly-cloudy' ? 'success' :
                  downlinkPrediction.weatherData.condition === 'overcast' ? 'warning' : 'danger'
                }>
                  {getWeatherDisplayName(downlinkPrediction.weatherData.condition)}
                </Chip>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2 bg-default-50 rounded">
                    <div className="text-gray-500 mb-1">Cloud Coverage</div>
                    <div className="font-bold text-lg">
                      {downlinkPrediction.weatherData.cloudCoverage.toFixed(0)}%
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                      <div 
                        className="bg-blue-400 h-full rounded-full"
                        style={{ width: `${downlinkPrediction.weatherData.cloudCoverage}%` }}
                      />
                    </div>
                  </div>
                  <div className="p-2 bg-default-50 rounded">
                    <div className="text-gray-500 mb-1">Temperature</div>
                    <div className="font-bold text-lg">
                      {downlinkPrediction.weatherData.temperature.toFixed(1)}°C
                    </div>
                    <div className="text-gray-400 text-xs">
                      {(downlinkPrediction.weatherData.temperature * 9/5 + 32).toFixed(1)}°F
                    </div>
                  </div>
                  <div className="p-2 bg-default-50 rounded">
                    <div className="text-gray-500 mb-1">Precipitation</div>
                    <div className="font-bold text-lg">
                      {downlinkPrediction.weatherData.precipitationRate.toFixed(1)} mm/hr
                    </div>
                    <div className={`text-xs ${
                      downlinkPrediction.weatherData.precipitationRate === 0 ? 'text-green-400' :
                      downlinkPrediction.weatherData.precipitationRate < 5 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {downlinkPrediction.weatherData.precipitationRate === 0 ? 'None' :
                       downlinkPrediction.weatherData.precipitationRate < 5 ? 'Light' : 'Heavy'}
                    </div>
                  </div>
                  <div className="p-2 bg-default-50 rounded">
                    <div className="text-gray-500 mb-1">Humidity</div>
                    <div className="font-bold text-lg">
                      {downlinkPrediction.weatherData.humidity.toFixed(0)}%
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                      <div 
                        className="bg-cyan-400 h-full rounded-full"
                        style={{ width: `${downlinkPrediction.weatherData.humidity}%` }}
                      />
                    </div>
                  </div>
                  <div className="p-2 bg-default-50 rounded">
                    <div className="text-gray-500 mb-1">Visibility</div>
                    <div className="font-bold text-lg">
                      {downlinkPrediction.weatherData.visibility.toFixed(1)} km
                    </div>
                    <div className={`text-xs ${
                      downlinkPrediction.weatherData.visibility > 10 ? 'text-green-400' :
                      downlinkPrediction.weatherData.visibility > 5 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {downlinkPrediction.weatherData.visibility > 10 ? 'Excellent' :
                       downlinkPrediction.weatherData.visibility > 5 ? 'Good' : 'Poor'}
                    </div>
                  </div>
                  <div className="p-2 bg-default-50 rounded">
                    <div className="text-gray-500 mb-1">Wind Speed</div>
                    <div className="font-bold text-lg">
                      {downlinkPrediction.weatherData.windSpeed.toFixed(0)} km/h
                    </div>
                    <div className="text-gray-400 text-xs">
                      {(downlinkPrediction.weatherData.windSpeed * 0.621371).toFixed(0)} mph
                    </div>
                  </div>
                  <div className="p-2 bg-default-50 rounded col-span-2">
                    <div className="text-gray-500 mb-1">Atmospheric Pressure</div>
                    <div className="font-bold text-lg">
                      {downlinkPrediction.weatherData.atmosphericPressure.toFixed(1)} hPa
                    </div>
                    <div className="text-gray-400 text-xs">
                      {(downlinkPrediction.weatherData.atmosphericPressure * 0.02953).toFixed(2)} inHg
                    </div>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-blue-500/10 rounded text-xs text-blue-300">
                  💡 Weather conditions directly affect signal quality, especially for high-frequency bands like Ka and Ku.
                </div>
              </CardBody>
            </Card>

            {/* Solar Activity Details */}
            <Card className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30">
              <CardHeader className="font-semibold flex items-center gap-2">
                {getSolarActivityEmoji(downlinkPrediction.solarData.level)}
                <span>Solar Activity & Ionosphere</span>
                <Chip 
                  size="sm" 
                  variant="flat" 
                  color={getSolarActivityColor(downlinkPrediction.solarData.level) as any}
                >
                  {getSolarActivityDisplayName(downlinkPrediction.solarData.level)}
                </Chip>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2 bg-default-50 rounded">
                    <div className="text-gray-500 mb-1">Solar Flux Index</div>
                    <div className="font-bold text-lg">
                      {downlinkPrediction.solarData.solarFluxIndex.toFixed(0)} SFU
                    </div>
                    <div className={`text-xs ${
                      downlinkPrediction.solarData.solarFluxIndex < 100 ? 'text-green-400' :
                      downlinkPrediction.solarData.solarFluxIndex < 150 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {downlinkPrediction.solarData.solarFluxIndex < 100 ? 'Low' :
                       downlinkPrediction.solarData.solarFluxIndex < 150 ? 'Moderate' : 'High'}
                    </div>
                  </div>
                  <div className="p-2 bg-default-50 rounded">
                    <div className="text-gray-500 mb-1">Geomagnetic (Kp)</div>
                    <div className="font-bold text-lg">
                      {downlinkPrediction.solarData.geomagneticIndex.toFixed(1)}
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                      <div 
                        className={`h-full rounded-full ${
                          downlinkPrediction.solarData.geomagneticIndex < 3 ? 'bg-green-400' :
                          downlinkPrediction.solarData.geomagneticIndex < 6 ? 'bg-yellow-400' :
                          'bg-red-400'
                        }`}
                        style={{ width: `${(downlinkPrediction.solarData.geomagneticIndex / 9) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="p-2 bg-default-50 rounded">
                    <div className="text-gray-500 mb-1">Solar Wind</div>
                    <div className="font-bold text-lg">
                      {downlinkPrediction.solarData.solarWindSpeed.toFixed(0)} km/s
                    </div>
                    <div className={`text-xs ${
                      downlinkPrediction.solarData.solarWindSpeed < 400 ? 'text-green-400' :
                      downlinkPrediction.solarData.solarWindSpeed < 600 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {downlinkPrediction.solarData.solarWindSpeed < 400 ? 'Calm' :
                       downlinkPrediction.solarData.solarWindSpeed < 600 ? 'Elevated' : 'Storm'}
                    </div>
                  </div>
                  <div className="p-2 bg-default-50 rounded">
                    <div className="text-gray-500 mb-1">X-Ray Flux</div>
                    <div className="font-bold text-lg">
                      {downlinkPrediction.solarData.xRayFlux}
                    </div>
                    <div className="text-gray-400 text-xs">
                      {downlinkPrediction.solarData.xRayFlux.startsWith('B') ? 'Background' :
                       downlinkPrediction.solarData.xRayFlux.startsWith('C') ? 'Minor' :
                       downlinkPrediction.solarData.xRayFlux.startsWith('M') ? 'Moderate' : 'Major'}
                    </div>
                  </div>
                  <div className="p-2 bg-default-50 rounded col-span-2">
                    <div className="text-gray-500 mb-1">Proton Flux</div>
                    <div className="font-bold text-lg">
                      {downlinkPrediction.solarData.protonFlux.toFixed(1)} p/cm²/s/sr
                    </div>
                    <div className={`text-xs ${
                      downlinkPrediction.solarData.protonFlux < 10 ? 'text-green-400' :
                      downlinkPrediction.solarData.protonFlux < 100 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {downlinkPrediction.solarData.protonFlux < 10 ? 'Normal' :
                       downlinkPrediction.solarData.protonFlux < 100 ? 'Elevated' : 'Event in progress'}
                    </div>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-orange-500/10 rounded text-xs text-orange-300">
                  ☀️ Solar activity affects lower frequency bands (L, S, C) more than higher frequencies (Ka, Ku, X).
                </div>
              </CardBody>
            </Card>

            {/* Optimal Transmission Windows */}
            <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30">
              <CardHeader className="font-semibold flex items-center gap-2">
                <span className="text-xl">⏰</span>
                <span>Transmission Window Forecast</span>
                <Chip size="sm" variant="flat" color="success">
                  Next 6 Hours
                </Chip>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="text-xs text-gray-400 mb-2">
                  Predicted optimal time windows for data transmission based on forecasted conditions
                </div>
                
                {/* Generate simulated forecast windows */}
                {[0, 2, 4].map((hoursAhead) => {
                  const futureTime = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
                  const timeString = futureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  
                  // Simulate conditions improving/degrading over time
                  const qualityScore = 0.6 + (Math.random() * 0.3);
                  const estimatedRate = downlinkPrediction.baseDataRate * qualityScore;
                  
                  return (
                    <div key={hoursAhead} className="p-3 bg-default-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-bold">{timeString}</div>
                          <div className="text-xs text-gray-500">
                            {hoursAhead === 0 ? 'Now' : `+${hoursAhead}h`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-400">
                            {formatDataRate(estimatedRate)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {(qualityScore * 100).toFixed(0)}% efficiency
                          </div>
                        </div>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            qualityScore > 0.8 ? 'bg-green-400' :
                            qualityScore > 0.65 ? 'bg-yellow-400' :
                            'bg-orange-400'
                          }`}
                          style={{ width: `${qualityScore * 100}%` }}
                        />
                      </div>
                      <div className="mt-2 flex gap-2 text-xs">
                        <Chip size="sm" variant="flat" color={qualityScore > 0.8 ? 'success' : qualityScore > 0.65 ? 'warning' : 'default'}>
                          {qualityScore > 0.8 ? '✅ Optimal' : qualityScore > 0.65 ? '⚠️ Good' : '❌ Fair'}
                        </Chip>
                        {hoursAhead === 0 && qualityScore > 0.75 && (
                          <Chip size="sm" variant="flat" color="success">
                            🚀 Recommended Now
                          </Chip>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                <div className="p-3 bg-green-500/10 rounded-lg text-xs">
                  <div className="font-semibold mb-1">💡 Recommendation</div>
                  <p className="text-green-300">
                    Based on current forecasts, the best transmission window is expected 
                    {downlinkPrediction.certaintyFactor > 0.7 ? ' now' : ' in approximately 2 hours'} 
                    when atmospheric conditions are most favorable.
                  </p>
                </div>
              </CardBody>
            </Card>

            {/* Recommendations */}
            {downlinkPrediction.recommendations.length > 0 && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="text-sm font-semibold mb-2">💡 Recommendations</div>
                <ul className="space-y-1">
                  {downlinkPrediction.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-xs text-gray-300">
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quick Band Comparison */}
            <Button
              size="sm"
              variant="flat"
              color="secondary"
              fullWidth
              onPress={() => {
                const optimal = getOptimalFrequencyBand(
                  45 + Math.random() * 30,
                  getCurrentSolarActivity(),
                  getCurrentWeather(selectedGroundStation.location.lat, selectedGroundStation.location.lon),
                  selectedGroundStation.location.lat,
                  selectedGroundStation.location.lon
                );
                setSelectedFrequencyBand(optimal.band);
                alert(`Recommended: ${optimal.band}\nProjected Rate: ${formatDataRate(optimal.prediction.adjustedDataRate)}\nCertainty: ${(optimal.prediction.certaintyFactor * 100).toFixed(1)}%`);
              }}
            >
              🔍 Find Optimal Frequency Band
            </Button>
          </CardBody>
        </Card>
      )}
      
      {/* Time Selection */}
      <Card>
        <CardHeader className="font-semibold">Schedule</CardHeader>
        <CardBody className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Start Time</label>
            <DatePicker
              selected={startTime}
              onChange={(date: Date | null) => setStartTime(date)}
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              dateFormat="MMMM d, yyyy h:mm aa"
              minDate={new Date()}
              placeholderText="Select start date and time"
              className="w-full px-3 py-2 bg-default-100 border border-default-200 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              wrapperClassName="w-full"
              popperClassName="!z-[9999]"
            />
          </div>
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
      
      {/* Booking Type Selection */}
      <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30">
        <CardHeader className="font-semibold">💰 Booking Method</CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card 
              isPressable
              onPress={() => setBookingType('instant')}
              className={`cursor-pointer transition-all ${
                bookingType === 'instant' 
                  ? 'bg-primary/20 border-2 border-primary' 
                  : 'bg-default-100 border-2 border-transparent'
              }`}
            >
              <CardBody className="text-center py-4">
                <div className="text-2xl mb-2">⚡</div>
                <div className="font-bold">Instant Booking</div>
                <div className="text-xs text-gray-500 mt-1">Pay now, book immediately</div>
                {selectedSatellite && (
                  <div className="text-lg font-bold text-primary mt-2">
                    ${price.toLocaleString()}
                  </div>
                )}
              </CardBody>
            </Card>
            
            <Card 
              isPressable
              onPress={() => setBookingType('auction')}
              className={`cursor-pointer transition-all ${
                bookingType === 'auction' 
                  ? 'bg-secondary/20 border-2 border-secondary' 
                  : 'bg-default-100 border-2 border-transparent'
              }`}
            >
              <CardBody className="text-center py-4">
                <div className="text-2xl mb-2">🔨</div>
                <div className="font-bold">Auction</div>
                <div className="text-xs text-gray-500 mt-1">Bid for the best price</div>
                {selectedSatellite && (
                  <div className="text-lg font-bold text-secondary mt-2">
                    ${minimumBid.toLocaleString()}+
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
          
          {bookingType === 'auction' && selectedSatellite && (
            <div className="space-y-3 animate-fade-in">
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <h4 className="font-semibold mb-2 text-sm">🔨 How Auctions Work</h4>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• Set your maximum bid amount</li>
                  <li>• System automatically bids for you up to your max</li>
                  <li>• You're notified if outbid</li>
                  <li>• Winner pays their final bid amount</li>
                  <li>• Save up to 50% vs instant booking!</li>
                </ul>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Auction Duration: {auctionDuration} hours
                </label>
                <Slider
                  step={6}
                  minValue={6}
                  maxValue={72}
                  value={auctionDuration}
                  onChange={(value: number | number[]) => setAuctionDuration(value as number)}
                  className="max-w-full"
                  color="secondary"
                  marks={[
                    { value: 6, label: '6h' },
                    { value: 24, label: '24h' },
                    { value: 48, label: '48h' },
                    { value: 72, label: '72h' },
                  ]}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <div className="text-gray-400">Minimum Bid</div>
                  <div className="font-bold text-green-400">${minimumBid.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Starting price</div>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <div className="text-gray-400">Instant Price</div>
                  <div className="font-bold text-blue-400">${price.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Skip the wait</div>
                </div>
              </div>
              
              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <div className="text-sm font-semibold mb-1">💡 Pro Tip</div>
                <p className="text-xs text-gray-400">
                  Auctions ending at off-peak hours typically have lower winning bids. 
                  Consider scheduling your auction to end at night or early morning!
                </p>
              </div>
            </div>
          )}
          
          {bookingType === 'instant' && selectedSatellite && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg animate-fade-in">
              <h4 className="font-semibold mb-1 text-sm">⚡ Instant Booking Benefits</h4>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Immediate confirmation</li>
                <li>• Guaranteed time slot</li>
                <li>• No waiting for auction to end</li>
                <li>• Perfect for urgent missions</li>
              </ul>
            </div>
          )}
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
        <Card className={bookingType === 'auction' ? 'border-2 border-secondary' : 'border-2 border-primary'}>
          <CardHeader className="font-semibold flex items-center gap-2">
            {bookingType === 'auction' ? '🔨 Auction Summary' : '💳 Price Summary'}
          </CardHeader>
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
              {bookingType === 'auction' && (
                <>
                  <div className="flex justify-between text-sm">
                    <span>Auction Duration:</span>
                    <span>{auctionDuration} hours</span>
                  </div>
                  <div className="border-t border-gray-600 pt-2 mt-2"></div>
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Instant Price:</span>
                    <span className="line-through">${price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Starting Bid:</span>
                    <span className="text-secondary">${minimumBid.toLocaleString()}</span>
                  </div>
                  <div className="p-3 bg-green-500/10 rounded-lg mt-2">
                    <div className="text-sm font-semibold text-green-400">
                      Potential Savings: ${(price - minimumBid).toLocaleString()} ({Math.round(((price - minimumBid) / price) * 100)}%)
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Average winning bid is {Math.round(minimumBid / price * 100 + 10)}% of instant price
                    </div>
                  </div>
                </>
              )}
              {bookingType === 'instant' && (
                <>
                  <div className="border-t border-gray-600 pt-2 mt-2"></div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-green-400">${price.toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
            <Button 
              color={bookingType === 'auction' ? 'secondary' : 'primary'}
              size="lg"
              fullWidth
              className="mt-4"
              onPress={handleBooking}
              isDisabled={!selectedSatellite || !startTime || !purpose}
            >
              {bookingType === 'auction' ? '🔨 Create Auction' : '⚡ Confirm Instant Booking'}
            </Button>
            {bookingType === 'instant' && (
              <Button 
                color="default"
                variant="flat"
                size="sm"
                fullWidth
                className="mt-2"
                onPress={() => setBookingType('auction')}
              >
                Or try an auction to save up to 50%
              </Button>
            )}
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
    rating: 4.0,
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
      rating: newStation.rating,
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
      rating: 4.0,
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
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                label="Capacity (Mbps)"
                value={newStation.capacity.toString()}
                onChange={(e) => setNewStation({ ...newStation, capacity: parseInt(e.target.value) || 30 })}
              />
              <div className="space-y-1">
                <label className="text-sm">Rating: {newStation.rating.toFixed(1)} ⭐</label>
                <Slider
                  size="sm"
                  step={0.1}
                  minValue={1}
                  maxValue={5}
                  value={newStation.rating}
                  onChange={(value: number | number[]) => setNewStation({ ...newStation, rating: value as number })}
                  className="max-w-full"
                  color="warning"
                />
              </div>
            </div>
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
                    {station.rating && (
                      <div className="mt-2">
                        <StarRating rating={station.rating} />
                      </div>
                    )}
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
                      {station.rating && (
                        <div className="mt-2">
                          <StarRating rating={station.rating} />
                        </div>
                      )}
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
