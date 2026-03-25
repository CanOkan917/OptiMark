import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

type AppScreenProps = {
  children: ReactNode;
};

export function AppScreen({ children }: AppScreenProps) {
  const { width } = useWindowDimensions();
  const horizontalPadding = width < 420 ? 14 : width < 768 ? 18 : 28;

  return (
    <SafeAreaView className="flex-1 bg-[#02030a]">
      <StatusBar style="light" />

      <View pointerEvents="none" className="absolute inset-0">
        <View className="absolute -left-24 top-8 h-64 w-64 rounded-full bg-cyan-300/10" />
        <View className="absolute -right-24 top-40 h-72 w-72 rounded-full bg-fuchsia-400/10" />
        <View className="absolute bottom-0 left-10 h-56 w-56 rounded-full bg-emerald-300/8" />

        <BlurView intensity={55} tint="dark" className="absolute -left-20 top-12 h-56 w-56 rounded-full" />
        <BlurView intensity={45} tint="dark" className="absolute -right-20 top-44 h-64 w-64 rounded-full" />
        <BlurView intensity={35} tint="dark" className="absolute bottom-2 left-12 h-44 w-44 rounded-full" />
      </View>

      <View
        className="flex-1 w-full self-center"
        style={{
          maxWidth: 1120,
          paddingHorizontal: horizontalPadding,
          paddingVertical: 16,
        }}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}
