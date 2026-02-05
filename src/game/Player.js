import * as THREE from 'three';
import { CONFIG } from './constants';
import { clamp } from './math';

export class Player {
  constructor(scene) {
    this.mesh = this.createMesh();
    this.mesh.position.set(0, 0, 0);
    scene.add(this.mesh);
    this.position = this.mesh.position;
    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.health = 100;
    this.stamina = 100;
    this.cash = 0;
    this.rep = 0;
  }

  createMesh() {
    const group = new THREE.Group();

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1.1, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x2f6fd6 })
    );
    torso.position.y = 1.2;

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf1c7a2 })
    );
    head.position.y = 1.85;

    const legMat = new THREE.MeshStandardMaterial({ color: 0x1b1f2a });
    const legGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);
    const legL = new THREE.Mesh(legGeo, legMat);
    const legR = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.15, 0.4, 0);
    legR.position.set(0.15, 0.4, 0);

    const armMat = new THREE.MeshStandardMaterial({ color: 0x2a3f6b });
    const armGeo = new THREE.BoxGeometry(0.18, 0.6, 0.18);
    const armL = new THREE.Mesh(armGeo, armMat);
    const armR = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-0.45, 1.2, 0);
    armR.position.set(0.45, 1.2, 0);

    group.add(torso, head, legL, legR, armL, armR);
    group.userData = { legL, legR, armL, armR };
    return group;
  }

  updateOnFoot(input, dt, world, cameraYaw) {
    const moveX = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
    const moveZ = (input.isDown('KeyS') ? 1 : 0) - (input.isDown('KeyW') ? 1 : 0);
    const move = new THREE.Vector3(moveX, 0, moveZ);

    let targetSpeed = 0;
    if (move.lengthSq() > 0) {
      move.normalize();
      const angle = Math.atan2(move.x, move.z) + cameraYaw;
      this.heading = angle;
      const sprinting = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
      const canSprint = sprinting && this.stamina > 5;
      targetSpeed = canSprint ? CONFIG.playerSprint : CONFIG.playerWalk;
      if (canSprint) {
        this.stamina = clamp(this.stamina - dt * 18, 0, 100);
      }
    }

    if (targetSpeed === 0) {
      this.stamina = clamp(this.stamina + dt * 10, 0, 100);
    }

    const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const desiredVelocity = forward.multiplyScalar(targetSpeed);
    this.velocity.lerp(desiredVelocity, clamp(dt * CONFIG.playerAccel, 0, 1));

    const next = this.position.clone().add(this.velocity.clone().multiplyScalar(dt));
    if (world.isOutOfBounds(next, 1.2)) {
      world.clampToBounds(next, 1.2);
      this.velocity.multiplyScalar(0.2);
      this.position.copy(next);
    } else if (!world.collides(next, 0.6)) {
      this.position.copy(next);
    } else {
      this.velocity.multiplyScalar(0.2);
    }

    this.speed = this.velocity.length() * 3.6;
    this.mesh.rotation.y = this.heading;
    this.animateWalk();
  }

  animateWalk() {
    const { legL, legR, armL, armR } = this.mesh.userData;
    const walkSpeed = clamp(this.speed / 10, 0, 1);
    const swing = Math.sin(Date.now() * 0.008) * 0.6 * walkSpeed;
    if (legL && legR && armL && armR) {
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armL.rotation.x = -swing;
      armR.rotation.x = swing;
    }
  }
}
