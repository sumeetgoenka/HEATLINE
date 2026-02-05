import * as THREE from 'three';
import { randBetween, TAU } from './math';

export class Collectible {
  constructor(scene, position) {
    this.mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.9, 0),
      new THREE.MeshStandardMaterial({
        color: 0x4fc3ff,
        emissive: 0x1c4b66,
        roughness: 0.2,
        metalness: 0.6
      })
    );
    this.mesh.position.copy(position);
    this.mesh.position.y = 1.4;
    scene.add(this.mesh);
    this.position = this.mesh.position;
    this.spin = randBetween(0, TAU);
  }

  update(dt) {
    this.spin += dt * 1.8;
    this.mesh.rotation.y = this.spin;
    this.mesh.position.y = 1.2 + Math.sin(this.spin * 2) * 0.4;
  }
}
