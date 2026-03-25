import { Pressable, Text } from 'react-native';

type ActionButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  size?: 'md' | 'lg';
};

export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  size = 'md',
}: ActionButtonProps) {
  const heightClass = size === 'lg' ? 'h-14' : 'h-12';

  const className =
    variant === 'ghost'
      ? `${heightClass} items-center justify-center rounded-xl border ${
          disabled
            ? 'border-slate-600 bg-transparent'
            : 'border-cyan-300/60 bg-transparent active:bg-cyan-300/10'
        }`
      : `${heightClass} items-center justify-center rounded-xl ${
          disabled ? 'bg-slate-700' : 'bg-cyan-400 active:bg-cyan-300'
        }`;

  const textClassName =
    variant === 'ghost'
      ? disabled
        ? 'text-slate-500'
        : 'text-cyan-100'
      : disabled
        ? 'text-slate-400'
        : 'text-[#001018]';

  const textSizeClass = size === 'lg' ? 'text-[16px]' : 'text-base';

  return (
    <Pressable onPress={disabled ? undefined : onPress} className={className}>
      <Text className={`${textSizeClass} font-semibold ${textClassName}`}>{label}</Text>
    </Pressable>
  );
}
