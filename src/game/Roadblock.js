import * as THREE from 'three';
import { clamp } from './math';

export class Roadblock {
  constructor(scene, position, heading) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.position = this.group.position;
    this.position.copy(position);
    this.heading = heading;
    this.timer = 18;
    this.radius = 5.5;
    this.health = 40;

    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x8b2f2f, roughness: 0.6 });
    const barrierGeo = new THREE.BoxGeometry(5, 1.2, 0.6);
    const barrier1 = new THREE.Mesh(barrierGeo, barrierMat);
    const barrier2 = new THREE.Mesh(barrierGeo, barrierMat);
    barrier1.position.set(0, 0.6, -2.2);
    barrier2.position.set(0, 0.6, 2.2);
    barrier1.rotation.y = Math.PI / 2;
    barrier2.rotation.y = Math.PI / 2;

    const coneMat = new THREE.MeshStandardMaterial({ color: 0xffb347, roughness: 0.3 });
    for (let i = -2; i <= 2; i += 2) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 8), coneMat);
      cone.position.set(i, 0.4, 0);
      this.group.add(cone);
    }

    this.group.add(barrier1, barrier2);
    this.group.rotation.y = heading;
    this.scene.add(this.group);
  }

  update(dt) {
    this.timer -= dt;
    return this.timer <= 0;
  }

  damage(amount) {
    this.health = clamp(this.health - amount, 0, 40);
    if (this.health <= 0) {
      this.group.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.color.setHex(0x333333);
        }
      });
      this.timer = Math.min(this.timer, 2);
    }
  }

  destroy() {
    this.scene.remove(this.group);
  }
}
