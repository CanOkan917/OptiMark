import { Text, View } from 'react-native';

import type { TemplateSummary } from '../../../core/types/template';
import { ActionButton } from '../../../components/ui/ActionButton';
import { CameraCapturePanel } from '../components/CameraCapturePanel';

type ScannerSessionScreenProps = {
  template: TemplateSummary;
  onBack: () => void;
};

export function ScannerSessionScreen({ template, onBack }: ScannerSessionScreenProps) {
  return (
    <View className="flex-1">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="rounded-full border border-cyan-300/35 bg-cyan-300/10 px-3 py-1.5">
          <Text className="text-xs font-semibold uppercase tracking-[1.5px] text-cyan-100">{template.name}</Text>
        </View>

        <View className="w-40">
          <ActionButton label="Back" variant="ghost" onPress={onBack} />
        </View>
      </View>

      <View className="flex-1">
        <CameraCapturePanel />
      </View>
    </View>
  );
}
