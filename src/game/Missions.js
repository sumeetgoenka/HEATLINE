import { LOCATIONS } from './constants';

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.missions = this.createMissions();
    this.currentIndex = 0;
    this.stepIndex = 0;
    this.timer = 0;
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
            onStart: () => this.game.story('Mina: You ready to run HEATLINE? I left a package at the arcade.'),
            reward: 150
          },
          {
            type: 'enterVehicle',
            label: 'Steal a ride from the boulevard',
            onStart: () => this.game.story('Mina: Wheels first. No questions.')
          },
          {
            type: 'reach',
            label: 'Deliver to the Harbor within 90 seconds',
            position: LOCATIONS.harbor,
            radius: 14,
            timer: 90,
            onStart: () => this.game.story('Mina: Keep it clean. The docks are crawling.'),
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
            onStart: () => this.game.story('Rook: You look hungry. Let us see how fast you are.'),
            reward: 200
          },
          {
            type: 'heat',
            label: 'Draw attention and survive the chase',
            heat: 40,
            onStart: () => {
              this.game.addHeat(45);
              this.game.story('Rook: Make them notice you. Then lose them.');
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
              this.game.story('Mina: Vortex is parked at the garage. You will know it.');
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
            onStart: () => this.game.story('Rook: Bring it home. We own this skyline.'),
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
    this.timer = step.timer || 0;
    if (step.onStart) {
      step.onStart();
    }
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

  restartStep() {
    this.game.notify('Mission step restarted');
    this.startStep();
  }

  stepCompleted() {
    const completedStep = this.getStep();
    if (completedStep && completedStep.reward) {
      this.game.reward(completedStep.reward);
    }
    this.stepIndex += 1;
    const mission = this.missions[this.currentIndex];
    if (this.stepIndex >= mission.steps.length) {
      if (this.currentIndex < this.missions.length - 1) {
        this.currentIndex += 1;
        this.stepIndex = 0;
        this.game.notify('Mission complete! Next chapter unlocked.');
      } else {
        this.game.notify('You own HEATLINE. Story complete.');
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
        this.game.notify('Time is up. Try again.');
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
  }

  getHudData() {
    const mission = this.missions[this.currentIndex];
    const step = this.getStep();
    return {
      title: mission?.title || 'Story',
      step: step?.label || 'Complete',
      timer: this.timer > 0 ? `Time: ${Math.ceil(this.timer)}s` : ''
    };
  }
}
