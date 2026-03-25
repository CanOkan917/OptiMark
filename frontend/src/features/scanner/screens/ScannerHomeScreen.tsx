import { Text, View } from 'react-native';

import { AppScreen } from '../../../components/layout/AppScreen';
import { ActionButton } from '../../../components/ui/ActionButton';
import { SectionCard } from '../../../components/ui/SectionCard';
import { ScannerStatusCard } from '../components/ScannerStatusCard';

export function ScannerHomeScreen() {
  const markerCount = 0;

  return (
    <AppScreen>
      <View className="mb-6">
        <Text className="text-3xl font-bold text-white">OptiMark Scanner</Text>
        <Text className="mt-2 text-base text-slate-300">
          Camera + marker detection UI foundation is ready.
        </Text>
      </View>

      <View className="flex-1 gap-4">
        <SectionCard title="Capture">
          <View className="h-56 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950/70">
            <Text className="text-slate-400">Camera preview placeholder</Text>
          </View>
        </SectionCard>

        <ScannerStatusCard markerCount={markerCount} />

        <ActionButton label="Start Camera" onPress={() => undefined} />
      </View>
    </AppScreen>
  );
}
