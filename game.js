(() => {
    if (!window.THREE) {
        const startButton = document.getElementById('start-button');
        const subtitle = document.querySelector('#start-screen .subtitle');
        if (subtitle) {
            subtitle.textContent = 'Three.js failed to load. Check your network or CDN access.';
        }
        if (startButton) {
            startButton.disabled = true;
            startButton.textContent = 'Load Failed';
        }
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

class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = new Set();
        this.pressed = new Set();
        this.mouse = { dx: 0, dy: 0 };
        this.pointerLocked = false;

        window.addEventListener('keydown', (event) => {
            if (!this.keys.has(event.code)) {
                this.pressed.add(event.code);
            }
            this.keys.add(event.code);
        });

        window.addEventListener('keyup', (event) => {
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
        this.healthBar = document.querySelector('#health-bar span');
        this.staminaBar = document.querySelector('#stamina-bar span');
        this.wanted = document.getElementById('wanted');
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

    updateStats({ speed, heat, mode, cash, health, stamina }) {
        this.speedEl.textContent = Math.floor(speed).toString();
        this.heatEl.textContent = Math.floor(heat).toString();
        this.modeEl.textContent = mode;
        this.cashEl.textContent = `$${cash}`;
        this.healthBar.style.width = `${clamp(health, 0, 100)}%`;
        this.staminaBar.style.width = `${clamp(stamina, 0, 100)}%`;
    }

    updateWanted(level) {
        let stars = '';
        for (let i = 0; i < level; i += 1) {
            stars += '★';
        }
        this.wanted.textContent = stars;
    }
}

class World {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.buildingBounds = [];
        this.roadNodes = [];
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

    updatePlayer(input, dt, world, boost) {
        const forwardInput = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
        const steerInput = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);

        if (forwardInput !== 0) {
            const accel = this.accel * (boost ? 1.2 : 1);
            this.speed += forwardInput * accel * dt;
        } else {
            this.speed *= 0.98;
        }

        if (input.isDown('Space')) {
            this.speed = lerp(this.speed, 0, dt * 4);
        }

        this.speed = clamp(this.speed, -this.maxSpeed * 0.4, this.maxSpeed);

        if (Math.abs(this.speed) > 0.5) {
            this.heading -= steerInput * this.turnRate * dt * Math.sign(this.speed);
        }

        const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
        this.velocity.copy(forward).multiplyScalar(this.speed);
        this.move(dt, world);
    }

    updateTraffic(dt, world, nodes) {
        if (!this.targetNode || this.position.distanceTo(this.targetNode) < 8) {
            this.targetNode = nodes[Math.floor(Math.random() * nodes.length)];
        }

        const toTarget = new THREE.Vector3().subVectors(this.targetNode, this.position);
        const desiredHeading = Math.atan2(toTarget.x, toTarget.z);
        this.heading = angleLerp(this.heading, desiredHeading, dt * 0.8);

        const desiredSpeed = this.maxSpeed * 0.45;
        this.speed = lerp(this.speed, desiredSpeed, dt * 0.6);

        const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
        this.velocity.copy(forward).multiplyScalar(this.speed);

        const probe = this.position.clone().add(forward.clone().multiplyScalar(6));
        if (world.collides(probe, this.radius)) {
            this.heading += Math.PI / 2;
        }

        this.move(dt, world);
    }

    updatePolice(dt, world, targetPosition, nodes) {
        const toTarget = new THREE.Vector3().subVectors(targetPosition, this.position);
        const desiredHeading = Math.atan2(toTarget.x, toTarget.z);
        this.heading = angleLerp(this.heading, desiredHeading, dt * 1.4);
        const desiredSpeed = this.maxSpeed * 0.75;
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
        if (!world.collides(next, this.radius)) {
            this.position.copy(next);
        } else {
            this.speed *= -0.2;
        }

        this.mesh.rotation.y = this.heading;
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

    update(dt, world) {
        if (this.isDown) {
            this.downTimer -= dt;
            if (this.downTimer <= 0) {
                this.isDown = false;
                this.mesh.rotation.z = 0;
                this.target = this.pickTarget();
            }
            return;
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
        if (!world.collides(next, 0.6)) {
            this.position.copy(next);
        } else {
            this.velocity.multiplyScalar(0.2);
        }

        this.speed = this.velocity.length() * 3.6;
        this.mesh.rotation.y = this.heading;
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
        this.currentVehicle = null;
        this.heat = 0;
        this.lastDamageTime = 0;

        this.minimap = document.getElementById('minimapCanvas');
        this.minimapCtx = this.minimap.getContext('2d');
        this.minimapScale = this.minimap.width / CONFIG.citySize;
        this.minimapBase = this.createMinimapBase();

        this.spawnTraffic();
        this.spawnPedestrians();

        this.missions = new MissionManager(this);

        this.setupLights();
        this.bindEvents();
        this.started = false;

        this.updateCamera(0);
        this.animate();
    }

    setupLights() {
        const hemi = new THREE.HemisphereLight(0x9cb5ff, 0x1b1f2a, 0.8);
        this.scene.add(hemi);
        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(80, 120, 40);
        this.scene.add(dir);
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        document.getElementById('start-button').addEventListener('click', () => {
            document.getElementById('start-screen').classList.add('hidden');
            this.started = true;
            this.canvas.requestPointerLock();
        });
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
        this.heat = clamp(this.heat + amount, 0, CONFIG.maxHeat);
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

        this.camera.position.copy(target).add(offset);
        this.camera.position.y += height;
        this.camera.lookAt(target.x, target.y + 2, target.z);
    }

    update(dt) {
        if (this.input.wasPressed('KeyF')) {
            this.toggleVehicle();
        }
        if (this.input.wasPressed('KeyC')) {
            this.cameraMode = (this.cameraMode + 1) % 3;
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
            this.currentVehicle.updatePlayer(this.input, dt, this.world, boost);
            this.player.position.copy(this.currentVehicle.position);
            this.player.heading = this.currentVehicle.heading;
            this.player.speed = Math.abs(this.currentVehicle.speed) * 3.6;
        } else {
            this.player.updateOnFoot(this.input, dt, this.world, this.cameraYaw);
        }

        for (const vehicle of this.vehicles) {
            if (vehicle === this.currentVehicle) {
                continue;
            }
            if (vehicle.aiType === 'traffic') {
                vehicle.updateTraffic(dt, this.world, this.world.roadNodes);
            } else if (vehicle.aiType === 'police') {
                vehicle.updatePolice(dt, this.world, this.getFocusPosition(), this.world.roadNodes);
            }
        }

        for (const ped of this.pedestrians) {
            ped.update(dt, this.world);
        }

        this.updateCollisions(dt);
        this.updateHeat(dt);
        this.updatePolice();
        this.missions.update(dt);
        this.updateCamera(dt);
        this.updateHUD();
        this.updateMinimap();
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
                }
                this.ui.notify('Pedestrian hit');
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
                }
                this.addHeat(6);
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
            }
            this.ui.notify('Respawned at hideout');
        }
    }

    updateHeat(dt) {
        const wanted = this.getWantedLevel();
        if (wanted === 0) {
            this.heat = clamp(this.heat - CONFIG.heatDecay * dt, 0, CONFIG.maxHeat);
            return;
        }

        const playerPos = this.getFocusPosition();
        const policeNearby = this.vehicles.some((vehicle) =>
            vehicle.aiType === 'police' && vehicle.position.distanceTo(playerPos) < 60
        );

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
        this.ui.updateStats({
            speed,
            heat: this.heat,
            mode,
            cash: this.player.cash,
            health: this.player.health,
            stamina: this.player.stamina
        });
        this.ui.updateWanted(this.getWantedLevel());
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
        const offsetX = -playerPos.x * this.minimapScale;
        const offsetY = -playerPos.z * this.minimapScale;
        ctx.drawImage(this.minimapBase, offsetX, offsetY);

        const center = this.minimap.width / 2;

        ctx.fillStyle = '#ffd27a';
        for (const vehicle of this.vehicles) {
            if (vehicle === this.currentVehicle) {
                continue;
            }
            const x = center + (vehicle.position.x - playerPos.x) * this.minimapScale;
            const y = center + (vehicle.position.z - playerPos.z) * this.minimapScale;
            if (x < 0 || y < 0 || x > this.minimap.width || y > this.minimap.height) {
                continue;
            }
            ctx.fillRect(x - 2, y - 2, 4, 4);
        }

        ctx.fillStyle = '#4fc3ff';
        for (const ped of this.pedestrians) {
            const x = center + (ped.position.x - playerPos.x) * this.minimapScale;
            const y = center + (ped.position.z - playerPos.z) * this.minimapScale;
            if (x < 0 || y < 0 || x > this.minimap.width || y > this.minimap.height) {
                continue;
            }
            ctx.fillRect(x - 1, y - 1, 2, 2);
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

    animate() {
        const dt = Math.min(this.clock.getDelta(), 0.05);
        if (this.started) {
            this.update(dt);
        }
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(() => this.animate());
    }
}

window.addEventListener('load', () => {
    new Game();
});
})();
