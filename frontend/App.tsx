import './global.css';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootApp } from './src/core/RootApp';

export default function App() {
  return (
    <SafeAreaProvider>
      <RootApp />
    </SafeAreaProvider>
  );
}
