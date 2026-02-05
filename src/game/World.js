import * as THREE from 'three';
import { CONFIG } from './constants';
import { clamp, randBetween, snap } from './math';

export class World {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.buildingBounds = [];
    this.roadNodes = [];
    this.streetLights = [];
    this.size = CONFIG.citySize;
    this.build();
  }

  build() {
    const half = this.size / 2;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(this.size, this.size),
      new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1c1f26, roughness: 0.6 });
    const roadGeoVertical = new THREE.BoxGeometry(CONFIG.roadWidth, 0.2, this.size);
    const roadGeoHorizontal = new THREE.BoxGeometry(this.size, 0.2, CONFIG.roadWidth);

    for (let x = -half; x <= half; x += CONFIG.blockSize) {
      const road = new THREE.Mesh(roadGeoVertical, roadMat);
      road.position.set(x, 0.05, 0);
      this.group.add(road);
    }

    for (let z = -half; z <= half; z += CONFIG.blockSize) {
      const road = new THREE.Mesh(roadGeoHorizontal, roadMat);
      road.position.set(0, 0.05, z);
      this.group.add(road);
    }

    for (let x = -half; x <= half; x += CONFIG.blockSize) {
      for (let z = -half; z <= half; z += CONFIG.blockSize) {
        this.roadNodes.push(new THREE.Vector3(x, 0, z));
      }
    }

    const blockHalf = (CONFIG.blockSize - CONFIG.roadWidth) / 2;
    for (let gx = -half + CONFIG.blockSize / 2; gx < half; gx += CONFIG.blockSize) {
      for (let gz = -half + CONFIG.blockSize / 2; gz < half; gz += CONFIG.blockSize) {
        const buildingCount = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < buildingCount; i += 1) {
          const width = randBetween(CONFIG.buildingMin, Math.min(CONFIG.buildingMax, blockHalf * 1.8));
          const depth = randBetween(CONFIG.buildingMin, Math.min(CONFIG.buildingMax, blockHalf * 1.8));
          const height = randBetween(CONFIG.buildingHeightMin, CONFIG.buildingHeightMax);
          const x = gx + randBetween(-blockHalf + width / 2, blockHalf - width / 2);
          const z = gz + randBetween(-blockHalf + depth / 2, blockHalf - depth / 2);
          const hue = randBetween(0.55, 0.75);
          const color = new THREE.Color().setHSL(hue, 0.25, randBetween(0.35, 0.55));

          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, depth),
            new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 })
          );
          mesh.position.set(x, height / 2, z);
          this.group.add(mesh);

          this.buildingBounds.push({
            minX: x - width / 2,
            maxX: x + width / 2,
            minZ: z - depth / 2,
            maxZ: z + depth / 2,
            height
          });
        }
      }
    }

    this.addLandmark(new THREE.Vector3(0, 0, 0), 110, 40, 0x3d4a6b);
    this.addLandmark(new THREE.Vector3(220, 0, -80), 70, 28, 0x485b6f);
    this.addLandmark(new THREE.Vector3(-220, 0, 100), 80, 30, 0x384255);

    this.addStreetLights();
  }

  addLandmark(position, height, width, color) {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, width),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
    );
    base.position.set(position.x, height / 2, position.z);
    this.group.add(base);
    this.buildingBounds.push({
      minX: position.x - width / 2,
      maxX: position.x + width / 2,
      minZ: position.z - width / 2,
      maxZ: position.z + width / 2,
      height
    });
  }

  addStreetLights() {
    const half = this.size / 2;
    const spacing = CONFIG.blockSize * 1.1;
    for (let x = -half; x <= half; x += spacing) {
      for (let z = -half; z <= half; z += spacing) {
        if ((Math.abs(x) + Math.abs(z)) % (spacing * 2) !== 0) {
          continue;
        }
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.2, 6, 8),
          new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 })
        );
        pole.position.set(x, 3, z);
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 10, 10),
          new THREE.MeshStandardMaterial({ color: 0xfff1c2, emissive: 0x000000 })
        );
        bulb.position.set(x, 6, z);
        const light = new THREE.PointLight(0xffe0a5, 0, 25, 2);
        light.position.set(x, 6, z);
        this.group.add(pole, bulb, light);
        this.streetLights.push({ bulb, light });
      }
    }
  }

  setNightFactor(value) {
    const intensity = clamp(value, 0, 1);
    for (const entry of this.streetLights) {
      entry.light.intensity = intensity * 1.1;
      entry.bulb.material.emissive = new THREE.Color(0xffe0a5).multiplyScalar(intensity);
    }
  }

  collides(position, radius) {
    for (const box of this.buildingBounds) {
      const closestX = clamp(position.x, box.minX, box.maxX);
      const closestZ = clamp(position.z, box.minZ, box.maxZ);
      const dx = position.x - closestX;
      const dz = position.z - closestZ;
      if (dx * dx + dz * dz < radius * radius) {
        return true;
      }
    }
    return false;
  }

  isOutOfBounds(position, margin = 0) {
    const half = this.size / 2 - margin;
    return Math.abs(position.x) > half || Math.abs(position.z) > half;
  }

  clampToBounds(position, margin = 0) {
    const half = this.size / 2 - margin;
    position.x = clamp(position.x, -half, half);
    position.z = clamp(position.z, -half, half);
    return position;
  }

  getRoadAxis(position) {
    const xLine = snap(position.x, CONFIG.blockSize);
    const zLine = snap(position.z, CONFIG.blockSize);
    const dx = Math.abs(position.x - xLine);
    const dz = Math.abs(position.z - zLine);
    if (dx < dz) {
      return { axis: 'z', line: xLine };
    }
    return { axis: 'x', line: zLine };
  }

  getLaneTarget(position, direction) {
    const axis = this.getRoadAxis(position);
    if (axis.axis === 'x') {
      const offset = direction.z >= 0 ? -CONFIG.laneOffset : CONFIG.laneOffset;
      return new THREE.Vector3(position.x, 0, axis.line + offset);
    }
    const offset = direction.x >= 0 ? CONFIG.laneOffset : -CONFIG.laneOffset;
    return new THREE.Vector3(axis.line + offset, 0, position.z);
  }
}
