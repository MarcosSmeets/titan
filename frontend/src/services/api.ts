import type { RocketPreset, SimulationRequest, SimulationResult } from '../types';

const API_BASE = '/api';

export async function fetchRockets(): Promise<RocketPreset[]> {
  const res = await fetch(`${API_BASE}/rockets`);
  if (!res.ok) throw new Error('Failed to fetch rockets');
  return res.json();
}

export async function fetchRocket(id: string): Promise<RocketPreset> {
  const res = await fetch(`${API_BASE}/rockets/${id}`);
  if (!res.ok) throw new Error('Rocket not found');
  return res.json();
}

export async function runSimulation(request: SimulationRequest): Promise<SimulationResult> {
  const res = await fetch(`${API_BASE}/simulations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error('Simulation failed');
  return res.json();
}

export async function compareRockets(
  rocketIds: string[],
  targetAltitude: number = 200000
): Promise<{ simulations: SimulationResult[] }> {
  const res = await fetch(`${API_BASE}/simulations/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rocketIds, targetAltitude }),
  });
  if (!res.ok) throw new Error('Comparison failed');
  return res.json();
}
