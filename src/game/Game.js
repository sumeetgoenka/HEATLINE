import * as THREE from 'three';
import { CONFIG, LOCATIONS, DISTRICTS } from './constants';
import { clamp, lerp, randBetween, TAU } from './math';
import { Input } from './Input';
import { World } from './World';
import { Player } from './Player';
import { Vehicle } from './Vehicle';
import { Pedestrian } from './Pedestrian';
import { Collectible } from './Collectible';
import { Roadblock } from './Roadblock';
import { MissionManager } from './Missions';

export class Game {
  constructor({ canvas, minimap, onHud, onStory, onNotification, onBootMessage, onStart }) {
    this.canvas = canvas;
    this.minimapCanvas = minimap;
    this.onHud = onHud;
    this.onStory = onStory;
    this.onNotification = onNotification;
    this.onBootMessage = onBootMessage;
    this.onStart = onStart;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x122035);
    this.scene.fog = new THREE.Fog(0x122035, 50, 520);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1400);
    this.cameraYaw = 0;
    this.cameraPitch = 0.2;
    this.cameraDistance = 14;
    this.cameraMode = 0;

    this.clock = new THREE.Clock();
    this.input = new Input(this.canvas);
    this.world = new World(this.scene);
    this.player = new Player(this.scene);
    this.vehicles = [];
    this.pedestrians = [];
    this.collectibles = [];
    this.roadblocks = [];
    this.currentVehicle = null;

    this.heat = 0;
    this.rep = 0;
    this.weatherState = 'Clear';
    this.weatherTimer = 20;
    this.weatherGrip = 1;
    this.timeOfDay = 0.28;
    this.timeSpeed = 0.004;
    this.currentDistrict = null;
    this.districtHeatMult = 1;
    this.roadblockCooldown = 0;
    this.speedingTimer = 0;
    this.wasWanted = false;
    this.safehouseHint = 0;
    this.garageHint = 0;
    this.cameraShake = 0;

    this.minimapCtx = this.minimapCanvas?.getContext('2d') || null;
    this.minimapScale = this.minimapCanvas ? this.minimapCanvas.width / CONFIG.citySize : 1;
    this.minimapZoom = 1;
    this.minimapBase = this.minimapCanvas ? this.createMinimapBase() : null;

    this.spawnTraffic();
    this.spawnPedestrians();
    this.spawnCollectibles(18);

    this.missions = new MissionManager(this);

    this.setupLights();
    this.bindEvents();

    this.started = false;
    this.debugEnabled = false;
    this.debugMessage = '';
    this.fps = 0;
    this.fpsFrames = 0;
    this.fpsTimer = 0;
    this.hudTimer = 0;

    this.onBootMessage?.('Ready to burn through the city grid.');

    this.handleResize = () => this.resize();
    window.addEventListener('resize', this.handleResize);

    this.animate();
  }

  startGame() {
    if (this.started) {
      return;
    }
    this.started = true;
    this.input.enable();
    this.canvas?.focus();
    this.input.requestPointerLock();
    this.onStart?.();
  }

  dispose() {
    window.removeEventListener('resize', this.handleResize);
    if (this.handleCanvasClick) {
      this.canvas.removeEventListener('click', this.handleCanvasClick);
    }
    this.input.dispose();
    this.renderer.dispose();
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  setupLights() {
    this.hemiLight = new THREE.HemisphereLight(0x9cb5ff, 0x1b1f2a, 0.8);
    this.scene.add(this.hemiLight);
    this.dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.dirLight.position.set(80, 120, 40);
    this.scene.add(this.dirLight);
  }

  bindEvents() {
    this.handleCanvasClick = () => {
      if (!this.started) {
        this.startGame();
      } else {
        this.input.requestPointerLock();
      }
    };
    this.canvas.addEventListener('click', this.handleCanvasClick);
  }

  spawnTraffic() {
    const types = ['car', 'car', 'truck', 'sports'];
    for (let i = 0; i < CONFIG.trafficCount; i += 1) {
      const position = this.world.roadNodes[Math.floor(Math.random() * this.world.roadNodes.length)].clone();
      const type = types[Math.floor(Math.random() * types.length)];
      const vehicle = new Vehicle(this.scene, { type, position });
      this.vehicles.push(vehicle);
    }
  }

  spawnPedestrians() {
    for (let i = 0; i < CONFIG.pedestrianCount; i += 1) {
      const position = new THREE.Vector3(
        randBetween(-CONFIG.citySize / 2, CONFIG.citySize / 2),
        0,
        randBetween(-CONFIG.citySize / 2, CONFIG.citySize / 2)
      );
      const ped = new Pedestrian(this.scene, position);
      this.pedestrians.push(ped);
    }
  }

  spawnCollectibles(count) {
    const attempts = count * 10;
    let spawned = 0;
    for (let i = 0; i < attempts && spawned < count; i += 1) {
      const position = new THREE.Vector3(
        randBetween(-CONFIG.citySize / 2 + 20, CONFIG.citySize / 2 - 20),
        0,
        randBetween(-CONFIG.citySize / 2 + 20, CONFIG.citySize / 2 - 20)
      );
      if (this.world.collides(position, 2.4)) {
        continue;
      }
      const collectible = new Collectible(this.scene, position);
      this.collectibles.push(collectible);
      spawned += 1;
    }
  }

  spawnMissionVehicle(position, type) {
    const existing = this.vehicles.find((vehicle) => vehicle.isMission && vehicle.type === type);
    if (existing) {
      existing.position.copy(position);
      return;
    }
    const vehicle = new Vehicle(this.scene, {
      type,
      position,
      aiType: 'parked',
      color: 0xffd27a
    });
    vehicle.isMission = true;
    this.vehicles.push(vehicle);
  }

  addHeat(amount) {
    const scaled = amount * this.districtHeatMult;
    this.heat = clamp(this.heat + scaled, 0, CONFIG.maxHeat);
  }

  reward(amount) {
    this.player.cash += amount;
    this.rep += Math.max(2, Math.floor(amount / 40));
  }

  getWantedLevel() {
    if (this.heat <= 0) {
      return 0;
    }
    return clamp(Math.ceil(this.heat / 20), 1, 5);
  }

  getFocusPosition() {
    if (this.currentVehicle) {
      return this.currentVehicle.position.clone();
    }
    return this.player.position.clone();
  }

  story(text, duration) {
    this.onStory?.(text, duration);
  }

  notify(text, duration) {
    this.onNotification?.(text, duration);
  }

  getDistrict(position) {
    for (const district of DISTRICTS) {
      if (
        position.x >= district.minX && position.x <= district.maxX &&
        position.z >= district.minZ && position.z <= district.maxZ
      ) {
        return district;
      }
    }
    return DISTRICTS[0];
  }

  toggleVehicle() {
    if (this.currentVehicle) {
      this.currentVehicle.aiType = 'traffic';
      const exitOffset = new THREE.Vector3(
        Math.sin(this.currentVehicle.heading + Math.PI / 2) * 2.2,
        0,
        Math.cos(this.currentVehicle.heading + Math.PI / 2) * 2.2
      );
      this.player.position.copy(this.currentVehicle.position.clone().add(exitOffset));
      this.player.mesh.visible = true;
      this.currentVehicle = null;
      this.notify('Exited vehicle');
      return;
    }

    let nearest = null;
    let minDist = 4;
    for (const vehicle of this.vehicles) {
      const distance = vehicle.position.distanceTo(this.player.position);
      if (distance < minDist && vehicle.aiType !== 'police' && !vehicle.isDestroyed) {
        nearest = vehicle;
        minDist = distance;
      }
    }

    if (nearest) {
      this.currentVehicle = nearest;
      this.currentVehicle.aiType = 'player';
      this.player.position.copy(this.currentVehicle.position.clone());
      this.player.mesh.visible = false;
      this.addHeat(12);
      this.notify('Vehicle taken');
    }
  }

  updateCamera(dt) {
    const mouse = this.input.consumeMouse();
    if (this.started) {
      this.cameraYaw -= mouse.dx * 0.002;
      this.cameraPitch -= mouse.dy * 0.002;
      this.cameraPitch = clamp(this.cameraPitch, -0.35, 0.65);
    }

    const speed = this.currentVehicle ? Math.abs(this.currentVehicle.speed) * 3.6 : this.player.speed;
    const targetFov = clamp(60 + speed * 0.15, 60, 78);
    this.camera.fov = lerp(this.camera.fov, targetFov, clamp(dt * 2, 0, 1));
    this.camera.updateProjectionMatrix();

    const target = this.getFocusPosition();
    let distance = this.cameraDistance;
    let height = 4.2;

    if (this.cameraMode === 1) {
      distance = 22;
      height = 7;
    } else if (this.cameraMode === 2) {
      distance = 6;
      height = 2.2;
    }

    const offset = new THREE.Vector3(
      Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch),
      Math.sin(this.cameraPitch),
      Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch)
    ).multiplyScalar(distance);

    let cameraPos = target.clone().add(offset);
    cameraPos.y += height;
    let attempts = 0;
    let testDistance = distance;
    while (this.world.collides(cameraPos, 1.6) && attempts < 6) {
      testDistance *= 0.82;
      const adjust = new THREE.Vector3(
        Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch),
        Math.sin(this.cameraPitch),
        Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch)
      ).multiplyScalar(testDistance);
      cameraPos = target.clone().add(adjust);
      cameraPos.y += height * 0.9;
      attempts += 1;
    }

    if (this.cameraShake > 0) {
      const shake = this.cameraShake;
      cameraPos.x += (Math.random() - 0.5) * shake;
      cameraPos.y += (Math.random() - 0.5) * shake;
      cameraPos.z += (Math.random() - 0.5) * shake;
      this.cameraShake = Math.max(this.cameraShake - dt * 1.8, 0);
    }

    this.camera.position.copy(cameraPos);
    this.camera.lookAt(target.x, target.y + 2, target.z);
  }

  updateDistrict() {
    const playerPos = this.getFocusPosition();
    const district = this.getDistrict(playerPos);
    if (!this.currentDistrict || this.currentDistrict.name !== district.name) {
      this.currentDistrict = district;
      this.notify(`Entering ${district.name}`);
    }
    this.districtHeatMult = district.heat;
  }

  updateWeather(dt) {
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      if (this.weatherState === 'Clear') {
        this.weatherState = 'Rain';
        this.weatherTimer = randBetween(18, 30);
      } else {
        this.weatherState = 'Clear';
        this.weatherTimer = randBetween(25, 40);
      }
    }
    this.weatherGrip = this.weatherState === 'Rain' ? 0.75 : 1;
  }

  updateTime(dt) {
    this.timeOfDay = (this.timeOfDay + dt * this.timeSpeed) % 1;
    const sun = Math.sin(this.timeOfDay * TAU);
    const dayFactor = clamp(sun * 0.5 + 0.5, 0, 1);
    const nightFactor = 1 - dayFactor;
    const rainFactor = this.weatherState === 'Rain' ? 0.35 : 0;

    const skyDay = new THREE.Color(0x6fa0ff);
    const skyNight = new THREE.Color(0x0b1020);
    const fogDay = new THREE.Color(0x9bb8ff);
    const fogNight = new THREE.Color(0x0b0f18);

    const skyColor = skyNight.clone().lerp(skyDay, dayFactor).lerp(new THREE.Color(0x39465a), rainFactor);
    const fogColor = fogNight.clone().lerp(fogDay, dayFactor).lerp(new THREE.Color(0x2c3445), rainFactor);

    this.scene.background = skyColor;
    this.scene.fog.color.copy(fogColor);

    if (this.hemiLight) {
      this.hemiLight.intensity = lerp(0.3, 1.0, dayFactor) * (1 - rainFactor * 0.3);
      this.hemiLight.color.copy(new THREE.Color(0xaec6ff).lerp(new THREE.Color(0x2c3c55), nightFactor));
      this.hemiLight.groundColor.copy(new THREE.Color(0x2d3344).lerp(new THREE.Color(0x111318), nightFactor));
    }

    if (this.dirLight) {
      this.dirLight.intensity = lerp(0.2, 1.0, dayFactor) * (1 - rainFactor * 0.4);
      this.dirLight.color.copy(new THREE.Color(0xfff1d6).lerp(new THREE.Color(0x6a7bb8), nightFactor));
    }

    this.world.setNightFactor(nightFactor);
  }

  updateSpeeding(dt) {
    if (!this.currentVehicle) {
      this.speedingTimer = 0;
      return;
    }
    const kph = Math.abs(this.currentVehicle.speed) * 3.6;
    if (kph > 90) {
      this.speedingTimer += dt;
      if (this.speedingTimer >= 3) {
        this.speedingTimer = 0;
        this.rep += 5;
        this.player.cash += 25;
        this.addHeat(3);
        this.notify('Speeding bonus +$25');
      }
    } else {
      this.speedingTimer = Math.max(this.speedingTimer - dt * 2, 0);
    }
  }

  updateRoadblocks(dt) {
    this.roadblockCooldown = Math.max(this.roadblockCooldown - dt, 0);
    const wanted = this.getWantedLevel();
    if (wanted >= 3 && this.roadblockCooldown <= 0 && this.roadblocks.length < 3) {
      this.spawnRoadblock();
      this.roadblockCooldown = 12;
    }

    for (let i = this.roadblocks.length - 1; i >= 0; i -= 1) {
      const block = this.roadblocks[i];
      if (block.update(dt)) {
        block.destroy();
        this.roadblocks.splice(i, 1);
      }
    }
  }

  spawnRoadblock() {
    const playerPos = this.getFocusPosition();
    const forward = new THREE.Vector3(Math.sin(this.player.heading), 0, Math.cos(this.player.heading));
    const target = playerPos.clone().add(forward.multiplyScalar(120));

    let closest = null;
    let closestDist = Infinity;
    for (const node of this.world.roadNodes) {
      const dist = node.distanceTo(target);
      if (dist < closestDist) {
        closestDist = dist;
        closest = node;
      }
    }

    if (!closest) {
      return;
    }
    const heading = this.player.heading + Math.PI / 2;
    const roadblock = new Roadblock(this.scene, closest, heading);
    this.roadblocks.push(roadblock);
    this.notify('Roadblock reported');
  }

  updateSafehouse(dt) {
    const playerPos = this.getFocusPosition();
    const distance = playerPos.distanceTo(LOCATIONS.hideout);
    if (distance < 18) {
      this.heat = clamp(this.heat - dt * 18, 0, CONFIG.maxHeat);
      this.player.health = clamp(this.player.health + dt * 12, 0, 100);
      this.player.stamina = clamp(this.player.stamina + dt * 20, 0, 100);
      this.safehouseHint -= dt;
      if (this.safehouseHint <= 0) {
        this.notify('Safehouse: heat cooling down');
        this.safehouseHint = 6;
      }
    }
  }

  updateGarage(dt) {
    if (!this.currentVehicle) {
      return;
    }
    const distance = this.currentVehicle.position.distanceTo(LOCATIONS.garage);
    if (distance > 16) {
      return;
    }
    if (Math.abs(this.currentVehicle.speed) > 2) {
      return;
    }
    const needsRepair = this.currentVehicle.health < 100 || this.currentVehicle.boost < 100;
    if (!needsRepair) {
      return;
    }

    const costPerSecond = 30;
    const cost = costPerSecond * dt;
    if (this.player.cash >= cost) {
      this.player.cash -= cost;
      this.currentVehicle.health = clamp(this.currentVehicle.health + dt * 20, 0, 100);
      this.currentVehicle.boost = clamp(this.currentVehicle.boost + dt * 40, 0, 100);
      if (this.garageHint <= 0) {
        this.notify('Garage service active');
        this.garageHint = 5;
      }
    } else if (this.garageHint <= 0) {
      this.notify('Garage: insufficient cash');
      this.garageHint = 6;
    }
    this.garageHint = Math.max(this.garageHint - dt, 0);
  }

  updateHeat(dt) {
    const wanted = this.getWantedLevel();
    if (wanted === 0) {
      if (this.wasWanted && this.heat <= 1) {
        this.wasWanted = false;
        this.rep += 12;
        this.player.cash += 40;
        this.notify('Heat lost +$40');
      }
      this.heat = clamp(this.heat - CONFIG.heatDecay * dt, 0, CONFIG.maxHeat);
      return;
    }

    const playerPos = this.getFocusPosition();
    const policeNearby = this.vehicles.some((vehicle) =>
      vehicle.aiType === 'police' && vehicle.position.distanceTo(playerPos) < 60
    );

    this.wasWanted = true;
    if (!policeNearby) {
      this.heat = clamp(this.heat - CONFIG.heatDecay * dt, 0, CONFIG.maxHeat);
    }
  }

  updatePolice() {
    const wanted = this.getWantedLevel();
    const required = wanted * CONFIG.policePerStar;
    const police = this.vehicles.filter((vehicle) => vehicle.aiType === 'police');

    if (police.length < required) {
      for (let i = police.length; i < required; i += 1) {
        const spawn = this.world.roadNodes[Math.floor(Math.random() * this.world.roadNodes.length)].clone();
        const unit = new Vehicle(this.scene, { type: 'police', position: spawn, aiType: 'police' });
        this.vehicles.push(unit);
      }
    } else if (police.length > required) {
      const toRemove = police.slice(0, police.length - required);
      for (const unit of toRemove) {
        this.scene.remove(unit.mesh);
      }
      const removeSet = new Set(toRemove);
      this.vehicles = this.vehicles.filter((vehicle) => !removeSet.has(vehicle));
    }
  }

  updateCollisions(dt) {
    const playerPos = this.getFocusPosition();
    const playerRadius = this.currentVehicle ? 2 : 0.8;

    for (const ped of this.pedestrians) {
      if (ped.isDown) {
        continue;
      }
      if (ped.position.distanceTo(playerPos) < playerRadius + 0.6) {
        ped.knockDown();
        this.addHeat(8);
        if (this.currentVehicle) {
          this.currentVehicle.speed *= 0.6;
          this.currentVehicle.applyDamage(6);
        }
        this.notify('Pedestrian hit');
        this.cameraShake = Math.max(this.cameraShake, 0.25);
      }
    }

    for (const vehicle of this.vehicles) {
      if (vehicle === this.currentVehicle) {
        continue;
      }
      const distance = vehicle.position.distanceTo(playerPos);
      if (distance < vehicle.radius + playerRadius) {
        if (this.currentVehicle) {
          this.currentVehicle.speed *= -0.2;
          this.currentVehicle.applyDamage(10);
        }
        vehicle.applyDamage(6);
        this.addHeat(6);
        this.cameraShake = Math.max(this.cameraShake, 0.35);
      }
    }

    for (let i = this.roadblocks.length - 1; i >= 0; i -= 1) {
      const block = this.roadblocks[i];
      if (block.position.distanceTo(playerPos) < block.radius + playerRadius) {
        if (this.currentVehicle) {
          this.currentVehicle.speed *= -0.4;
          this.currentVehicle.applyDamage(18);
        } else {
          this.player.health = clamp(this.player.health - 20, 0, 100);
        }
        block.damage(20);
        this.addHeat(10);
        this.cameraShake = Math.max(this.cameraShake, 0.5);
        if (block.health <= 0) {
          block.destroy();
          this.roadblocks.splice(i, 1);
        }
      }
    }

    if (!this.currentVehicle) {
      for (const vehicle of this.vehicles) {
        if (vehicle === this.currentVehicle) {
          continue;
        }
        if (vehicle.speed > 6 && vehicle.position.distanceTo(this.player.position) < 2) {
          this.player.health = clamp(this.player.health - 30 * dt, 0, 100);
          this.addHeat(4);
          this.cameraShake = Math.max(this.cameraShake, 0.2);
        }
      }
    }

    if (this.player.health <= 0) {
      this.player.health = 100;
      this.heat = 0;
      this.player.position.copy(LOCATIONS.hideout);
      if (this.currentVehicle) {
        this.currentVehicle.position.copy(LOCATIONS.hideout);
        this.currentVehicle.speed = 0;
        this.currentVehicle.health = 100;
        this.currentVehicle.isDestroyed = false;
      }
      this.notify('Respawned at hideout');
    }
  }

  updateCollectibles(dt) {
    const playerPos = this.getFocusPosition();
    for (const collectible of this.collectibles) {
      collectible.update(dt);
    }
    for (let i = this.collectibles.length - 1; i >= 0; i -= 1) {
      const collectible = this.collectibles[i];
      if (collectible.position.distanceTo(playerPos) < 2.4) {
        this.scene.remove(collectible.mesh);
        this.collectibles.splice(i, 1);
        this.player.cash += 50;
        this.heat = clamp(this.heat - 6, 0, CONFIG.maxHeat);
        this.notify('Data chip secured');
      }
    }
  }

  updateDebug(dt) {
    if (!this.debugEnabled) {
      return;
    }
    this.fpsFrames += 1;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTimer);
      this.fpsFrames = 0;
      this.fpsTimer = 0;
    }

    const playerPos = this.getFocusPosition();
    const wanted = this.getWantedLevel();
    this.debugMessage = [
      `FPS: ${this.fps}`,
      `Started: ${this.started}`,
      `PointerLock: ${document.pointerLockElement === this.canvas}`,
      `Heat: ${Math.round(this.heat)} (Wanted ${wanted})`,
      `District: ${this.currentDistrict ? this.currentDistrict.name : 'n/a'}`,
      `Weather: ${this.weatherState}`,
      `Vehicles: ${this.vehicles.length}`,
      `Pedestrians: ${this.pedestrians.length}`,
      `Pos: ${playerPos.x.toFixed(1)}, ${playerPos.z.toFixed(1)}`
    ].join('\n');
  }

  updateMinimap() {
    if (!this.minimapCtx || !this.minimapBase) {
      return;
    }
    const ctx = this.minimapCtx;
    ctx.clearRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);

    const playerPos = this.getFocusPosition();
    const speed = this.currentVehicle ? Math.abs(this.currentVehicle.speed) * 3.6 : this.player.speed;
    const targetZoom = this.currentVehicle ? clamp(1.2 + speed / 140, 1.2, 1.6) : 1;
    this.minimapZoom = lerp(this.minimapZoom, targetZoom, 0.08);
    const scale = this.minimapScale * this.minimapZoom;

    ctx.save();
    ctx.translate(this.minimapCanvas.width / 2, this.minimapCanvas.height / 2);
    ctx.scale(this.minimapZoom, this.minimapZoom);
    ctx.drawImage(
      this.minimapBase,
      -this.minimapBase.width / 2 - playerPos.x * this.minimapScale,
      -this.minimapBase.height / 2 - playerPos.z * this.minimapScale
    );
    ctx.restore();

    const center = this.minimapCanvas.width / 2;

    ctx.fillStyle = '#ffd27a';
    for (const vehicle of this.vehicles) {
      if (vehicle === this.currentVehicle) {
        continue;
      }
      const x = center + (vehicle.position.x - playerPos.x) * scale;
      const y = center + (vehicle.position.z - playerPos.z) * scale;
      if (x < 0 || y < 0 || x > this.minimapCanvas.width || y > this.minimapCanvas.height) {
        continue;
      }
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }

    ctx.fillStyle = '#4fc3ff';
    for (const ped of this.pedestrians) {
      const x = center + (ped.position.x - playerPos.x) * scale;
      const y = center + (ped.position.z - playerPos.z) * scale;
      if (x < 0 || y < 0 || x > this.minimapCanvas.width || y > this.minimapCanvas.height) {
        continue;
      }
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }

    const target = this.missions.getCurrentTarget();
    if (target) {
      const tx = center + (target.x - playerPos.x) * scale;
      const ty = center + (target.z - playerPos.z) * scale;
      ctx.strokeStyle = '#4fc3ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx, ty, 6, 0, TAU);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(this.player.heading);
    ctx.fillStyle = '#3bff9c';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-4, 4);
    ctx.lineTo(4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  createMinimapBase() {
    const canvas = document.createElement('canvas');
    canvas.width = this.minimapCanvas.width;
    canvas.height = this.minimapCanvas.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0c111b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const center = canvas.width / 2;
    ctx.fillStyle = '#1a2230';
    for (const node of this.world.roadNodes) {
      const x = center + node.x * this.minimapScale;
      const y = center + node.z * this.minimapScale;
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }

    ctx.fillStyle = '#243042';
    for (const box of this.world.buildingBounds) {
      const x = center + ((box.minX + box.maxX) / 2) * this.minimapScale;
      const y = center + ((box.minZ + box.maxZ) / 2) * this.minimapScale;
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }

    return canvas;
  }

  updateHUD() {
    const speed = this.currentVehicle ? Math.abs(this.currentVehicle.speed) * 3.6 : this.player.speed;
    const mode = this.currentVehicle ? 'Driving' : 'On Foot';
    const vehicleHealth = this.currentVehicle ? this.currentVehicle.health : 100;
    const boost = this.currentVehicle ? this.currentVehicle.boost : 100;
    const wanted = this.getWantedLevel();
    const target = this.missions.getCurrentTarget();
    const playerPos = this.getFocusPosition();

    let compass = { visible: false, angle: 0, distance: 0 };
    if (target) {
      const toTarget = new THREE.Vector3().subVectors(target, playerPos);
      const distance = toTarget.length();
      const angleToTarget = Math.atan2(toTarget.x, toTarget.z);
      const angle = angleToTarget - this.player.heading;
      compass = { visible: true, angle, distance };
    }

    let pursuit = '';
    if (wanted > 0) {
      const closestPolice = this.getClosestPoliceDistance();
      pursuit = closestPolice < 50 ? 'Pursuit' : 'Searching';
    }

    const district = this.currentDistrict ? `${this.currentDistrict.name} x${this.currentDistrict.heat.toFixed(1)}` : '';
    const weather = this.weatherState === 'Rain' ? 'Rain' : '';

    if (this.onHud) {
      this.onHud({
        speed,
        heat: this.heat,
        mode,
        cash: this.player.cash,
        rep: this.rep,
        health: this.player.health,
        stamina: this.player.stamina,
        boost,
        vehicleHealth,
        wanted,
        pursuit,
        district,
        weather,
        compass,
        mission: this.missions.getHudData(),
        debug: this.debugEnabled ? this.debugMessage : ''
      });
    }
  }

  getClosestPoliceDistance() {
    const playerPos = this.getFocusPosition();
    let closest = Infinity;
    for (const vehicle of this.vehicles) {
      if (vehicle.aiType !== 'police') {
        continue;
      }
      const dist = vehicle.position.distanceTo(playerPos);
      if (dist < closest) {
        closest = dist;
      }
    }
    return closest;
  }

  update(dt) {
    this.updateDistrict();
    this.updateWeather(dt);
    this.updateTime(dt);

    if (this.input.wasPressed('KeyF')) {
      this.toggleVehicle();
    }
    if (this.input.wasPressed('KeyC')) {
      this.cameraMode = (this.cameraMode + 1) % 3;
    }
    if (this.input.wasPressed('Backquote')) {
      this.debugEnabled = !this.debugEnabled;
    }
    if (this.input.wasPressed('KeyM')) {
      this.missions.restartStep();
    }
    if (this.input.wasPressed('KeyR')) {
      this.player.position.copy(LOCATIONS.hideout);
      if (this.currentVehicle) {
        this.currentVehicle.position.copy(LOCATIONS.hideout);
      }
      this.notify('Reset to hideout');
    }

    if (this.currentVehicle) {
      const boost = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');
      this.currentVehicle.updatePlayer(this.input, dt, this.world, boost, this.weatherGrip || 1);
      this.player.position.copy(this.currentVehicle.position);
      this.player.heading = this.currentVehicle.heading;
      this.player.speed = Math.abs(this.currentVehicle.speed) * 3.6;
      this.updateSpeeding(dt);
    } else {
      this.player.updateOnFoot(this.input, dt, this.world, this.cameraYaw);
    }

    for (const vehicle of this.vehicles) {
      if (vehicle === this.currentVehicle) {
        continue;
      }
      if (vehicle.aiType === 'traffic') {
        vehicle.updateTraffic(dt, this.world, this.world.roadNodes, this.vehicles, this.weatherGrip || 1);
      } else if (vehicle.aiType === 'police') {
        vehicle.updatePolice(dt, this.world, this.getFocusPosition(), this.world.roadNodes, this.vehicles, this.weatherGrip || 1);
      }
    }

    const wantedLevel = this.getWantedLevel();
    const playerPos = this.getFocusPosition();
    for (const ped of this.pedestrians) {
      ped.update(dt, this.world, playerPos, wantedLevel);
    }

    this.updateCollectibles(dt);
    this.updateCollisions(dt);

    if (this.currentVehicle && this.currentVehicle.isDestroyed) {
      this.notify('Vehicle totaled!');
      this.toggleVehicle();
    }

    this.updateSafehouse(dt);
    this.updateGarage(dt);
    this.updateHeat(dt);
    this.updatePolice();
    this.updateRoadblocks(dt);
    this.missions.update(dt);

    this.updateCamera(dt);
    this.updateMinimap();

    this.updateDebug(dt);

    this.hudTimer += dt;
    if (this.hudTimer >= 0.1) {
      this.hudTimer = 0;
      this.updateHUD();
    }
  }

  animate() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.started) {
      this.update(dt);
    }
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.animate());
  }
}
