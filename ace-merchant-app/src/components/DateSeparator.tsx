import React from 'react';
import { View, Text } from 'react-native';
import { useColorScheme } from 'nativewind';
import { colors } from '../../theme';

export function DateSeparator({ label }: { label: string }) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;
  return (
    <View className="items-center my-4">
      <View style={{ backgroundColor: c.surfaceAlt }} className="px-3 py-1 rounded-full">
        <Text style={{ color: c.textTertiary }} className="text-[11px] font-semibold">
          {label}
        </Text>
      </View>
    </View>
  );
}

export function groupMessagesByDay<T extends { time: string; dateKey?: string }>(messages: T[]) {
  const groups: { label: string; items: T[] }[] = [];
  for (const msg of messages) {
    const key = msg.dateKey ?? 'conversation';
    const last = groups[groups.length - 1];
    if (last && last.label === labelForDateKey(key)) {
      last.items.push(msg);
    } else {
      groups.push({ label: labelForDateKey(key), items: [msg] });
    }
  }
  return groups;
}

function labelForDateKey(key: string) {
  if (key === 'conversation') return '';
  const date = new Date(key);
  if (Number.isNaN(date.getTime())) return key;
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
}
