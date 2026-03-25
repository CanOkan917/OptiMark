import { Pressable, Text, View } from 'react-native';

import type { TemplateSummary } from '../../../core/types/template';

type TemplateCardProps = {
  template: TemplateSummary;
  selected: boolean;
  onSelect: (template: TemplateSummary) => void;
};

export function TemplateCard({ template, selected, onSelect }: TemplateCardProps) {
  return (
    <Pressable
      onPress={() => onSelect(template)}
      className={`rounded-2xl border p-4 ${
        selected ? 'border-cyan-300 bg-cyan-300/10' : 'border-slate-700 bg-[#0a1120]/90'
      }`}
    >
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="text-lg font-semibold text-white">{template.name}</Text>
        <Text className="rounded-full border border-cyan-300/40 px-3 py-1 text-xs text-cyan-100">{template.id}</Text>
      </View>

      <Text className="mt-3 text-sm text-slate-300">{template.description}</Text>

      <View className="mt-4 flex-row flex-wrap gap-2">
        <Text className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200">Q: {template.questionCount}</Text>
        <Text className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200">
          Choices: {template.choices.join('/')}
        </Text>
        <Text className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200">Updated: {template.updatedAt}</Text>
      </View>
    </Pressable>
  );
}
