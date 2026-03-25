import { Text, View } from 'react-native';

type ScannerStatusCardProps = {
  markerCount: number;
};

export function ScannerStatusCard({ markerCount }: ScannerStatusCardProps) {
  const ready = markerCount >= 4;

  return (
    <View className="rounded-2xl border border-slate-700 bg-slate-800/80 p-4">
      <Text className="text-sm text-slate-300">Marker Detection</Text>
      <Text className="mt-1 text-3xl font-bold text-white">{markerCount}/4</Text>
      <Text className="mt-2 text-sm text-slate-300">
        {ready
          ? 'All markers detected. Ready for auto-capture.'
          : 'Keep the sheet inside frame until all 4 markers are visible.'}
      </Text>
    </View>
  );
}
