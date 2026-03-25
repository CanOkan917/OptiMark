import { Text, View } from 'react-native';

import { ActionButton } from '../../../components/ui/ActionButton';
import { SectionCard } from '../../../components/ui/SectionCard';

type LandingScreenProps = {
  onStart: () => void;
};

export function LandingScreen({ onStart }: LandingScreenProps) {
  return (
    <View className="flex-1 justify-between pb-4 pt-10">
      <View>
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-cyan-200/80">OptiMark Neural Scan</Text>
        <Text className="mt-4 text-5xl font-black leading-[56px] text-white">Scan Sheets At{'\n'}Light Speed</Text>
        <Text className="mt-4 text-base leading-6 text-slate-300">
          Futuristic OMR workflow with local templates, instant marker awareness, and fast scan sessions.
        </Text>
      </View>

      <SectionCard title="Current Mode">
        <Text className="text-base text-slate-100">No login required.</Text>
        <Text className="mt-2 text-sm text-slate-300">
          Everything runs locally for now: templates, selection, and scan session setup.
        </Text>
      </SectionCard>

      <View className="gap-3">
        <ActionButton label="Enter Dashboard" onPress={onStart} />
        <ActionButton label="Preview Scanner UI" variant="ghost" onPress={onStart} />
      </View>
    </View>
  );
}
