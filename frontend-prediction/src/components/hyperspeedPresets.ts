export interface HyperspeedPreset {
  name: string;
  description: string;
  backgroundColor: number;
  fogColor: number;
  fogDensity: number;
  particleCount: number;
  particleSize: number;
  particleOpacity: number;
  particleSpread: number;
  particleColors: number[];
  speed: number;
  trailLength: number;
  cameraShake: boolean;
  cameraRotation: number;
}

export const HYPERSPEED_PRESETS: Record<string, HyperspeedPreset> = {
  cyberpunk: {
    name: 'Cyberpunk',
    description: 'Neon-lit futuristic cityscape',
    backgroundColor: 0x0a0a1a,
    fogColor: 0x1a0a2e,
    fogDensity: 0.012,
    particleCount: 8000,
    particleSize: 2.5,
    particleOpacity: 0.9,
    particleSpread: 80,
    particleColors: [
      0xff00ff, // Magenta
      0x00ffff, // Cyan
      0xff0080, // Hot pink
      0x0080ff, // Electric blue
      0xff00aa, // Neon pink
    ],
    speed: 1.2,
    trailLength: 5,
    cameraShake: true,
    cameraRotation: 0.0005,
  },

  akira: {
    name: 'Akira',
    description: 'Red-dominant neo-Tokyo aesthetic',
    backgroundColor: 0x0d0000,
    fogColor: 0x1a0000,
    fogDensity: 0.015,
    particleCount: 10000,
    particleSize: 2.0,
    particleOpacity: 0.85,
    particleSpread: 70,
    particleColors: [
      0xff0000, // Pure red
      0xff3333, // Bright red
      0xff6600, // Red-orange
      0xff0033, // Deep red
      0xcc0000, // Dark red
    ],
    speed: 1.5,
    trailLength: 8,
    cameraShake: true,
    cameraRotation: 0.001,
  },

  golden: {
    name: 'Golden',
    description: 'Warm golden and amber tones',
    backgroundColor: 0x1a1000,
    fogColor: 0x2a1800,
    fogDensity: 0.01,
    particleCount: 6000,
    particleSize: 3.0,
    particleOpacity: 0.8,
    particleSpread: 90,
    particleColors: [
      0xffaa00, // Golden
      0xffcc00, // Bright gold
      0xff8800, // Orange-gold
      0xffdd55, // Light gold
      0xcc8800, // Deep gold
    ],
    speed: 0.9,
    trailLength: 4,
    cameraShake: false,
    cameraRotation: 0.0003,
  },

  split: {
    name: 'Split',
    description: 'Blue and orange contrast',
    backgroundColor: 0x000510,
    fogColor: 0x001020,
    fogDensity: 0.011,
    particleCount: 7000,
    particleSize: 2.2,
    particleOpacity: 0.85,
    particleSpread: 85,
    particleColors: [
      0x0066ff, // Blue
      0x0088ff, // Light blue
      0xff6600, // Orange
      0xff8833, // Light orange
      0x00aaff, // Cyan-blue
      0xff4400, // Deep orange
    ],
    speed: 1.1,
    trailLength: 6,
    cameraShake: false,
    cameraRotation: 0.0004,
  },

  highway: {
    name: 'Highway',
    description: 'Classic white and yellow road lines',
    backgroundColor: 0x000000,
    fogColor: 0x0a0a0a,
    fogDensity: 0.008,
    particleCount: 5000,
    particleSize: 3.5,
    particleOpacity: 0.95,
    particleSpread: 60,
    particleColors: [
      0xffffff, // White
      0xffff00, // Yellow
      0xffff88, // Light yellow
      0xeeeeee, // Off-white
    ],
    speed: 1.8,
    trailLength: 10,
    cameraShake: false,
    cameraRotation: 0,
  },

  matrix: {
    name: 'Matrix',
    description: 'Green digital rain',
    backgroundColor: 0x000000,
    fogColor: 0x001000,
    fogDensity: 0.013,
    particleCount: 9000,
    particleSize: 2.0,
    particleOpacity: 0.9,
    particleSpread: 75,
    particleColors: [
      0x00ff00, // Bright green
      0x00cc00, // Green
      0x00ff88, // Light green
      0x008800, // Dark green
      0x00ffaa, // Cyan-green
    ],
    speed: 1.3,
    trailLength: 7,
    cameraShake: false,
    cameraRotation: 0.0002,
  },
};

export const PRESET_KEYS = Object.keys(HYPERSPEED_PRESETS) as Array<keyof typeof HYPERSPEED_PRESETS>;

export const getPreset = (key: string): HyperspeedPreset => {
  return HYPERSPEED_PRESETS[key] || HYPERSPEED_PRESETS.cyberpunk;
};
