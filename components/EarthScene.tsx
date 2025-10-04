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
import { SatelliteBooking } from '@/types';
import styles from './EarthScene.module.css';

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
    raycasterRef.current.params.Points = { threshold: 0.1 };
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
  const [maxSatelliteCount, setMaxSatelliteCount] = useState<number>(30);

  const { setGroundStations } = useBookingStore();

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000510);
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

    // Add atmosphere glow
    const atmosphereGeometry = new THREE.SphereGeometry(2.1, 64, 64);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide,
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphere);

    // Create enhanced stars background
    const starsGeometry = new THREE.BufferGeometry();
    const starsVertices = [];
    const starsSizes = [];
    const starsColors = [];
    
    for (let i = 0; i < 10000; i++) {
      const x = (Math.random() - 0.5) * 200;
      const y = (Math.random() - 0.5) * 200;
      const z = (Math.random() - 0.5) * 200;
      starsVertices.push(x, y, z);
      
      // Random star sizes for variety
      starsSizes.push(Math.random() * 2 + 0.5);
      
      // Slight color variations (white to light blue)
      const color = new THREE.Color();
      color.setHSL(0.6, 0.1 + Math.random() * 0.2, 0.8 + Math.random() * 0.2);
      starsColors.push(color.r, color.g, color.b);
    }

    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    starsGeometry.setAttribute('size', new THREE.Float32BufferAttribute(starsSizes, 1));
    starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starsColors, 3));
    
    const starsMaterial = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    });
    
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

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
      
      // Create ground station marker (antenna tower)
      const towerGeometry = new THREE.ConeGeometry(0.03, 0.1, 8);
      const towerMaterial = new THREE.MeshPhongMaterial({
        color: gs.status === 'online' ? 0x00ff00 : 0xff0000,
        emissive: gs.status === 'online' ? 0x00aa00 : 0xaa0000,
        emissiveIntensity: 0.5,
      });
      const tower = new THREE.Mesh(towerGeometry, towerMaterial);
      tower.position.set(position.x, position.y, position.z);
      
      // Point tower upward from Earth's center
      tower.lookAt(position.x * 2, position.y * 2, position.z * 2);
      tower.rotateX(Math.PI / 2);
      
      tower.userData.groundStation = gs;
      
      // Add base platform
      const platformGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.01, 16);
      const platformMaterial = new THREE.MeshPhongMaterial({
        color: 0x444444,
      });
      const platform = new THREE.Mesh(platformGeometry, platformMaterial);
      platform.position.set(position.x, position.y, position.z);
      platform.lookAt(position.x * 2, position.y * 2, position.z * 2);
      platform.rotateX(Math.PI / 2);
      
      groundStationsGroup.add(tower);
      groundStationsGroup.add(platform);
      
      // Store ground station position for connection calculations
      groundStationMeshesRef.current.set(gs.id, {
        position: new THREE.Vector3(position.x, position.y, position.z),
        mesh: tower,
      });
    });

    // Initialize ground stations in store
    setGroundStations(GROUND_STATIONS);

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
                    opacity: 0.3,
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
      setSatellites(sats);
      satelliteDataRef.current = sats;
      setLoading(false);
    };

    loadSatellites();
  }, []);

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

      // Create satellite mesh - larger for easier clicking
      const satelliteGeometry = new THREE.SphereGeometry(0.04, 12, 12);
      const satelliteMaterial = new THREE.MeshBasicMaterial({
        color: 0xff4444,
      });

      const satelliteMesh = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
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
        color: 0xff4444,
        opacity: 0.3,
        transparent: true,
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
              maxValue={50}
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
          <div className="flex gap-2">
            <Button 
              size="sm" 
              color={showSatellites ? 'primary' : 'default'}
              onPress={() => {
                setShowSatellites(!showSatellites);
                if (satellitesRef.current) {
                  satellitesRef.current.visible = !showSatellites;
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
                setShowGroundStations(!showGroundStations);
                if (groundStationsRef.current) {
                  groundStationsRef.current.visible = !showGroundStations;
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
          Drag to rotate • Click satellite for info
        </p>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
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
                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="font-semibold">Position</CardHeader>
                      <CardBody>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Latitude:</span>
                            <span className="ml-2 font-mono">
                              {selectedSatellite.position.lat.toFixed(2)}°
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Longitude:</span>
                            <span className="ml-2 font-mono">
                              {selectedSatellite.position.lon.toFixed(2)}°
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-gray-500">Altitude:</span>
                            <span className="ml-2 font-mono">
                              {selectedSatellite.position.alt.toFixed(2)} km
                            </span>
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    <Card>
                      <CardHeader className="font-semibold">Orbital Data</CardHeader>
                      <CardBody>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Velocity:</span>
                            <span className="ml-2 font-mono">
                              {selectedSatellite.velocity.toFixed(2)} km/s
                            </span>
                          </div>
                          {selectedSatellite.period && (
                            <div>
                              <span className="text-gray-500">Period:</span>
                              <span className="ml-2 font-mono">
                                {selectedSatellite.period.toFixed(0)} min
                              </span>
                            </div>
                          )}
                          {selectedSatellite.noradId && (
                            <div className="col-span-2">
                              <span className="text-gray-500">NORAD ID:</span>
                              <span className="ml-2 font-mono">
                                {selectedSatellite.noradId}
                              </span>
                            </div>
                          )}
                        </div>
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
        onClose={() => setIsBookingModalOpen(false)}
        size="2xl"
        backdrop="blur"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold">Book Satellite Time</h2>
                <p className="text-sm text-gray-500">Select a satellite and time slot to get started</p>
              </ModalHeader>
              <ModalBody>
                <BookingSatelliteSelector 
                  satellites={satellites}
                  groundStations={GROUND_STATIONS}
                  onClose={onClose}
                />
              </ModalBody>
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
  onClose: () => void;
}

function BookingSatelliteSelector({ satellites, groundStations, onClose }: BookingSelectorProps) {
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
