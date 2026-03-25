import { useWindowDimensions, ScrollView, Text, View } from 'react-native';

import type { TemplateSummary } from '../../../core/types/template';
import { localTemplates } from '../../../data/templates';
import { ActionButton } from '../../../components/ui/ActionButton';
import { SectionCard } from '../../../components/ui/SectionCard';
import { TemplateCard } from '../components/TemplateCard';

type DashboardScreenProps = {
  selectedTemplate: TemplateSummary | null;
  onSelectTemplate: (template: TemplateSummary) => void;
  onScan: () => void;
  onBack: () => void;
};

export function DashboardScreen({
  selectedTemplate,
  onSelectTemplate,
  onScan,
  onBack,
}: DashboardScreenProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 480;

  return (
    <View className="flex-1">
      <View className={`mb-4 ${isCompact ? 'gap-3' : 'flex-row items-start justify-between'}`}>
        <View>
          <Text className="text-xs font-semibold uppercase tracking-[2px] text-cyan-200/80">Dashboard</Text>
          <Text className={`${isCompact ? 'text-2xl' : 'text-3xl'} mt-1 font-bold text-white`}>Template Control Center</Text>
        </View>
        <ActionButton label="Landing" variant="ghost" onPress={onBack} />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ gap: 12, paddingBottom: 16 }}>
        <SectionCard title="Local Templates">
          <Text className="text-sm text-slate-300">
            Select one template. The scanner will use this local config for the next scan session.
          </Text>
        </SectionCard>

        {localTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            selected={selectedTemplate?.id === template.id}
            onSelect={onSelectTemplate}
          />
        ))}
      </ScrollView>

      <View className="pt-3">
        <ActionButton
          label={selectedTemplate ? `Start Scan: ${selectedTemplate.name}` : 'Select A Template First'}
          onPress={onScan}
          disabled={!selectedTemplate}
        />
      </View>
    </View>
  );
}
