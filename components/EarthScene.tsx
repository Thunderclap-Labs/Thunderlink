'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/modal';
import { Button } from '@heroui/button';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Chip } from '@heroui/chip';
import { Spinner } from '@heroui/spinner';
import { fetchSatelliteTLEData, calculateSatellitePosition, getSatelliteInfo, SatelliteData, SatelliteInfo } from '@/utils/satelliteUtils';
import styles from './EarthScene.module.css';

export default function EarthScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const earthRef = useRef<THREE.Mesh | null>(null);
  const satellitesRef = useRef<THREE.Group | null>(null);
  const satelliteDataRef = useRef<SatelliteData[]>([]);
  const satelliteMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
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
  const [loading, setLoading] = useState(true);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

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
      
      satelliteDataRef.current.forEach((sat) => {
        if (!sat.satrec) return;
        
        const position = calculateSatellitePosition(sat.satrec, currentDate);
        if (!position) return;
        
        const satelliteMesh = satelliteMeshesRef.current.get(sat.name);
        if (satelliteMesh) {
          satelliteMesh.position.set(position.x, position.y, position.z);
        }
      });
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
  }, []);

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

    // Add satellites to scene
    satellites.forEach((sat) => {
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
  }, [satellites]);

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
          style={{
            left: `${tooltipPosition.x + 10}px`,
            top: `${tooltipPosition.y + 10}px`,
          }}
        >
          {hoveredSatellite}
        </div>
      )}

      <div className="absolute top-4 left-4 bg-black/70 text-white p-4 rounded-lg backdrop-blur-sm">
        <h3 className="text-lg font-bold mb-2">Satellite Tracker</h3>
        <p className="text-sm">Satellites: {satellites.length}</p>
        <p className="text-xs text-gray-400 mt-2">
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
                <Button color="primary" onPress={onClose}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
