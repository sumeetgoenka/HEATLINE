(() => {
    const startButton = document.getElementById('start-button');
    const subtitle = document.querySelector('#start-screen .subtitle');

    window.__heatlineBooted = false;
    window.__heatlineStart = () => {
        window.__heatlineStartRequested = true;
        if (window.HEATLINE) {
            window.HEATLINE.startGame();
        }
    };

    const showBootError = (message) => {
        if (subtitle) {
            subtitle.textContent = message;
        }
        if (startButton) {
            startButton.disabled = true;
            startButton.textContent = 'Load Failed';
        }
    };

    window.addEventListener('error', (event) => {
        if (!event || !event.message) {
            showBootError('Boot error: unknown script failure.');
            return;
        }
        showBootError(`Boot error: ${event.message}`);
    });

    window.addEventListener('unhandledrejection', (event) => {
        const message = event && event.reason ? event.reason.toString() : 'Unhandled promise rejection.';
        showBootError(`Boot error: ${message}`);
    });

    if (!window.THREE) {
        showBootError('Three.js failed to load. Check your network or CDN access.');
        return;
    }

    const THREE = window.THREE;
    const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const angleLerp = (a, b, t) => {
    const diff = ((b - a + Math.PI) % TAU) - Math.PI;
    return a + diff * t;
};
const randBetween = (min, max) => min + Math.random() * (max - min);

const CONFIG = {
    citySize: 800,
    blockSize: 70,
    roadWidth: 12,
    buildingMin: 12,
    buildingMax: 26,
    buildingHeightMin: 12,
    buildingHeightMax: 70,
    trafficCount: 22,
    pedestrianCount: 36,
    policePerStar: 2,
    maxHeat: 100,
    heatDecay: 7,
    playerWalk: 7,
    playerSprint: 12,
    playerAccel: 18,
    vehicleTurn: 1.4,
    vehicleAccel: 18,
    vehicleMax: 38,
    vehicleBrake: 30
};

const LOCATIONS = {
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

const DISTRICTS = [
    { name: 'Civic Core', minX: -120, maxX: 120, minZ: -120, maxZ: 120, heat: 1.2 },
    { name: 'Harbor Line', minX: 0, maxX: 400, minZ: 0, maxZ: 400, heat: 0.9 },
    { name: 'Foundry', minX: 0, maxX: 400, minZ: -400, maxZ: 0, heat: 1.1 },
    { name: 'Backlot', minX: -400, maxX: 0, minZ: 0, maxZ: 400, heat: 0.95 },
    { name: 'Old Grid', minX: -400, maxX: 0, minZ: -400, maxZ: 0, heat: 1.0 }
];

class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = new Set();
        this.pressed = new Set();
        this.mouse = { dx: 0, dy: 0 };
        this.pointerLocked = false;
        this.blockedKeys = new Set([
            'KeyW', 'KeyA', 'KeyS', 'KeyD',
            'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
            'Space', 'ShiftLeft', 'ShiftRight',
            'KeyF', 'KeyC', 'KeyR', 'KeyM', 'Backquote'
        ]);

        window.addEventListener('keydown', (event) => {
            if (this.blockedKeys.has(event.code)) {
                event.preventDefault();
            }
            if (!this.keys.has(event.code)) {
                this.pressed.add(event.code);
            }
            this.keys.add(event.code);
        });

        window.addEventListener('keyup', (event) => {
            if (this.blockedKeys.has(event.code)) {
                event.preventDefault();
            }
            this.keys.delete(event.code);
        });

        canvas.addEventListener('click', () => {
            if (!this.pointerLocked) {
                canvas.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.pointerLocked = document.pointerLockElement === canvas;
        });

        window.addEventListener('mousemove', (event) => {
            if (this.pointerLocked) {
                this.mouse.dx += event.movementX;
                this.mouse.dy += event.movementY;
            }
        });
    }

    isDown(code) {
        return this.keys.has(code);
    }

    wasPressed(code) {
        if (this.pressed.has(code)) {
            this.pressed.delete(code);
            return true;
        }
        return false;
    }

    consumeMouse() {
        const delta = { dx: this.mouse.dx, dy: this.mouse.dy };
        this.mouse.dx = 0;
        this.mouse.dy = 0;
        return delta;
    }
}

class UI {
    constructor() {
        this.missionTitle = document.getElementById('mission-title');
        this.missionStep = document.getElementById('mission-step');
        this.missionTimer = document.getElementById('mission-timer');
        this.story = document.getElementById('story');
        this.notification = document.getElementById('notification');
        this.speedEl = document.getElementById('speed');
        this.heatEl = document.getElementById('heat');
        this.modeEl = document.getElementById('mode');
        this.cashEl = document.getElementById('cash');
        this.repEl = document.getElementById('rep');
        this.healthBar = document.querySelector('#health-bar span');
        this.staminaBar = document.querySelector('#stamina-bar span');
        this.boostBar = document.querySelector('#boost-bar span');
        this.vehicleBar = document.querySelector('#vehicle-bar span');
        this.wanted = document.getElementById('wanted');
        this.pursuit = document.getElementById('pursuit');
        this.district = document.getElementById('district');
        this.weather = document.getElementById('weather');
        this.compass = document.getElementById('compass');
        this.compassArrow = document.getElementById('compass-arrow');
        this.compassText = document.getElementById('compass-text');
        this.storyTimeout = null;
        this.notificationTimeout = null;
    }

    setMission(title, step, timerText) {
        this.missionTitle.textContent = title;
        this.missionStep.textContent = step;
        this.missionTimer.textContent = timerText || '';
    }

    showStory(text, duration = 5000) {
        clearTimeout(this.storyTimeout);
        this.story.textContent = text;
        this.story.classList.remove('hidden');
        this.storyTimeout = setTimeout(() => {
            this.story.classList.add('hidden');
        }, duration);
    }

    notify(text, duration = 2500) {
        clearTimeout(this.notificationTimeout);
        this.notification.textContent = text;
        this.notification.classList.remove('hidden');
        this.notificationTimeout = setTimeout(() => {
            this.notification.classList.add('hidden');
        }, duration);
    }

    updateStats({ speed, heat, mode, cash, rep, health, stamina, boost, vehicleHealth }) {
        this.speedEl.textContent = Math.floor(speed).toString();
        this.heatEl.textContent = Math.floor(heat).toString();
        this.modeEl.textContent = mode;
        this.cashEl.textContent = `$${cash}`;
        if (this.repEl) {
            this.repEl.textContent = Math.floor(rep).toString();
        }
        this.healthBar.style.width = `${clamp(health, 0, 100)}%`;
        this.staminaBar.style.width = `${clamp(stamina, 0, 100)}%`;
        if (this.boostBar) {
            this.boostBar.style.width = `${clamp(boost, 0, 100)}%`;
        }
        if (this.vehicleBar) {
            this.vehicleBar.style.width = `${clamp(vehicleHealth, 0, 100)}%`;
        }
    }

    updateWanted(level) {
        let stars = '';
        for (let i = 0; i < level; i += 1) {
            stars += '★';
        }
        this.wanted.textContent = stars;
    }

    updatePursuit(text) {
        if (this.pursuit) {
            this.pursuit.textContent = text || '';
        }
    }

    updateDistrict(text) {
        if (this.district) {
            this.district.textContent = text || '';
        }
    }

    updateWeather(text) {
        if (this.weather) {
            this.weather.textContent = text || '';
        }
    }

    updateCompass({ visible, angle, distance }) {
        if (!this.compass) {
            return;
        }
        this.compass.classList.toggle('hidden', !visible);
        if (visible) {
            if (this.compassArrow) {
                this.compassArrow.style.transform = `rotate(${angle}rad)`;
            }
            if (this.compassText) {
                this.compassText.textContent = `Objective ${Math.round(distance)}m`;
            }
        }
    }
}

class World {
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
}

class Vehicle {
    constructor(scene, options) {
        const { type, position, aiType = 'traffic', color } = options;
        this.type = type;
        this.aiType = aiType;
        this.mesh = Vehicle.createMesh(type, color);
        this.mesh.position.copy(position);
        scene.add(this.mesh);

        this.position = this.mesh.position;
        this.velocity = new THREE.Vector3();
        this.heading = randBetween(0, TAU);
        this.speed = 0;
        this.radius = type === 'truck' ? 2.4 : 1.8;
        this.maxSpeed = type === 'sports' ? 52 : type === 'police' ? 46 : 40;
        this.accel = type === 'sports' ? 26 : 20;
        this.turnRate = type === 'truck' ? 0.9 : 1.2;
        this.brake = 32;
        this.targetNode = null;
        this.isMission = false;
        this.isDestroyed = false;
        this.health = 100;
        this.boost = 100;
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
        const width = type === 'truck' ? 2.4 : 2.1;
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

        const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 12);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.8 });
        const wheelOffsets = [
            [length * 0.35, 0.4, width * 0.55],
            [length * 0.35, 0.4, -width * 0.55],
            [-length * 0.35, 0.4, width * 0.55],
            [-length * 0.35, 0.4, -width * 0.55]
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

    setTarget(node) {
        this.targetNode = node;
    }

    updatePlayer(input, dt, world, boost, gripFactor = 1) {
        if (this.isDestroyed) {
            this.speed = 0;
            return;
        }
        const forwardInput = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
        const steerInput = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);

        const grip = clamp(gripFactor, 0.6, 1.1);
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
        this.speed = clamp(this.speed, -maxSpeed * 0.4, maxSpeed);

        if (Math.abs(this.speed) > 0.5) {
            const speedFactor = clamp(Math.abs(this.speed) / this.maxSpeed, 0, 1);
            const turnLimit = lerp(1.0, 0.5, speedFactor);
            this.heading -= steerInput * this.turnRate * turnLimit * grip * dt * Math.sign(this.speed);
            this.speed -= Math.abs(steerInput) * (1 - grip) * dt * 6;
        }

        const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
        this.velocity.copy(forward).multiplyScalar(this.speed);
        this.move(dt, world);
    }

    updateTraffic(dt, world, nodes, vehicles, gripFactor = 1) {
        if (this.isDestroyed) {
            this.speed = 0;
            return;
        }
        if (!this.targetNode || this.position.distanceTo(this.targetNode) < 8) {
            this.targetNode = nodes[Math.floor(Math.random() * nodes.length)];
        }

        const toTarget = new THREE.Vector3().subVectors(this.targetNode, this.position);
        const desiredHeading = Math.atan2(toTarget.x, toTarget.z);
        const grip = clamp(gripFactor, 0.6, 1.1);
        this.heading = angleLerp(this.heading, desiredHeading, dt * 0.8 * grip);

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
                    const ahead = forward.dot(dir);
                    if (ahead > 0.4) {
                        desiredSpeed = Math.min(desiredSpeed, this.maxSpeed * 0.15);
                        break;
                    }
                }
            }
        }
        this.speed = lerp(this.speed, desiredSpeed, dt * 0.6);

        const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
        this.velocity.copy(forward).multiplyScalar(this.speed);

        const probe = this.position.clone().add(forward.clone().multiplyScalar(6));
        if (world.collides(probe, this.radius)) {
            this.heading += Math.PI / 2;
        }

        this.move(dt, world);
    }

    updatePolice(dt, world, targetPosition, nodes, vehicles, gripFactor = 1) {
        if (this.isDestroyed) {
            this.speed = 0;
            return;
        }
        const toTarget = new THREE.Vector3().subVectors(targetPosition, this.position);
        const desiredHeading = Math.atan2(toTarget.x, toTarget.z);
        const grip = clamp(gripFactor, 0.6, 1.1);
        this.heading = angleLerp(this.heading, desiredHeading, dt * 1.4 * grip);
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
                    const ahead = forward.dot(dir);
                    if (ahead > 0.4) {
                        desiredSpeed = Math.min(desiredSpeed, this.maxSpeed * 0.35);
                        break;
                    }
                }
            }
        }
        this.speed = lerp(this.speed, desiredSpeed, dt * 0.9);

        const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
        this.velocity.copy(forward).multiplyScalar(this.speed);

        const probe = this.position.clone().add(forward.clone().multiplyScalar(7));
        if (world.collides(probe, this.radius)) {
            this.heading += Math.PI / 2;
            this.targetNode = nodes[Math.floor(Math.random() * nodes.length)];
        }

        this.move(dt, world);
    }

    move(dt, world) {
        const next = this.position.clone().add(this.velocity.clone().multiplyScalar(dt));
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

class Pedestrian {
    constructor(scene, position) {
        this.mesh = this.createMesh();
        this.mesh.position.copy(position);
        scene.add(this.mesh);
        this.position = this.mesh.position;
        this.speed = randBetween(2.0, 3.2);
        this.heading = randBetween(0, TAU);
        this.target = this.pickTarget();
        this.isDown = false;
        this.downTimer = 0;
    }

    createMesh() {
        const group = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.35, 1.1, 8),
            new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(randBetween(0, 1), 0.25, 0.5) })
        );
        body.position.y = 0.55;
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.25, 12, 12),
            new THREE.MeshStandardMaterial({ color: 0xf1c7a2 })
        );
        head.position.y = 1.35;
        group.add(body, head);
        return group;
    }

    pickTarget() {
        return new THREE.Vector3(randBetween(-CONFIG.citySize / 2, CONFIG.citySize / 2), 0, randBetween(-CONFIG.citySize / 2, CONFIG.citySize / 2));
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
    }
}

class Player {
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
    }

    createMesh() {
        const group = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35, 0.4, 1.4, 8),
            new THREE.MeshStandardMaterial({ color: 0x2f6fd6 })
        );
        body.position.y = 0.7;
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.3, 12, 12),
            new THREE.MeshStandardMaterial({ color: 0xf1c7a2 })
        );
        head.position.y = 1.6;
        group.add(body, head);
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
    }
}

class Collectible {
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

class Roadblock {
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

class MissionManager {
    constructor(game) {
        this.game = game;
        this.missions = this.createMissions();
        this.currentIndex = 0;
        this.stepIndex = 0;
        this.timer = 0;
        this.marker = null;
        this.markerPulse = 0;
        this.startMission(0);
    }

    createMissions() {
        return [
            {
                id: 'courier',
                title: 'Prologue: The Courier',
                steps: [
                    {
                        type: 'reach',
                        label: 'Meet Mina at the Arcade',
                        position: LOCATIONS.arcade,
                        radius: 12,
                        onStart: () => this.game.ui.showStory('Mina: You ready to run HEATLINE? I left a package at the arcade.'),
                        reward: 150
                    },
                    {
                        type: 'enterVehicle',
                        label: 'Steal a ride from the boulevard',
                        onStart: () => this.game.ui.showStory('Mina: Wheels first. No questions.')
                    },
                    {
                        type: 'reach',
                        label: 'Deliver to the Harbor within 90 seconds',
                        position: LOCATIONS.harbor,
                        radius: 14,
                        timer: 90,
                        onStart: () => this.game.ui.showStory('Mina: Keep it clean. The docks are crawling.'),
                        reward: 400
                    }
                ]
            },
            {
                id: 'heat',
                title: 'Chapter 2: Heat Check',
                steps: [
                    {
                        type: 'reach',
                        label: 'Meet Rook at the Foundry',
                        position: LOCATIONS.foundry,
                        radius: 12,
                        onStart: () => this.game.ui.showStory('Rook: You look hungry. Let us see how fast you are.'),
                        reward: 200
                    },
                    {
                        type: 'heat',
                        label: 'Draw attention and survive the chase',
                        heat: 40,
                        onStart: () => {
                            this.game.addHeat(45);
                            this.game.ui.showStory('Rook: Make them notice you. Then lose them.');
                        }
                    },
                    {
                        type: 'loseWanted',
                        label: 'Lose the tail in 120 seconds',
                        timer: 120
                    },
                    {
                        type: 'reach',
                        label: 'Return to the Hideout',
                        position: LOCATIONS.hideout,
                        radius: 12,
                        reward: 600
                    }
                ]
            },
            {
                id: 'cityline',
                title: 'Finale: Cityline',
                steps: [
                    {
                        type: 'reach',
                        label: 'Reach the Skyline Garage',
                        position: LOCATIONS.garage,
                        radius: 12,
                        onStart: () => {
                            this.game.spawnMissionVehicle(LOCATIONS.garage, 'sports');
                            this.game.ui.showStory('Mina: Vortex is parked at the garage. You will know it.' );
                        }
                    },
                    {
                        type: 'enterVehicleType',
                        label: 'Take the Vortex sports car',
                        vehicleType: 'sports'
                    },
                    {
                        type: 'reach',
                        label: 'Checkpoint 1',
                        position: LOCATIONS.checkpoint1,
                        radius: 10,
                        timer: 120
                    },
                    {
                        type: 'reach',
                        label: 'Checkpoint 2',
                        position: LOCATIONS.checkpoint2,
                        radius: 10
                    },
                    {
                        type: 'reach',
                        label: 'Checkpoint 3',
                        position: LOCATIONS.checkpoint3,
                        radius: 10
                    },
                    {
                        type: 'reach',
                        label: 'Finish at Cliffside',
                        position: LOCATIONS.finish,
                        radius: 14,
                        onStart: () => this.game.ui.showStory('Rook: Bring it home. We own this skyline.'),
                        reward: 1200
                    }
                ]
            }
        ];
    }

    startMission(index) {
        this.currentIndex = index;
        this.stepIndex = 0;
        this.timer = 0;
        this.startStep();
    }

    startStep() {
        const step = this.getStep();
        if (!step) {
            return;
        }
        if (step.timer) {
            this.timer = step.timer;
        } else {
            this.timer = 0;
        }
        if (step.onStart) {
            step.onStart();
        }
        this.updateMarker();
        this.updateUI();
    }

    updateMarker() {
        if (this.marker) {
            this.game.scene.remove(this.marker);
            this.marker = null;
        }
        const step = this.getStep();
        if (step && step.position) {
            this.marker = this.createMarker(step.position);
            this.game.scene.add(this.marker);
        }
    }

    createMarker(position) {
        const group = new THREE.Group();
        const cylinder = new THREE.Mesh(
            new THREE.CylinderGeometry(2.4, 2.4, 0.6, 20),
            new THREE.MeshStandardMaterial({ color: 0x4fc3ff, emissive: 0x1c4b66 })
        );
        cylinder.position.y = 0.3;
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(3, 0.15, 8, 30),
            new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0x593515 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.2;
        group.add(cylinder, ring);
        group.position.copy(position);
        return group;
    }

    getStep() {
        const mission = this.missions[this.currentIndex];
        if (!mission) {
            return null;
        }
        return mission.steps[this.stepIndex];
    }

    getCurrentTarget() {
        const step = this.getStep();
        if (step && step.position) {
            return step.position.clone();
        }
        return null;
    }

    updateUI() {
        const mission = this.missions[this.currentIndex];
        const step = this.getStep();
        const timerText = this.timer > 0 ? `Time: ${Math.ceil(this.timer)}s` : '';
        this.game.ui.setMission(mission.title, step ? step.label : 'Complete', timerText);
    }

    stepCompleted() {
        const completedStep = this.getStep();
        if (completedStep && completedStep.reward) {
            this.game.player.cash += completedStep.reward;
        }
        this.stepIndex += 1;
        const mission = this.missions[this.currentIndex];
        if (this.stepIndex >= mission.steps.length) {
            if (this.currentIndex < this.missions.length - 1) {
                this.currentIndex += 1;
                this.stepIndex = 0;
                this.game.ui.notify('Mission complete! Next chapter unlocked.');
            } else {
                this.game.ui.notify('You own HEATLINE. Story complete.');
            }
        }
        this.startStep();
    }

    restartStep() {
        const step = this.getStep();
        if (!step) {
            return;
        }
        this.game.ui.notify('Mission step restarted');
        this.startStep();
    }

    update(dt) {
        const step = this.getStep();
        if (!step) {
            return;
        }

        if (this.timer > 0) {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.timer = 0;
                this.game.ui.notify('Time is up. Try again.');
                this.startStep();
                return;
            }
        }

        let completed = false;
        const playerPos = this.game.getFocusPosition();

        if (step.type === 'reach' && step.position) {
            if (playerPos.distanceTo(step.position) <= step.radius) {
                completed = true;
            }
        } else if (step.type === 'enterVehicle') {
            completed = Boolean(this.game.currentVehicle);
        } else if (step.type === 'enterVehicleType') {
            completed = Boolean(this.game.currentVehicle && this.game.currentVehicle.type === step.vehicleType);
        } else if (step.type === 'heat') {
            if (this.game.heat >= step.heat) {
                completed = true;
            }
        } else if (step.type === 'loseWanted') {
            if (this.game.getWantedLevel() === 0) {
                completed = true;
            }
        }

        if (completed) {
            this.stepCompleted();
        }

        if (this.marker) {
            this.markerPulse += dt * 2;
            this.marker.position.y = Math.sin(this.markerPulse) * 0.6;
        }

        this.updateUI();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x122035);
        this.scene.fog = new THREE.Fog(0x122035, 50, 520);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);
        this.cameraYaw = 0;
        this.cameraPitch = 0.2;
        this.cameraDistance = 14;
        this.cameraMode = 0;

        this.clock = new THREE.Clock();
        this.input = new Input(this.canvas);
        this.ui = new UI();
        this.world = new World(this.scene);
        this.player = new Player(this.scene);
        this.vehicles = [];
        this.pedestrians = [];
        this.collectibles = [];
        this.roadblocks = [];
        this.currentVehicle = null;
        this.heat = 0;
        this.lastDamageTime = 0;
        this.rep = 0;
        this.currentDistrict = null;
        this.districtHeatMult = 1;
        this.weatherState = 'Clear';
        this.weatherTimer = 20;
        this.weatherGrip = 1;
        this.minimapZoom = 1;
        this.cameraShake = 0;
        this.speedingTimer = 0;
        this.roadblockCooldown = 0;
        this.wasWanted = false;
        this.garageHint = 0;
        this.timeOfDay = 0.28;
        this.timeSpeed = 0.004;

        this.minimap = document.getElementById('minimapCanvas');
        this.minimapCtx = this.minimap.getContext('2d');
        this.minimapScale = this.minimap.width / CONFIG.citySize;
        this.minimapBase = this.createMinimapBase();

        this.spawnTraffic();
        this.spawnPedestrians();
        this.spawnCollectibles(18);

        this.missions = new MissionManager(this);

        this.setupLights();
        this.bindEvents();
        this.started = false;
        this.debugEl = document.getElementById('debug');
        this.debugEnabled = false;
        this.debugMessage = '';
        this.fps = 0;
        this.fpsFrames = 0;
        this.fpsTimer = 0;
        this.safehouseHint = 0;
        this.runDiagnostics();
        window.HEATLINE = this;

        this.updateCamera(0);
        this.animate();
    }

    setupLights() {
        this.hemiLight = new THREE.HemisphereLight(0x9cb5ff, 0x1b1f2a, 0.8);
        this.scene.add(this.hemiLight);
        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.dirLight.position.set(80, 120, 40);
        this.scene.add(this.dirLight);
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        const startButton = document.getElementById('start-button');
        window.__heatlineStart = () => this.startGame();

        if (startButton) {
            startButton.addEventListener('click', () => this.startGame());
        }

        if (window.__heatlineStartRequested) {
            this.startGame();
        }
    }

    startGame() {
        if (this.started) {
            return;
        }
        const startScreen = document.getElementById('start-screen');
        if (startScreen) {
            startScreen.classList.add('hidden');
        }
        this.started = true;
        if (this.player && this.player.mesh) {
            this.player.mesh.visible = !this.currentVehicle;
        }
        try {
            this.canvas.requestPointerLock();
        } catch (error) {
            this.ui.notify('Pointer lock blocked. Click the canvas to lock mouse.');
        }
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

    toggleVehicle() {
        if (this.currentVehicle) {
            this.currentVehicle.aiType = 'traffic';
            const exitOffset = new THREE.Vector3(
                Math.sin(this.currentVehicle.heading + Math.PI / 2) * 2.2,
                0,
                Math.cos(this.currentVehicle.heading + Math.PI / 2) * 2.2
            );
            this.player.position.copy(this.currentVehicle.position.clone().add(exitOffset));
            this.currentVehicle = null;
            this.player.mesh.visible = true;
            this.ui.notify('Exited vehicle');
            return;
        }

        let nearest = null;
        let minDist = 4;
        for (const vehicle of this.vehicles) {
            const distance = vehicle.position.distanceTo(this.player.position);
            if (distance < minDist && vehicle.aiType !== 'police') {
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
            this.ui.notify('Vehicle taken');
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
            this.toggleDebug();
        }
        if (this.input.wasPressed('KeyM')) {
            this.missions.restartStep();
        }
        if (this.input.wasPressed('KeyR')) {
            this.player.position.copy(LOCATIONS.hideout);
            if (this.currentVehicle) {
                this.currentVehicle.position.copy(LOCATIONS.hideout);
            }
            this.ui.notify('Reset to hideout');
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
                this.ui.notify('Data chip secured');
            }
        }

        this.updateCollisions(dt);
        if (this.currentVehicle && this.currentVehicle.isDestroyed) {
            this.ui.notify('Vehicle totaled!');
            this.toggleVehicle();
        }
        this.updateSafehouse(dt);
        this.updateGarage(dt);
        this.updateHeat(dt);
        this.updatePolice();
        this.updateRoadblocks(dt);
        this.missions.update(dt);
        this.updateCamera(dt);
        this.updateHUD();
        this.updateMinimap();
        this.updateDebug(dt);
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

    updateDistrict() {
        const playerPos = this.getFocusPosition();
        const district = this.getDistrict(playerPos);
        if (!this.currentDistrict || this.currentDistrict.name !== district.name) {
            this.currentDistrict = district;
            this.ui.notify(`Entering ${district.name}`);
        }
        this.districtHeatMult = district.heat;
        this.ui.updateDistrict(`${district.name} x${district.heat.toFixed(1)}`);
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
        this.ui.updateWeather(this.weatherState === 'Rain' ? 'Rain' : '');
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
                this.ui.notify('Speeding bonus +$25');
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
        this.ui.notify('Roadblock reported');
    }

    updateCollisions(dt) {
        const playerPos = this.getFocusPosition();
        const playerRadius = this.currentVehicle ? 1.9 : 0.8;

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
                this.ui.notify('Pedestrian hit');
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
            this.ui.notify('Respawned at hideout');
        }
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
                this.ui.notify('Safehouse: heat cooling down');
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
                this.ui.notify('Garage service active');
                this.garageHint = 5;
            }
        } else if (this.garageHint <= 0) {
            this.ui.notify('Garage: insufficient cash');
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
                this.ui.notify('Heat lost +$40');
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

    updateHUD() {
        const speed = this.currentVehicle ? Math.abs(this.currentVehicle.speed) * 3.6 : this.player.speed;
        const mode = this.currentVehicle ? 'Driving' : 'On Foot';
        const vehicleHealth = this.currentVehicle ? this.currentVehicle.health : 100;
        const boost = this.currentVehicle ? this.currentVehicle.boost : 100;
        this.ui.updateStats({
            speed,
            heat: this.heat,
            mode,
            cash: this.player.cash,
            rep: this.rep,
            health: this.player.health,
            stamina: this.player.stamina,
            boost,
            vehicleHealth
        });
        this.ui.updateWanted(this.getWantedLevel());

        const wanted = this.getWantedLevel();
        if (wanted === 0) {
            this.ui.updatePursuit('');
        } else {
            const closestPolice = this.getClosestPoliceDistance();
            if (closestPolice < 50) {
                this.ui.updatePursuit('Pursuit');
            } else {
                this.ui.updatePursuit('Searching');
            }
        }

        const target = this.missions.getCurrentTarget();
        if (target) {
            const playerPos = this.getFocusPosition();
            const toTarget = new THREE.Vector3().subVectors(target, playerPos);
            const distance = toTarget.length();
            const angleToTarget = Math.atan2(toTarget.x, toTarget.z);
            const angle = angleToTarget - this.player.heading;
            this.ui.updateCompass({ visible: true, angle, distance });
        } else {
            this.ui.updateCompass({ visible: false, angle: 0, distance: 0 });
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

    createMinimapBase() {
        const canvas = document.createElement('canvas');
        canvas.width = this.minimap.width;
        canvas.height = this.minimap.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0c111b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const center = canvas.width / 2;
        ctx.strokeStyle = '#1f2a3b';
        ctx.lineWidth = 2;
        for (const node of this.world.roadNodes) {
            const x = center + node.x * this.minimapScale;
            const y = center + node.z * this.minimapScale;
            ctx.fillStyle = '#1a2230';
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

    updateMinimap() {
        const ctx = this.minimapCtx;
        ctx.clearRect(0, 0, this.minimap.width, this.minimap.height);
        const playerPos = this.getFocusPosition();
        const speed = this.currentVehicle ? Math.abs(this.currentVehicle.speed) * 3.6 : this.player.speed;
        const targetZoom = this.currentVehicle ? clamp(1.2 + speed / 140, 1.2, 1.6) : 1;
        this.minimapZoom = lerp(this.minimapZoom, targetZoom, 0.08);
        const scale = this.minimapScale * this.minimapZoom;

        ctx.save();
        ctx.translate(this.minimap.width / 2, this.minimap.height / 2);
        ctx.scale(this.minimapZoom, this.minimapZoom);
        ctx.drawImage(
            this.minimapBase,
            -this.minimapBase.width / 2 - playerPos.x * this.minimapScale,
            -this.minimapBase.height / 2 - playerPos.z * this.minimapScale
        );
        ctx.restore();

        const center = this.minimap.width / 2;

        ctx.fillStyle = '#ffd27a';
        for (const vehicle of this.vehicles) {
            if (vehicle === this.currentVehicle) {
                continue;
            }
            const x = center + (vehicle.position.x - playerPos.x) * scale;
            const y = center + (vehicle.position.z - playerPos.z) * scale;
            if (x < 0 || y < 0 || x > this.minimap.width || y > this.minimap.height) {
                continue;
            }
            ctx.fillRect(x - 2, y - 2, 4, 4);
        }

        ctx.fillStyle = '#4fc3ff';
        for (const ped of this.pedestrians) {
            const x = center + (ped.position.x - playerPos.x) * scale;
            const y = center + (ped.position.z - playerPos.z) * scale;
            if (x < 0 || y < 0 || x > this.minimap.width || y > this.minimap.height) {
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

    runDiagnostics() {
        const results = [];
        const assert = (label, condition) => {
            results.push({ label, ok: Boolean(condition) });
        };

        assert('Canvas exists', Boolean(this.canvas));
        assert('Start button exists', Boolean(document.getElementById('start-button')));
        assert('Minimap context', Boolean(this.minimapCtx));
        assert('World bounds', this.world.size > 0);
        assert('Road nodes', this.world.roadNodes.length > 10);
        assert('Buildings', this.world.buildingBounds.length > 10);
        assert('Traffic vehicles', this.vehicles.length >= CONFIG.trafficCount);
        assert('Pedestrians', this.pedestrians.length >= CONFIG.pedestrianCount);
        assert('Collectibles', this.collectibles.length > 0);
        assert('Mission steps', this.missions.missions.every((mission) => mission.steps.length > 0));
        assert('No NaN player', Number.isFinite(this.player.position.x));

        const failed = results.filter((item) => !item.ok);
        if (failed.length > 0) {
            this.debugMessage = `Diagnostics failed: ${failed.map((item) => item.label).join(', ')}`;
            this.ui.notify('Diagnostics found issues. Toggle debug for details.');
        } else {
            this.debugMessage = 'Diagnostics passed.';
        }

        window.__heatlineDiagnostics = results;
        console.table(results);
    }

    toggleDebug() {
        this.debugEnabled = !this.debugEnabled;
        if (this.debugEl) {
            this.debugEl.classList.toggle('hidden', !this.debugEnabled);
        }
    }

    updateDebug(dt) {
        if (!this.debugEnabled || !this.debugEl) {
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
        this.debugEl.textContent = [
            `FPS: ${this.fps}`,
            `Started: ${this.started}`,
            `PointerLock: ${document.pointerLockElement === this.canvas}`,
            `Heat: ${Math.round(this.heat)} (Wanted ${wanted})`,
            `District: ${this.currentDistrict ? this.currentDistrict.name : 'n/a'}`,
            `Weather: ${this.weatherState}`,
            `Vehicles: ${this.vehicles.length}`,
            `Pedestrians: ${this.pedestrians.length}`,
            `Pos: ${playerPos.x.toFixed(1)}, ${playerPos.z.toFixed(1)}`,
            this.debugMessage
        ].join('\\n');
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

    const boot = () => {
        try {
            new Game();
            window.__heatlineBooted = true;
            if (subtitle) {
                subtitle.textContent = 'Ready to roll.';
            }
        } catch (error) {
            console.error('Boot error:', error);
            showBootError(`Boot error: ${error && error.message ? error.message : 'Unknown error'}`);
        }
    };

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    boot();
} else {
    window.addEventListener('load', boot);
}
})();
