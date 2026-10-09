import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Switch } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Users, Plus, Link2, MessageCircle, Instagram, Send, Edit2, Trash2 } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, shadows } from '../theme';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { SearchBar } from '../src/components/SearchBar';
import { EmptyState } from '../src/components/EmptyState';
import { StatusPill } from '../src/components/StatusPill';
import { SidePanel } from '../src/components/SidePanel';
import { SegmentedControl } from '../src/components/SegmentedControl';
import { PanelField } from '../src/components/PanelField';
import { useSuppliers } from '../src/api/client';
import { LoadingScreen } from '../src/components/LoadingScreen';

export default function SuppliersScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  const [searchQuery, setSearchQuery] = useState('');
  const [activePanel, setActivePanel] = useState<'add_node' | null>(null);
  
  // Form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('WA Group');
  const [newLink, setNewLink] = useState('');
  const [newCategories, setNewCategories] = useState('');
  const [newAutoRestock, setNewAutoRestock] = useState(true);

  const { data: nodes, isLoading } = useSuppliers();

  if (isLoading) return <LoadingScreen />;

  const safeNodes = nodes || [];
  const filteredNodes = safeNodes.filter((node: any) => 
    node.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.categories?.some((cat: string) => cat.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getIconForType = (type: string) => {
    switch (type) {
      case 'whatsapp_group': return Users;
      case 'whatsapp_direct': return MessageCircle;
      case 'telegram_channel': return Send;
      case 'ig_dm': return Instagram;
      default: return Link2;
    }
  };

  const getLabelForType = (type: string) => {
    switch (type) {
      case 'whatsapp_group': return 'WA Group';
      case 'whatsapp_direct': return 'WA Direct';
      case 'telegram_channel': return 'Telegram';
      case 'ig_dm': return 'Instagram';
      default: return 'Link';
    }
  };

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <View style={{ backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border }} className="pb-4">
        <ScreenHeader
          title="Procurement Nodes"
          variant="bar"
          rightAction={
            <Pressable
              onPress={() => setActivePanel('add_node')}
              style={{ backgroundColor: c.accent, ...shadows.sm }}
              className="w-10 h-10 rounded-full items-center justify-center active:opacity-80"
            >
              <Plus size={20} color={isDark ? '#090A0C' : '#FFFFFF'} />
            </Pressable>
          }
        />
        <View className="px-6 mt-4">
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search suppliers, groups, categories..." variant="inset" />
        </View>
      </View>

      <ScrollView className="flex-1 pt-4" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="px-6 mb-4 flex-row justify-between items-center">
          <Text style={{ color: c.textSecondary }} className="text-sm font-bold uppercase tracking-wider">
            Connected Sourcing Channels
          </Text>
          <Text style={{ color: c.textTertiary }} className="text-xs font-semibold">
            {filteredNodes.length} Nodes
          </Text>
        </View>

        {filteredNodes.length === 0 ? (
          <EmptyState icon={Users} title="No procurement nodes" subtitle="Add a WhatsApp group link or supplier contact to enable auto-restock." />
        ) : (
          filteredNodes.map((node: any, index: number) => {
            const Icon = getIconForType(node.channelType);
            
            return (
              <Animated.View key={node.id} entering={FadeInDown.delay(index * 50).springify()}>
                <View style={{ backgroundColor: c.surface, borderColor: c.border, ...shadows.sm }} className="mx-6 mb-4 p-5 rounded-[24px] border">
                  <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-1 pr-4">
                      <Text style={{ color: c.textPrimary }} className="text-lg font-bold tracking-tight mb-1">
                        {node.name}
                      </Text>
                      <View className="flex-row items-center mt-1">
                        <Icon size={14} color={c.textTertiary} style={{ marginRight: 6 }} />
                        <Text style={{ color: c.textSecondary }} className="text-xs font-semibold uppercase tracking-wider">
                          {getLabelForType(node.channelType)}
                        </Text>
                      </View>
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

                  <View className="flex-row flex-wrap mb-4 mt-2">
                    {(node.categories || []).map((cat: string) => (
                      <View key={cat} style={{ backgroundColor: c.accentSoft }} className="px-2 py-1 rounded-md mr-2 mb-2">
                        <Text style={{ color: c.accent }} className="text-[10px] font-bold uppercase tracking-wider">{cat}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={{ borderTopWidth: 1, borderTopColor: c.border }} className="pt-4 flex-row justify-between items-center">
                    <Text style={{ color: c.textPrimary }} className="text-sm font-medium">Auto-Restock Authority</Text>
                    <StatusPill label={node.autoRestockEnabled ? 'ACTIVE' : 'PAUSED'} tone={node.autoRestockEnabled ? 'success' : 'neutral'} />
                  </View>
                </View>
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      <SidePanel
        visible={activePanel === 'add_node'}
        onClose={() => setActivePanel(null)}
        title="Add Procurement Node"
        subtitle="Link a new supplier group or contact."
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <PanelField label="Node Name" value={newName} onChangeText={setNewName} placeholder="e.g. Balogun Market Group" />
          
          <Text style={{ color: c.textPrimary }} className="font-semibold text-sm mb-2 mt-2">Channel Type</Text>
          <SegmentedControl options={['WA Group', 'WA Direct', 'Telegram', 'IG DM']} value={newType} onChange={setNewType} />
          <Text style={{ color: c.textTertiary }} className="text-xs mt-2 mb-6 leading-relaxed">
            The AI uses the specific platform adapter to communicate with this source.
          </Text>

          <PanelField label="Channel Link / ID" value={newLink} onChangeText={setNewLink} placeholder="chat.whatsapp.com/xyz or +234..." helper="The AI will automatically join group links." />
          <PanelField label="Categories (Comma separated)" value={newCategories} onChangeText={setNewCategories} placeholder="Ankara, Lace, Silk" />
          
          <View className="flex-row items-center justify-between py-4 mb-4" style={{ borderTopWidth: 1, borderTopColor: c.border }}>
            <View className="flex-1 pr-4">
              <Text style={{ color: c.textPrimary }} className="font-semibold text-sm mb-1">Auto-Restock Authority</Text>
              <Text style={{ color: c.textSecondary }} className="text-xs leading-relaxed">
                Allow the AI to automatically post messages requesting inventory when stock is low.
              </Text>
            </View>
            <Switch value={newAutoRestock} onValueChange={setNewAutoRestock} trackColor={{ false: c.border, true: c.accent }} thumbColor={c.surface} />
          </View>

          <Pressable onPress={() => setActivePanel(null)} style={{ backgroundColor: c.accent }} className="py-3.5 rounded-xl items-center active:opacity-80 mt-2">
            <Text style={{ color: isDark ? '#090A0C' : '#FFFFFF' }} className="font-bold text-sm">Register Node</Text>
          </Pressable>
        </ScrollView>
      </SidePanel>
    </View>
  );
}
