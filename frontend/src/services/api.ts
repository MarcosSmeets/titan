import type { RocketPreset, SimulationRequest, SimulationResult, SavedSimulation, SavedSimulationDetail, CustomRocket } from '../types';

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

export async function fetchSimulations(): Promise<SavedSimulation[]> {
  const res = await fetch(`${API_BASE}/simulations`);
  if (!res.ok) throw new Error('Failed to fetch simulations');
  return res.json();
}

export async function fetchSimulationById(id: string): Promise<SavedSimulationDetail> {
  const res = await fetch(`${API_BASE}/simulations/${id}`);
  if (!res.ok) throw new Error('Simulation not found');
  return res.json();
}

export async function deleteSimulation(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/simulations/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete simulation');
}

// Custom rockets
export async function fetchCustomRockets(): Promise<CustomRocket[]> {
  const res = await fetch(`${API_BASE}/custom-rockets`);
  if (!res.ok) throw new Error('Failed to fetch custom rockets');
  return res.json();
}

export async function saveCustomRocket(name: string, stages: CustomRocket['stages']): Promise<{ id: string; name: string }> {
  const res = await fetch(`${API_BASE}/custom-rockets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, stages }),
  });
  if (!res.ok) throw new Error('Failed to save custom rocket');
  return res.json();
}

export async function deleteCustomRocket(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/custom-rockets/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete custom rocket');
}
