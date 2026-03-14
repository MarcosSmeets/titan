import { useState, useEffect } from 'react';
import HeroSection from '../components/HeroSection';
import RocketBuilderModal from '../components/RocketBuilder';
import { fetchRockets } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSimulationContext } from '../context/SimulationContext';
import { useNavigate } from 'react-router-dom';
import type { RocketPreset, SimulationRequest } from '../types';

const FALLBACK_ROCKETS: RocketPreset[] = [
  { id: 'falcon9', name: 'Falcon 9', manufacturer: 'SpaceX', country: 'USA', height: 70, diameter: 3.7, launchMass: 549054, payloadToLEO: 22800, costPerLaunch: 67, stageCount: 2 },
  { id: 'saturnv', name: 'Saturn V', manufacturer: 'Boeing/NA/Douglas', country: 'USA', height: 110.6, diameter: 10.1, launchMass: 2970000, payloadToLEO: 140000, costPerLaunch: 1160, stageCount: 3 },
  { id: 'electron', name: 'Electron', manufacturer: 'Rocket Lab', country: 'NZ/USA', height: 18, diameter: 1.2, launchMass: 12550, payloadToLEO: 300, costPerLaunch: 7.5, stageCount: 2 },
  { id: 'ariane5', name: 'Ariane 5', manufacturer: 'Airbus/Safran', country: 'Europe', height: 53, diameter: 5.4, launchMass: 777000, payloadToLEO: 21000, costPerLaunch: 178, stageCount: 2 },
  { id: 'starship', name: 'Starship', manufacturer: 'SpaceX', country: 'USA', height: 121, diameter: 9, launchMass: 5000000, payloadToLEO: 150000, costPerLaunch: null, stageCount: 2 },
];

export default function LaunchPage() {
  const [rockets, setRockets] = useState<RocketPreset[]>([]);
  const [showRocketBuilder, setShowRocketBuilder] = useState(false);
  const { user } = useAuth();
  const { handleLaunch, handleReplay } = useSimulationContext();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRockets()
      .then(setRockets)
      .catch(() => setRockets(FALLBACK_ROCKETS));
  }, []);

  const onLaunch = async (request: SimulationRequest) => {
    navigate('/simulation');
    await handleLaunch(request);
  };

  const onReplay = (
    telemetry: Parameters<typeof handleReplay>[0],
    events: Parameters<typeof handleReplay>[1],
    name: string,
    orbitAchieved: boolean,
    finalTime: number
  ) => {
    handleReplay(telemetry, events, name, orbitAchieved, finalTime);
    navigate('/simulation');
  };

  return (
    <>
      <HeroSection
        rockets={rockets}
        onLaunch={onLaunch}
        onReplay={onReplay}
        onBuildCustom={user ? () => setShowRocketBuilder(true) : undefined}
      />
      {showRocketBuilder && (
        <RocketBuilderModal
          onClose={() => setShowRocketBuilder(false)}
          onLaunch={(request) => {
            setShowRocketBuilder(false);
            onLaunch(request);
          }}
        />
      )}
    </>
  );
}
