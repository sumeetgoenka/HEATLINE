import * as THREE from 'three';
import { randBetween, angleLerp, clamp } from './math';
import { CONFIG } from './constants';

export class Pedestrian {
  constructor(scene, position) {
    this.mesh = this.createMesh();
    this.mesh.position.copy(position);
    scene.add(this.mesh);
    this.position = this.mesh.position;
    this.speed = randBetween(2.0, 3.2);
    this.heading = randBetween(0, Math.PI * 2);
    this.target = this.pickTarget();
    this.isDown = false;
    this.downTimer = 0;
    this.walkPhase = randBetween(0, Math.PI * 2);
  }

  createMesh() {
    const group = new THREE.Group();
    const bodyColor = new THREE.Color().setHSL(randBetween(0, 1), 0.35, 0.55);

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.9, 0.3),
      new THREE.MeshStandardMaterial({ color: bodyColor })
    );
    torso.position.y = 1.1;

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf1c7a2 })
    );
    head.position.y = 1.7;

    const limbMat = new THREE.MeshStandardMaterial({ color: 0x1f2430 });
    const armGeo = new THREE.BoxGeometry(0.15, 0.55, 0.15);
    const legGeo = new THREE.BoxGeometry(0.18, 0.65, 0.18);

    const armL = new THREE.Mesh(armGeo, limbMat);
    const armR = new THREE.Mesh(armGeo, limbMat);
    const legL = new THREE.Mesh(legGeo, limbMat);
    const legR = new THREE.Mesh(legGeo, limbMat);

    armL.position.set(-0.35, 1.1, 0);
    armR.position.set(0.35, 1.1, 0);
    legL.position.set(-0.15, 0.35, 0);
    legR.position.set(0.15, 0.35, 0);

    group.add(torso, head, armL, armR, legL, legR);
    group.userData = { armL, armR, legL, legR };
    return group;
  }

  pickTarget() {
    return new THREE.Vector3(
      randBetween(-CONFIG.citySize / 2, CONFIG.citySize / 2),
      0,
      randBetween(-CONFIG.citySize / 2, CONFIG.citySize / 2)
    );
  }

  knockDown() {
    this.isDown = true;
    this.downTimer = 3;
    this.mesh.rotation.z = Math.PI / 2;
  }

  update(dt, world, playerPos, wantedLevel) {
    if (this.isDown) {
      this.downTimer -= dt;
      if (this.downTimer <= 0) {
        this.isDown = false;
        this.mesh.rotation.z = 0;
        this.target = this.pickTarget();
      }
      return;
    }

    if (playerPos) {
      const distToPlayer = this.position.distanceTo(playerPos);
      if (wantedLevel > 0 || distToPlayer < 8) {
        const away = this.position.clone().sub(playerPos).normalize();
        this.target = this.position.clone().add(away.multiplyScalar(20));
        this.speed = 3.6;
      } else {
        this.speed = clamp(this.speed, 2.0, 3.2);
      }
    }

    const toTarget = new THREE.Vector3().subVectors(this.target, this.position);
    if (toTarget.length() < 3) {
      this.target = this.pickTarget();
    }

    const desiredHeading = Math.atan2(toTarget.x, toTarget.z);
    this.heading = angleLerp(this.heading, desiredHeading, dt * 0.8);

    const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const next = this.position.clone().add(forward.multiplyScalar(this.speed * dt));
    if (!world.collides(next, 0.6)) {
      this.position.copy(next);
    } else {
      this.heading += Math.PI / 2;
    }

    this.mesh.rotation.y = this.heading;
    this.animateWalk(dt);
  }

  animateWalk(dt) {
    this.walkPhase += dt * 6;
    const swing = Math.sin(this.walkPhase) * 0.6;
    const { armL, armR, legL, legR } = this.mesh.userData;
    if (armL && armR && legL && legR) {
      armL.rotation.x = -swing;
      armR.rotation.x = swing;
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
    }
  }
}
