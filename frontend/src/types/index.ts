export interface TelemetryPoint {
  time: number;
  altitude: number;
  velocity: number;
  apoapsis: number;
  periapsis: number;
  eccentricity: number;
  inclination: number;
  raan: number;
  semiMajorAxis: number;
  x: number;
  y: number;
  z: number;
  stageIndex: number;
}

export interface SimulationResult {
  id: string;
  rocketName: string;
  orbitAchieved: boolean;
  finalTime: number;
  telemetry: TelemetryPoint[];
}

export interface RocketPreset {
  id: string;
  name: string;
  manufacturer: string;
  country: string;
  height: number;
  diameter: number;
  launchMass: number;
  payloadToLEO: number;
  costPerLaunch: number | null;
  stageCount: number;
  stages?: StagePreset[];
}

export interface StagePreset {
  name: string;
  dryMass: number;
  fuelMass: number;
  burnRate: number;
  exhaustVelocity: number;
  isp: number;
  referenceArea: number;
  dragCoefficient: number;
}

export interface SimulationRequest {
  rocketId?: string;
  targetAltitude: number;
  maxG: number;
  dt: number;
  duration: number;
  integratorType: number;
  guidanceType: number;
  timeWarp: number;
  customStages?: StageRequest[];
}

export interface StageRequest {
  dryMass: number;
  fuelMass: number;
  burnRate: number;
  exhaustVelocity: number;
  referenceArea: number;
  dragCoefficient: number;
}

export interface StageEvent {
  time: number;
  previousStage: number;
  newStage: number;
  description: string;
}

export type SimulationState = 'idle' | 'connecting' | 'running' | 'complete' | 'failed';

export interface SavedSimulation {
  id: string;
  rocketName: string;
  targetAltitude: number;
  orbitAchieved: boolean;
  finalTime: number;
  createdAt: string;
  telemetryCount: number;
  eventsCount: number;
}

export interface SavedSimulationDetail {
  id: string;
  rocketId?: string;
  rocketName: string;
  targetAltitude: number;
  orbitAchieved: boolean;
  finalTime: number;
  telemetry: TelemetryPoint[];
  events: StageEvent[];
  createdAt: string;
}
