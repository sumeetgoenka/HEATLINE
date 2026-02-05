import * as THREE from 'three';
import { CONFIG } from './constants';
import { clamp, lerp, randBetween, randChoice, angleLerp, TAU, snap } from './math';

const DIRECTIONS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1)
];

const directionToHeading = (dir) => Math.atan2(dir.x, dir.z);

export class Vehicle {
  constructor(scene, options) {
    const { type, position, aiType = 'traffic', color } = options;
    this.type = type;
    this.aiType = aiType;
    this.mesh = Vehicle.createMesh(type, color);
    this.mesh.position.copy(position);
    scene.add(this.mesh);

    this.position = this.mesh.position;
    this.heading = randBetween(0, TAU);
    this.speed = 0;
    this.radius = type === 'truck' ? 2.6 : 2.0;
    this.maxSpeed = type === 'sports' ? 52 : type === 'police' ? 46 : 40;
    this.accel = type === 'sports' ? 26 : 18;
    this.turnRate = type === 'truck' ? 0.8 : 1.1;
    this.brake = 32;
    this.health = 100;
    this.boost = 100;
    this.isDestroyed = false;
    this.targetNode = null;
    this.direction = randChoice(DIRECTIONS).clone();
    this.turnCooldown = randBetween(0, 2);
  }

  static createMesh(type, colorOverride) {
    const group = new THREE.Group();
    const bodyColor = colorOverride || {
      car: 0x6fa8ff,
      sports: 0xff6f5a,
      truck: 0x707b87,
      police: 0x2d4a99
    }[type];
    const cabinColor = type === 'police' ? 0xdfe8ff : 0x1d1f26;

    const length = type === 'truck' ? 5.6 : type === 'sports' ? 4.4 : 4.8;
    const width = type === 'truck' ? 2.6 : 2.2;
    const height = type === 'sports' ? 1.3 : 1.6;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(length, height, width),
      new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4, metalness: 0.3 })
    );
    body.position.y = height / 2;
    group.add(body);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(length * 0.6, height * 0.6, width * 0.9),
      new THREE.MeshStandardMaterial({ color: cabinColor, roughness: 0.2 })
    );
    cabin.position.set(length * 0.05, height * 0.85, 0);
    group.add(cabin);

    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.5, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.8 });
    const wheelOffsets = [
      [length * 0.35, 0.35, width * 0.55],
      [length * 0.35, 0.35, -width * 0.55],
      [-length * 0.35, 0.35, width * 0.55],
      [-length * 0.35, 0.35, -width * 0.55]
    ];
    wheelOffsets.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, y, z);
      group.add(wheel);
    });

    if (type === 'police') {
      const light = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.3, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xff4d4d, emissive: 0x993333 })
      );
      light.position.set(0, height + 0.2, 0);
      group.add(light);
    }

    return group;
  }

  updatePlayer(input, dt, world, boost, gripFactor = 1) {
    if (this.isDestroyed) {
      this.speed = 0;
      return;
    }

    const forwardInput = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
    const steerInput = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);

    const boosting = boost && this.boost > 0;
    if (boosting) {
      this.boost = clamp(this.boost - dt * 28, 0, 100);
    } else {
      this.boost = clamp(this.boost + dt * 16, 0, 100);
    }

    if (forwardInput !== 0) {
      const accel = this.accel * (boosting ? 1.35 : 1);
      this.speed += forwardInput * accel * dt;
    } else {
      this.speed *= 0.98;
    }

    if (input.isDown('Space')) {
      this.speed = lerp(this.speed, 0, dt * 4);
    }

    const maxSpeed = boosting ? this.maxSpeed * 1.2 : this.maxSpeed;
    this.speed = clamp(this.speed, -maxSpeed * 0.35, maxSpeed);

    if (Math.abs(this.speed) > 0.5) {
      const speedFactor = clamp(Math.abs(this.speed) / this.maxSpeed, 0, 1);
      const turnLimit = lerp(1.0, 0.5, speedFactor);
      const grip = clamp(gripFactor, 0.6, 1.1);
      this.heading -= steerInput * this.turnRate * turnLimit * grip * dt * Math.sign(this.speed);
      this.speed -= Math.abs(steerInput) * (1 - grip) * dt * 6;
    }

    this.move(dt, world);

    // Lane assist to keep the car straight on the road grid.
    if (Math.abs(this.speed) > 4) {
      const dir = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
      const laneTarget = world.getLaneTarget(this.position, dir);
      const correction = laneTarget.sub(this.position);
      this.position.add(correction.multiplyScalar(dt * 0.4));
    }
  }

  updateTraffic(dt, world, nodes, vehicles, gripFactor = 1) {
    if (this.isDestroyed) {
      this.speed = 0;
      return;
    }

    this.turnCooldown = Math.max(this.turnCooldown - dt, 0);

    const axisX = snap(this.position.x, CONFIG.blockSize);
    const axisZ = snap(this.position.z, CONFIG.blockSize);
    const nearIntersection = Math.abs(this.position.x - axisX) < 1.4 && Math.abs(this.position.z - axisZ) < 1.4;

    if (nearIntersection && this.turnCooldown <= 0) {
      const choice = Math.random();
      if (choice < 0.25) {
        this.direction = new THREE.Vector3(-this.direction.z, 0, this.direction.x); // left
      } else if (choice > 0.75) {
        this.direction = new THREE.Vector3(this.direction.z, 0, -this.direction.x); // right
      }
      this.turnCooldown = randBetween(2, 4);
    }

    const desiredHeading = directionToHeading(this.direction);
    const grip = clamp(gripFactor, 0.6, 1.1);
    this.heading = angleLerp(this.heading, desiredHeading, dt * 1.2 * grip);

    let desiredSpeed = this.maxSpeed * 0.45;
    if (vehicles) {
      const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
      for (const other of vehicles) {
        if (other === this || other.isDestroyed) {
          continue;
        }
        const toOther = new THREE.Vector3().subVectors(other.position, this.position);
        const distance = toOther.length();
        if (distance < 8) {
          const dir = toOther.normalize();
          if (forward.dot(dir) > 0.4) {
            desiredSpeed = Math.min(desiredSpeed, this.maxSpeed * 0.2);
            break;
          }
        }
      }
    }

    this.speed = lerp(this.speed, desiredSpeed, dt * 0.6);
    this.move(dt, world);

    const laneTarget = world.getLaneTarget(this.position, this.direction);
    const correction = laneTarget.sub(this.position);
    this.position.add(correction.multiplyScalar(dt * 0.6));
  }

  updatePolice(dt, world, targetPosition, nodes, vehicles, gripFactor = 1) {
    if (this.isDestroyed) {
      this.speed = 0;
      return;
    }

    const toTarget = new THREE.Vector3().subVectors(targetPosition, this.position);
    const desiredHeading = Math.atan2(toTarget.x, toTarget.z);
    const grip = clamp(gripFactor, 0.6, 1.1);
    this.heading = angleLerp(this.heading, desiredHeading, dt * 1.3 * grip);

    let desiredSpeed = this.maxSpeed * 0.75;
    if (vehicles) {
      const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
      for (const other of vehicles) {
        if (other === this || other.isDestroyed) {
          continue;
        }
        const toOther = new THREE.Vector3().subVectors(other.position, this.position);
        const distance = toOther.length();
        if (distance < 7) {
          const dir = toOther.normalize();
          if (forward.dot(dir) > 0.4) {
            desiredSpeed = Math.min(desiredSpeed, this.maxSpeed * 0.4);
            break;
          }
        }
      }
    }

    this.speed = lerp(this.speed, desiredSpeed, dt * 0.9);
    this.move(dt, world);
  }

  move(dt, world) {
    const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const next = this.position.clone().add(forward.multiplyScalar(this.speed * dt));

    if (world.isOutOfBounds(next, this.radius)) {
      this.heading += Math.PI * 0.8;
      this.speed *= -0.3;
      this.mesh.rotation.y = this.heading;
      return;
    }

    if (!world.collides(next, this.radius)) {
      this.position.copy(next);
    } else {
      this.speed *= -0.2;
      this.applyDamage(8);
    }

    this.mesh.rotation.y = this.heading;
  }

  applyDamage(amount) {
    this.health = clamp(this.health - amount, 0, 100);
    if (this.health <= 0 && !this.isDestroyed) {
      this.isDestroyed = true;
      this.speed = 0;
      this.mesh.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.color.setHex(0x2a2a2a);
          child.material.emissive = new THREE.Color(0x000000);
        }
      });
    }
  }
}
