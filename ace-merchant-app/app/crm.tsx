import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Plus, PackageSearch, Edit2, Trash2, TrendingDown } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, shadows } from '../theme';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { SearchBar } from '../src/components/SearchBar';
import { EmptyState } from '../src/components/EmptyState';
import { StatusPill } from '../src/components/StatusPill';
import { useProducts } from '../src/api/client';
import { LoadingScreen } from '../src/components/LoadingScreen';

export default function CRMScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  const [searchQuery, setSearchQuery] = useState('');
  const { data: inventory, isLoading } = useProducts();

  if (isLoading) return <LoadingScreen />;

  const safeInventory = inventory || [];
  const filteredInventory = safeInventory.filter((item: any) => 
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <View style={{ backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border }} className="pb-4">
        <ScreenHeader
          title="Inventory & CRM"
          variant="bar"
          rightAction={
            <Pressable
              style={{ backgroundColor: c.accent, ...shadows.sm }}
              className="w-10 h-10 rounded-full items-center justify-center active:opacity-80"
            >
              <Plus size={20} color={isDark ? '#090A0C' : '#FFFFFF'} />
            </Pressable>
          }
        />
        <View className="px-6 mt-4">
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search SKUs, categories..." variant="inset" />
        </View>
      </View>

      <ScrollView className="flex-1 pt-4" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="px-6 mb-4 flex-row justify-between items-center">
          <Text style={{ color: c.textSecondary }} className="text-sm font-bold uppercase tracking-wider">
            Catalog Details
          </Text>
          <Text style={{ color: c.textTertiary }} className="text-xs font-semibold">
            {filteredInventory.length} Items
          </Text>
        </View>

        {filteredInventory.length === 0 ? (
          <EmptyState icon={PackageSearch} title="No matching items" subtitle="Add new inventory items or adjust your search." />
        ) : (
          filteredInventory.map((item: any, index: number) => {
            const stock = item.stock || 0;
            const isLowStock = stock <= 5;
            const isOutOfStock = stock === 0;
            const tone = isOutOfStock ? 'danger' : isLowStock ? 'warning' : 'success';
            const label = isOutOfStock ? 'Out of Stock' : `${stock} in stock`;

            return (
              <Animated.View key={item.id} entering={FadeInDown.delay(index * 50).springify()}>
                <View style={{ backgroundColor: c.surface, borderColor: c.border, ...shadows.sm }} className="mx-6 mb-4 p-5 rounded-[24px] border">
                  <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-1 pr-4">
                      <Text style={{ color: c.textPrimary }} className="text-lg font-bold tracking-tight mb-1">
                        {item.name}
                      </Text>
                      <Text style={{ color: c.textSecondary }} className="text-xs font-semibold uppercase tracking-wider">
                        {item.category || 'Uncategorized'}
                      </Text>
                    </View>
                    <View className="flex-row">
                      <Pressable style={{ backgroundColor: c.surfaceAlt }} className="w-8 h-8 rounded-full items-center justify-center active:opacity-70 mr-2">
                        <Edit2 size={14} color={c.textPrimary} />
                      </Pressable>
                      <Pressable style={{ backgroundColor: c.dangerSoft }} className="w-8 h-8 rounded-full items-center justify-center active:opacity-70">
                        <Trash2 size={14} color={c.danger} />
                      </Pressable>
                    </View>
                  </View>

                  <View className="flex-row items-center mb-4">
                    <StatusPill label={label} tone={tone} />
                    {isLowStock && !isOutOfStock && (
                      <Text style={{ color: c.textTertiary }} className="text-xs font-medium ml-3">
                        Predictive Restock Active
                      </Text>
                    )}
                  </View>

                  <View style={{ borderTopWidth: 1, borderTopColor: c.border }} className="pt-4 flex-row justify-between">
                    <View>
                      <Text style={{ color: c.textTertiary }} className="text-[10px] font-bold uppercase tracking-wider mb-1">
                        Retail Price
                      </Text>
                      <Text style={{ color: c.textPrimary }} className="text-base font-bold">
                        ₦{(item.price || 0).toLocaleString()}
                      </Text>
                    </View>
                    <View className="items-end">
                      <View className="flex-row items-center mb-1">
                        <Text style={{ color: c.danger }} className="text-[10px] font-bold uppercase tracking-wider mr-1">
                          Absolute Floor
                        </Text>
                        <TrendingDown size={12} color={c.danger} />
                      </View>
                      <Text style={{ color: c.textPrimary }} className="text-base font-bold">
                        ₦{(item.floor || 0).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
