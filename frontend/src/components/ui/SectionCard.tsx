import type {ReactNode} from 'react';
import {Text, View} from 'react-native';

type SectionCardProps = { title: string; children: ReactNode; };

export function SectionCard({title, children}: SectionCardProps) {
    return (
        <View className="rounded-2xl border border-cyan-200/20 bg-[#091122]/85 p-4">
            <Text className="mb-3 text-xs font-semibold uppercase tracking-[2px] text-cyan-200/80">{title}</Text>
            {children}
        </View>
    );
}