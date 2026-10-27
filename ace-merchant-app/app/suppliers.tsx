import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Users, Plus, Link2, MessageCircle, Camera, Send, Edit2, Trash2 } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, shadows } from '../theme';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { SearchBar } from '../src/components/SearchBar';
import { EmptyState } from '../src/components/EmptyState';
import { StatusPill } from '../src/components/StatusPill';
import { SidePanel } from '../src/components/SidePanel';
import { SegmentedControl } from '../src/components/SegmentedControl';
import { PanelField } from '../src/components/PanelField';
import { ConfirmDialog } from '../src/components/ConfirmDialog';
import { useSuppliers, useAddSupplier, useUpdateSupplier, useDeleteSupplier } from '../src/api/client';
import { LoadingScreen } from '../src/components/LoadingScreen';

type ChannelType = 'whatsapp_group' | 'whatsapp_direct' | 'telegram_channel' | 'ig_dm';

type ProcurementNode = {
  id: string;
  name: string;
  channelType: ChannelType;
  channelId: string;
  categories: string[];
  autoRestockEnabled: boolean;
};

const TYPE_LABELS: Record<ChannelType, string> = {
  whatsapp_group: 'WA Group',
  whatsapp_direct: 'WA Direct',
  telegram_channel: 'Telegram',
  ig_dm: 'IG DM',
};
const LABEL_TO_TYPE: Record<string, ChannelType> = {
  'WA Group': 'whatsapp_group',
  'WA Direct': 'whatsapp_direct',
  Telegram: 'telegram_channel',
  'IG DM': 'ig_dm',
};

const EMPTY_FORM = { name: '', type: 'WA Group', link: '', categories: '', autoRestockEnabled: true };

export default function SuppliersScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  const { data: nodes, isLoading } = useSuppliers();
  const addMutation = useAddSupplier();
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();

  const [searchQuery, setSearchQuery] = useState('');
  const [panel, setPanel] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);

  if (isLoading) return <LoadingScreen />;

  const safeNodes: ProcurementNode[] = nodes || [];
  const filteredNodes = safeNodes.filter((node) => node.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const getIconForType = (type: ChannelType) =>
    ({ whatsapp_group: Users, whatsapp_direct: MessageCircle, telegram_channel: Send, ig_dm: Camera }[type] ?? Link2);

  const openAddPanel = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setPanel('add');
  };

  const openEditPanel = (node: ProcurementNode) => {
    setForm({
      name: node.name,
      type: TYPE_LABELS[node.channelType] || 'WA Group',
      link: node.channelId,
      categories: (node.categories || []).join(', '),
      autoRestockEnabled: node.autoRestockEnabled,
    });
    setEditingId(node.id);
    setPanel('edit');
  };

  const closePanel = () => {
    setPanel(null);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    const categories = form.categories
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const channelType = LABEL_TO_TYPE[form.type] ?? 'whatsapp_group';

    const payload = {
      name: form.name,
      channelType,
      channelId: form.link,
      categories,
      autoRestockEnabled: form.autoRestockEnabled,
    };

    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, ...payload });
    } else {
      await addMutation.mutateAsync(payload);
    }
    closePanel();
  };

  const confirmDelete = async () => {
    if (pendingDeleteId) {
      await deleteMutation.mutateAsync(pendingDeleteId);
    }
    setPendingDeleteId(null);
  };

  const handleSoftDelete = async () => {
    if (pendingDeleteId) {
      await updateMutation.mutateAsync({
        id: pendingDeleteId,
        autoRestockEnabled: false,
      });
    }
    setPendingDeleteId(null);
  };

  const canSubmit = form.name.trim().length > 0 && !addMutation.isPending && !updateMutation.isPending;

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader
        title="Procurement Nodes"
        rightAction={
          <Pressable onPress={openAddPanel} style={{ backgroundColor: c.accent, ...shadows.sm }} className="w-10 h-10 rounded-full items-center justify-center active:opacity-80">
            <Plus size={20} color={isDark ? '#090A0C' : '#FFFFFF'} />
          </Pressable>
        }
      />
      <View className="px-4 mb-2.5">
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search suppliers, groups, categories..." variant="pill" />
      </View>

      <ScrollView className="flex-1 pt-2" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="px-4 mb-4 flex-row justify-between items-center">
          <Text style={{ color: c.textSecondary }} className="text-sm font-bold uppercase tracking-wider">
            Connected Sourcing Channels
          </Text>
          <Text style={{ color: c.textTertiary }} className="text-xs font-semibold">
            {filteredNodes.length} Nodes
          </Text>
        </View>

        {filteredNodes.length === 0 ? (
          <EmptyState icon={Users} title="No procurement nodes" subtitle="Add a WhatsApp group link or supplier contact to enable auto-restock." actionLabel="Add a node" onAction={openAddPanel} />
        ) : (
          filteredNodes.map((node, index) => {
            const Icon = getIconForType(node.channelType);
            return (
              <Animated.View key={node.id} entering={FadeInDown.delay(index * 50).springify()}>
                <View style={{ backgroundColor: c.surface, borderColor: c.border, ...shadows.sm }} className="mx-4 mb-4 p-5 rounded-[24px] border">
                  <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-1 pr-4">
                      <Text style={{ color: c.textPrimary }} className="text-lg font-bold tracking-tight mb-1">
                        {node.name}
                      </Text>
                      <View className="flex-row items-center mt-1">
                        <Icon size={14} color={c.textTertiary} style={{ marginRight: 6 }} />
                        <Text style={{ color: c.textSecondary }} className="text-xs font-semibold uppercase tracking-wider">
                          {TYPE_LABELS[node.channelType] || 'Unknown'}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row">
                      <Pressable
                        onPress={() => openEditPanel(node)}
                        style={{ backgroundColor: c.surfaceAlt }}
                        className="w-8 h-8 rounded-full items-center justify-center active:opacity-70 mr-2"
                      >
                        <Edit2 size={14} color={c.textPrimary} />
                      </Pressable>
                      <Pressable
                        onPress={() => setPendingDeleteId(node.id)}
                        style={{ backgroundColor: c.dangerSoft }}
                        className="w-8 h-8 rounded-full items-center justify-center active:opacity-70"
                      >
                        <Trash2 size={14} color={c.danger} />
                      </Pressable>
                    </View>
                  </View>

                  <View className="flex-row flex-wrap mb-4 mt-2">
                    {(node.categories || []).map(cat => (
                      <View key={cat} style={{ backgroundColor: c.accentSoft }} className="px-2 py-1 rounded-md mr-2 mb-2">
                        <Text style={{ color: c.accent }} className="text-[10px] font-bold uppercase tracking-wider">
                          {cat}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={{ borderTopWidth: 1, borderTopColor: c.border }} className="pt-4 flex-row justify-between items-center">
                    <Text style={{ color: c.textPrimary }} className="text-sm font-medium">
                      Auto-Restock Authority
                    </Text>
                    <StatusPill label={node.autoRestockEnabled ? 'ACTIVE' : 'PAUSED'} tone={node.autoRestockEnabled ? 'success' : 'neutral'} />
                  </View>
                </View>
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      <SidePanel
        visible={panel !== null}
        onClose={closePanel}
        title={editingId ? 'Edit Procurement Node' : 'Add Procurement Node'}
        subtitle={editingId ? 'Update this supplier group or contact.' : 'Link a new supplier group or contact.'}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <PanelField label="Node Name" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Balogun Market Group" />

          <Text style={{ color: c.textPrimary }} className="font-semibold text-sm mb-2 mt-2">
            Channel Type
          </Text>
          <SegmentedControl options={['WA Group', 'WA Direct', 'Telegram', 'IG DM']} value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))} />
          <Text style={{ color: c.textTertiary }} className="text-xs mt-2 mb-6 leading-relaxed">
            The AI uses the specific platform adapter to communicate with this source.
          </Text>

          <PanelField
            label="Channel Link / ID"
            value={form.link}
            onChangeText={v => setForm(f => ({ ...f, link: v }))}
            placeholder="chat.whatsapp.com/xyz or +234..."
            helper="The AI will automatically join group links."
          />
          <PanelField
            label="Categories (comma separated)"
            value={form.categories}
            onChangeText={v => setForm(f => ({ ...f, categories: v }))}
            placeholder="Ankara, Lace, Silk"
          />

          <View className="flex-row items-center justify-between py-4 mb-4" style={{ borderTopWidth: 1, borderTopColor: c.border }}>
            <View className="flex-1 pr-4">
              <Text style={{ color: c.textPrimary }} className="font-semibold text-sm mb-1">
                Auto-Restock Authority
              </Text>
              <Text style={{ color: c.textSecondary }} className="text-xs leading-relaxed">
                Allow the AI to automatically post messages requesting inventory when stock is low.
              </Text>
            </View>
            <Switch value={form.autoRestockEnabled} onValueChange={v => setForm(f => ({ ...f, autoRestockEnabled: v }))} trackColor={{ false: c.border, true: c.accent }} thumbColor={c.surface} />
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={{ backgroundColor: canSubmit ? c.accent : c.surfaceAlt }}
            className="py-3.5 rounded-xl items-center active:opacity-80 mt-2"
          >
            <Text style={{ color: canSubmit ? (isDark ? '#090A0C' : '#FFFFFF') : c.textTertiary }} className="font-bold text-sm">
              {editingId ? 'Save Changes' : 'Register Node'}
            </Text>
          </Pressable>
        </ScrollView>
      </SidePanel>

      <ConfirmDialog
        visible={pendingDeleteId !== null}
        title="Remove Procurement Node"
        message="Choose whether to pause auto-restocking (soft-delete / keep channel on standby) or permanently remove this supplier node."
        itemName={safeNodes.find((s) => s.id === pendingDeleteId)?.name}
        confirmLabel="🗑️ Permanently Delete"
        softDeleteLabel="⏸️ Pause Channel (Soft Delete)"
        onSoftDelete={handleSoftDelete}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </View>
  );
}
