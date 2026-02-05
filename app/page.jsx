'use client';

import { useEffect, useRef, useState } from 'react';
import { Game } from '../src/game/Game';

const initialHud = {
  speed: 0,
  heat: 0,
  mode: 'On Foot',
  cash: 0,
  rep: 0,
  health: 100,
  stamina: 100,
  boost: 100,
  vehicleHealth: 100,
  wanted: 0,
  pursuit: '',
  district: '',
  weather: '',
  compass: { visible: false, angle: 0, distance: 0 },
  mission: { title: 'Loading...', step: 'Initializing world', timer: '' },
  debug: ''
};

export default function Home() {
  const canvasRef = useRef(null);
  const minimapRef = useRef(null);
  const gameRef = useRef(null);
  const storyTimer = useRef(null);
  const notifyTimer = useRef(null);

  const [started, setStarted] = useState(false);
  const [hud, setHud] = useState(initialHud);
  const [story, setStory] = useState('');
  const [notification, setNotification] = useState('');
  const [startMessage, setStartMessage] = useState('Ready to burn through the city grid.');

  useEffect(() => {
    if (!canvasRef.current) {
      return undefined;
    }

    const game = new Game({
      canvas: canvasRef.current,
      minimap: minimapRef.current,
      onHud: setHud,
      onStory: (text, duration = 5000) => {
        window.clearTimeout(storyTimer.current);
        setStory(text);
        storyTimer.current = window.setTimeout(() => setStory(''), duration);
      },
      onNotification: (text, duration = 2600) => {
        window.clearTimeout(notifyTimer.current);
        setNotification(text);
        notifyTimer.current = window.setTimeout(() => setNotification(''), duration);
      },
      onBootMessage: (text) => setStartMessage(text),
      onStart: () => setStarted(true)
    });

    gameRef.current = game;

    return () => {
      game.dispose();
      window.clearTimeout(storyTimer.current);
      window.clearTimeout(notifyTimer.current);
    };
  }, []);

  const handleStart = () => {
    setStarted(true);
    gameRef.current?.startGame();
  };

  return (
    <main>
      <canvas id="game-canvas" ref={canvasRef} tabIndex={0} />
      <div id="hud">
        {!started && (
          <div id="start-screen">
            <div className="logo">HEATLINE</div>
            <div className="subtitle">{startMessage}</div>
            <button id="start-button" onClick={handleStart}>Start Story</button>
            <div className="hint">Click to lock mouse. Press Esc to release.</div>
          </div>
        )}

        <div id="mission" className="panel glow">
          <div id="mission-title">{hud.mission.title}</div>
          <div id="mission-step">{hud.mission.step}</div>
          <div id="mission-timer">{hud.mission.timer}</div>
        </div>

        <div id="wanted">{'★'.repeat(hud.wanted)}</div>
        <div id="pursuit">{hud.pursuit}</div>
        <div id="district">{hud.district}</div>
        <div id="weather">{hud.weather}</div>

        <div id="compass" className={`panel ${hud.compass.visible ? '' : 'hidden'}`}>
          <div
            className="arrow"
            id="compass-arrow"
            style={{ transform: `rotate(${hud.compass.angle}rad)` }}
          />
          <div id="compass-text">Objective {Math.round(hud.compass.distance)}m</div>
        </div>

        <div id="stats" className="panel">
          <div className="stat-row"><span>Speed</span><span id="speed">{Math.floor(hud.speed)}</span></div>
          <div className="stat-row"><span>Heat</span><span id="heat">{Math.floor(hud.heat)}</span></div>
          <div className="stat-row"><span>Mode</span><span id="mode">{hud.mode}</span></div>
          <div className="stat-row"><span>Cash</span><span id="cash">${hud.cash}</span></div>
          <div className="stat-row"><span>Rep</span><span id="rep">{Math.floor(hud.rep)}</span></div>
          <div style={{ marginTop: 10 }}>Health</div>
          <div className="bar" id="health-bar"><span style={{ width: `${hud.health}%` }} /></div>
          <div style={{ marginTop: 8 }}>Stamina</div>
          <div className="bar" id="stamina-bar"><span style={{ width: `${hud.stamina}%` }} /></div>
          <div style={{ marginTop: 8 }}>Boost</div>
          <div className="bar" id="boost-bar"><span style={{ width: `${hud.boost}%` }} /></div>
          <div style={{ marginTop: 8 }}>Vehicle</div>
          <div className="bar" id="vehicle-bar"><span style={{ width: `${hud.vehicleHealth}%` }} /></div>
        </div>

        <div id="story" className={`panel ${story ? '' : 'hidden'}`}>{story}</div>
        <div id="notification" className={`panel ${notification ? '' : 'hidden'}`}>{notification}</div>

        <div id="minimap" className="panel">
          <canvas ref={minimapRef} width="200" height="200" />
        </div>

        <div id="help" className="panel">
          <strong>Controls</strong><br />
          WASD - Move / Drive<br />
          Mouse - Look<br />
          Shift - Sprint / Boost<br />
          Space - Handbrake<br />
          F - Enter/Exit Vehicle<br />
          C - Camera Mode<br />
          M - Restart Mission Step<br />
          R - Reset Position<br />
          ~ - Debug
        </div>

        <div id="debug" className={`panel ${hud.debug ? '' : 'hidden'}`}>{hud.debug}</div>
      </div>
    </main>
  );
}
