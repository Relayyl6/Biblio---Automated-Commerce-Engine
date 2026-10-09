import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, User, ShoppingBag, ShoppingCart, Search as SearchIcon } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, SlideInRight, SlideOutRight } from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';
import { useSearchData } from '../src/api/client';
import { useAuthStore } from '../src/store/authStore';
import { colors } from '../theme';
import { SearchBar } from '../src/components/SearchBar';
import { EmptyState } from '../src/components/EmptyState';

const RECENTS = ['Blessing Ankara', 'Restock gold print', 'Failed payments'];

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const merchantId = useAuthStore(state => state.merchantId);
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = useSearchData(merchantId, debouncedQuery);
  const hasQuery = debouncedQuery.length >= 2;

  return (
    <Animated.View entering={SlideInRight.springify()} exiting={SlideOutRight} style={{ backgroundColor: c.bg }} className="flex-1 pt-14">
      <View className="px-4 flex-row items-center mb-6">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2 mr-2 active:opacity-60">
          <ArrowLeft size={24} color={c.textPrimary} />
        </Pressable>
        <Animated.View entering={FadeIn.delay(100)} className="flex-1">
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search customers, products, or chats..."
            autoFocus
            variant="pill"
          />
        </Animated.View>
      </View>

      <ScrollView className="flex-1 px-6" keyboardShouldPersistTaps="handled">
        {isLoading && hasQuery ? (
          <View className="py-8 items-center justify-center">
            <ActivityIndicator color={c.accent} />
          </View>
        ) : hasQuery ? (
          results && results.length > 0 ? (
            <Animated.View entering={FadeInDown.springify()}>
              {results.map((item: any, idx: number) => {
                const Icon = item.type === 'customer' ? User : item.type === 'product' ? ShoppingBag : ShoppingCart;
                return (
                  <Pressable
                    key={idx}
                    style={{ borderBottomColor: c.border }}
                    className="flex-row items-center py-4 border-b active:opacity-60"
                  >
                    <View style={{ backgroundColor: c.accentSoft }} className="w-10 h-10 rounded-full items-center justify-center mr-3">
                      <Icon size={18} color={c.accent} />
                    </View>
                    <View className="flex-1">
                      <Text style={{ color: c.textPrimary }} className="font-bold text-base">
                        {item.title}
                      </Text>
                      <Text style={{ color: c.textSecondary }} className="text-sm">
                        {item.subtitle}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </Animated.View>
          ) : (
            <EmptyState icon={SearchIcon} title="No results" subtitle={`Nothing matched "${debouncedQuery}". Try a different term.`} />
          )
        ) : (
          <Animated.View entering={FadeInDown.delay(150).springify()}>
            <Text style={{ color: c.textPrimary }} className="font-bold text-lg mb-4">
              Recent Searches
            </Text>
            {RECENTS.map((item, idx) => (
              <Pressable
                key={idx}
                onPress={() => setQuery(item)}
                style={{ borderBottomColor: c.border }}
                className="flex-row items-center py-3 border-b active:opacity-60"
              >
                <SearchIcon size={16} color={c.textTertiary} style={{ marginRight: 12 }} />
                <Text style={{ color: c.textSecondary }} className="text-base">
                  {item}
                </Text>
              </Pressable>
            ))}
          </Animated.View>
        )}
      </ScrollView>
    </Animated.View>
  );
}
