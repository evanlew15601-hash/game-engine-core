import { useState } from 'react';
import { TitleScreen } from '../ui/TitleScreen';
import { GameApp } from '../ui/GameApp';

const Index = () => {
  const [started, setStarted] = useState(false);

  if (!started) {
    return <TitleScreen onStart={() => setStarted(true)} />;
  }

  return <GameApp onReturnToTitle={() => setStarted(false)} />;
};

export default Index;
