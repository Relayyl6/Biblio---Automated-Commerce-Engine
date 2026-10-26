import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, User, ShoppingBag, ShoppingCart, Search as SearchIcon, X, Clock, MessageCircle } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, SlideInRight, SlideOutRight } from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSearchData } from '../src/api/client';
import { useAuthStore } from '../src/store/authStore';
import { colors } from '../theme';
import { SearchBar } from '../src/components/SearchBar';
import { EmptyState } from '../src/components/EmptyState';
import { SearchSkeleton } from '../src/components/PulsingSkeleton';

const STORAGE_KEY = '@biblio_recent_searches';
const DEFAULT_RECENTS = ['Recent Orders', 'Restock Alerts', 'WhatsApp Chats'];

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recents, setRecents] = useState<string[]>(DEFAULT_RECENTS);
  const merchantId = useAuthStore(state => state.merchantId);
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRecents(parsed);
          }
        } catch (_) {}
      }
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      if (query.trim().length >= 2) {
        addRecentSearch(query.trim());
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const addRecentSearch = async (term: string) => {
    setRecents((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== term.toLowerCase());
      const updated = [term, ...filtered].slice(0, 8);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  const removeRecentSearch = async (term: string) => {
    setRecents((prev) => {
      const updated = prev.filter((item) => item !== term);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  const clearRecents = async () => {
    setRecents([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  const { data: results, isLoading } = useSearchData(merchantId || '', debouncedQuery);
  const hasQuery = debouncedQuery.length >= 2;

  return (
    <Animated.View
      entering={SlideInRight.springify()}
      exiting={SlideOutRight}
      style={{
        backgroundColor: c.bg,
        paddingTop: Math.max(insets.top, StatusBar.currentHeight || 0) + 6,
      }}
      className="flex-1"
    >
      <View className="px-4 flex-row items-center mb-3">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2 mr-0 active:opacity-60">
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
          <SearchSkeleton count={5} />
        ) : hasQuery ? (
          results && results.length > 0 ? (
            <Animated.View entering={FadeInDown.springify()}>
              {results.map((item: any, idx: number) => {
                const Icon = item.type === 'customer'
                  ? User
                  : item.type === 'product'
                  ? ShoppingBag
                  : item.type === 'chat'
                  ? MessageCircle
                  : ShoppingCart;
                return (
                  <Pressable
                    key={idx}
                    onPress={() => {
                      addRecentSearch(item.title);
                      if (item.type === 'product') {
                        router.push('/crm');
                      } else if (item.type === 'customer' || item.type === 'chat') {
                        router.push(item.id ? `/chat/${item.id}` : '/chats');
                      } else if (item.type === 'order') {
                        router.push('/finance');
                      }
                    }}
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
            <View className="flex-row justify-between items-center mb-4">
              <Text style={{ color: c.textPrimary }} className="font-bold text-lg">
                Recent Searches
              </Text>
              {recents.length > 0 && (
                <Pressable onPress={clearRecents} hitSlop={8} className="active:opacity-60">
                  <Text style={{ color: c.textTertiary }} className="text-xs font-semibold">
                    Clear all
                  </Text>
                </Pressable>
              )}
            </View>
            {recents.map((item, idx) => (
              <View
                key={idx}
                style={{ borderBottomColor: c.border }}
                className="flex-row items-center justify-between py-3 border-b"
              >
                <Pressable
                  onPress={() => setQuery(item)}
                  className="flex-row items-center flex-1 mr-2 active:opacity-60"
                >
                  <Clock size={16} color={c.textTertiary} style={{ marginRight: 12 }} />
                  <Text style={{ color: c.textSecondary }} className="text-base font-medium">
                    {item}
                  </Text>
                </Pressable>
                <Pressable onPress={() => removeRecentSearch(item)} hitSlop={10} className="p-1 active:opacity-60">
                  <X size={15} color={c.textTertiary} />
                </Pressable>
              </View>
            ))}
          </Animated.View>
        )}
      </ScrollView>
    </Animated.View>
  );
}
