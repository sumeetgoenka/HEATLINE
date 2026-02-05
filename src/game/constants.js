import * as THREE from 'three';

export const CONFIG = {
  citySize: 820,
  blockSize: 70,
  roadWidth: 16,
  laneOffset: 3.4,
  buildingMin: 12,
  buildingMax: 26,
  buildingHeightMin: 12,
  buildingHeightMax: 80,
  trafficCount: 24,
  pedestrianCount: 36,
  policePerStar: 2,
  maxHeat: 100,
  heatDecay: 7,
  playerWalk: 7,
  playerSprint: 12,
  playerAccel: 18,
  vehicleTurn: 1.2,
  vehicleAccel: 18,
  vehicleMax: 38
};

export const LOCATIONS = {
  hideout: new THREE.Vector3(-260, 0, 200),
  arcade: new THREE.Vector3(-140, 0, -70),
  harbor: new THREE.Vector3(260, 0, 190),
  foundry: new THREE.Vector3(210, 0, -220),
  garage: new THREE.Vector3(-260, 0, -220),
  checkpoint1: new THREE.Vector3(40, 0, 260),
  checkpoint2: new THREE.Vector3(260, 0, 40),
  checkpoint3: new THREE.Vector3(-40, 0, -260),
  finish: new THREE.Vector3(0, 0, 300)
};

export const DISTRICTS = [
  { name: 'Civic Core', minX: -120, maxX: 120, minZ: -120, maxZ: 120, heat: 1.2 },
  { name: 'Harbor Line', minX: 0, maxX: 420, minZ: 0, maxZ: 420, heat: 0.9 },
  { name: 'Foundry', minX: 0, maxX: 420, minZ: -420, maxZ: 0, heat: 1.1 },
  { name: 'Backlot', minX: -420, maxX: 0, minZ: 0, maxZ: 420, heat: 0.95 },
  { name: 'Old Grid', minX: -420, maxX: 0, minZ: -420, maxZ: 0, heat: 1.0 }
];
