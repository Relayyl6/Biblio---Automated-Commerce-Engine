import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useColorScheme } from 'nativewind';
import { useAlert } from '../src/store/alertStore';
import {
  Plus,
  PackageSearch,
  Edit2,
  Trash2,
  TrendingDown,
  Package,
  RefreshCw,
  ExternalLink,
  Check,
} from 'lucide-react-native';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, shadows } from '../theme';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { SearchBar } from '../src/components/SearchBar';
import { StatusPill } from '../src/components/StatusPill';
import { SidePanel } from '../src/components/SidePanel';
import { PanelField } from '../src/components/PanelField';
import { ConfirmDialog } from '../src/components/ConfirmDialog';
import {
  useProducts,
  useAddProduct,
  useUpdateProduct,
  useDeleteProduct,
  useSyncWhatsAppCatalog,
} from '../src/api/client';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { InlineLoadingDots } from '../src/components/PulsingSkeleton';

interface ProductForm {
  sku: string;
  name: string;
  price: string;
  floor: string;
  stock: string;
  category: string;
  description: string;
}

const EMPTY_FORM: ProductForm = {
  sku: '',
  name: '',
  price: '',
  floor: '',
  stock: '10',
  category: '',
  description: '',
};

export default function CRMScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ action?: string }>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;
  const alert = useAlert();

  const [searchQuery, setSearchQuery] = useState('');
  const [panelVisible, setPanelVisible] = useState(false);
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [pendingDeleteSku, setPendingDeleteSku] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const { data: inventory, isLoading } = useProducts();
  const addMutation = useAddProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();
  const syncMutation = useSyncWhatsAppCatalog();

  // Auto-open panel if navigated with action=add
  useEffect(() => {
    if (params.action === 'add') {
      openAddPanel();
    }
  }, [params.action]);

  const openAddPanel = () => {
    setEditingSku(null);
    setForm({
      ...EMPTY_FORM,
      sku: `SKU-${Date.now().toString().slice(-6)}`,
    });
    setSyncFeedback(null);
    setPanelVisible(true);
  };

  const openEditPanel = (item: any) => {
    setEditingSku(item.sku || item.id);
    setForm({
      sku: item.sku || item.id || '',
      name: item.name || '',
      price: item.price ? String(item.price) : '',
      floor: item.floor ? String(item.floor) : '',
      stock: item.stock !== undefined ? String(item.stock) : '0',
      category: item.category || '',
      description: item.description || '',
    });
    setSyncFeedback(null);
    setPanelVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert.warning('Required Field', 'Please enter a product name.');
      return;
    }
    const numPrice = Number(form.price);
    if (isNaN(numPrice) || numPrice <= 0) {
      alert.warning('Invalid Price', 'Please enter a valid retail price in Naira.');
      return;
    }

    try {
      if (editingSku) {
        await updateMutation.mutateAsync({
          sku: editingSku,
          name: form.name.trim(),
          price: numPrice,
          stock: Number(form.stock) || 0,
          category: form.category.trim() || 'General',
        });
      } else {
        await addMutation.mutateAsync({
          sku: form.sku || `SKU-${Date.now().toString().slice(-6)}`,
          name: form.name.trim(),
          price: numPrice,
          floor: form.floor ? Number(form.floor) : numPrice * 0.85,
          stock: Number(form.stock) || 0,
          category: form.category.trim() || 'General',
          description: form.description.trim() || undefined,
        });
      }
      setPanelVisible(false);
      setForm(EMPTY_FORM);
      alert.success('Product Saved', `"${form.name.trim()}" has been saved to your catalog.`);
    } catch (err: any) {
      alert.error('Save Failed', err?.response?.data?.error || err.message || 'Could not save product.');
    }
  };

  const handleDelete = async () => {
    if (!pendingDeleteSku) return;
    try {
      await deleteMutation.mutateAsync(pendingDeleteSku);
      setPendingDeleteSku(null);
      alert.success('Product Removed', 'Product has been permanently removed.');
    } catch (err: any) {
      alert.error('Delete Failed', err?.message || 'Could not delete product.');
    }
  };

  const handleSoftDelete = async () => {
    if (!pendingDeleteSku) return;
    try {
      const itemToArchive = inventory?.find((i: any) => (i.sku || i.id) === pendingDeleteSku);
      if (itemToArchive) {
        await addMutation.mutateAsync({
          ...itemToArchive,
          stock: 0,
          description: `[ARCHIVED] ${itemToArchive.description || ''}`.trim(),
        });
      }
      setPendingDeleteSku(null);
      alert.success('Product Archived', 'Item has been soft-deleted and hidden from live WhatsApp negotiation.');
    } catch (err: any) {
      alert.error('Archive Failed', err?.message || 'Could not archive product.');
    }
  };

  const handleSyncWhatsApp = async () => {
    setSyncFeedback(null);
    try {
      const res = await syncMutation.mutateAsync();
      setSyncFeedback(`Successfully synced catalog! ${res?.inserted || res?.synced || ''} items updated.`);
    } catch (err: any) {
      setSyncFeedback(err?.response?.data?.error || 'WhatsApp catalog not linked yet. Connect your number first.');
    }
  };

  if (isLoading) return <LoadingScreen />;

  const safeInventory = inventory || [];
  const filteredInventory = safeInventory.filter((item: any) =>
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader
        title="Inventory & CRM"
        rightAction={
          <Pressable
            onPress={openAddPanel}
            style={{ backgroundColor: c.accent, ...shadows.sm }}
            className="w-10 h-10 rounded-full items-center justify-center active:opacity-80"
          >
            <Plus size={20} color={isDark ? '#090A0C' : '#FFFFFF'} />
          </Pressable>
        }
      />
      <View className="px-4 mb-2.5">
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search SKUs, categories, items..." variant="pill" />
      </View>

      <ScrollView className="flex-1 pt-2" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="px-4 mb-4 flex-row justify-between items-center">
          <Text style={{ color: c.textSecondary }} className="text-sm font-bold uppercase tracking-wider">
            Catalog Details
          </Text>
          <Text style={{ color: c.textTertiary }} className="text-xs font-semibold">
            {filteredInventory.length} Items
          </Text>
        </View>

        {filteredInventory.length === 0 ? (
          <View className="mx-4 p-5 rounded-[28px] border border-dashed items-center justify-center mt-4" style={{ borderColor: c.border, backgroundColor: c.surface }}>
            <View style={{ backgroundColor: c.accentSoft }} className="w-14 h-14 rounded-2xl items-center justify-center mb-4">
              <Package size={28} color={c.accent} />
            </View>
            <Text style={{ color: c.textPrimary }} className="text-lg font-bold text-center mb-1">
              Your Catalog is Empty
            </Text>
            <Text style={{ color: c.textSecondary }} className="text-xs text-center mb-6 leading-relaxed px-4">
              Add your products manually or connect your WhatsApp Business account to auto-import your entire store.
            </Text>

            <View className="w-full flex-row" style={{ gap: 10 }}>
              <Pressable
                onPress={openAddPanel}
                style={{ backgroundColor: c.accent }}
                className="flex-1 py-3.5 rounded-2xl items-center justify-center flex-row active:opacity-80"
              >
                <Plus size={16} color={isDark ? '#090A0C' : '#FFFFFF'} />
                <Text style={{ color: isDark ? '#090A0C' : '#FFFFFF' }} className="font-bold text-xs ml-1.5">
                  Add Manually
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.push('/more')}
                style={{ backgroundColor: '#22C55E1A', borderColor: '#22C55E40' }}
                className="flex-1 py-3.5 rounded-2xl border items-center justify-center flex-row active:opacity-80"
              >
                <FontAwesome5 name="whatsapp" size={16} color="#22C55E" />
                <Text style={{ color: '#22C55E' }} className="font-bold text-xs ml-2">
                  Connect WhatsApp
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          filteredInventory.map((item: any, index: number) => {
            const stock = item.stock ?? item.quantity ?? 0;
            const isLowStock = stock <= 5;
            const isOutOfStock = stock === 0;
            const tone = isOutOfStock ? 'danger' : isLowStock ? 'warning' : 'success';
            const label = isOutOfStock ? 'Out of Stock' : `${stock} in stock`;
            const isWhatsApp = item.source === 'whatsapp';

            return (
              <Animated.View key={item.sku || item.id || index} entering={FadeInDown.delay(index * 40).springify()}>
                <View style={{ backgroundColor: c.surface, borderColor: c.border, ...shadows.sm }} className="mx-4 mb-4 p-5 rounded-[24px] border">
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1 pr-3">
                      <View className="flex-row items-center mb-1">
                        <Text style={{ color: c.textPrimary }} className="text-lg font-bold tracking-tight mr-2">
                          {item.name}
                        </Text>
                        {isWhatsApp && (
                          <View style={{ backgroundColor: '#22C55E1A' }} className="px-2 py-0.5 rounded-full flex-row items-center">
                            <FontAwesome5 name="whatsapp" size={10} color="#22C55E" />
                            <Text style={{ color: '#22C55E' }} className="text-[10px] font-bold ml-1">WA</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ color: c.textSecondary }} className="text-xs font-semibold uppercase tracking-wider">
                        {item.category || 'General'}
                      </Text>
                    </View>

                    <View className="flex-row">
                      <Pressable
                        onPress={() => openEditPanel(item)}
                        style={{ backgroundColor: c.surfaceAlt }}
                        className="w-8 h-8 rounded-full items-center justify-center active:opacity-70 mr-2"
                      >
                        <Edit2 size={14} color={c.textPrimary} />
                      </Pressable>
                      <Pressable
                        onPress={() => setPendingDeleteSku(item.sku || item.id)}
                        style={{ backgroundColor: c.dangerSoft }}
                        className="w-8 h-8 rounded-full items-center justify-center active:opacity-70"
                      >
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

                  <View style={{ borderTopWidth: 1, borderTopColor: c.border }} className="pt-3 flex-row justify-between">
                    <View>
                      <Text style={{ color: c.textTertiary }} className="text-[10px] font-bold uppercase tracking-wider mb-0.5">
                        Retail Price
                      </Text>
                      <Text style={{ color: c.textPrimary }} className="text-base font-bold">
                        ₦{Number(item.price || 0).toLocaleString()}
                      </Text>
                    </View>
                    <View className="items-end">
                      <View className="flex-row items-center mb-0.5">
                        <Text style={{ color: c.danger }} className="text-[10px] font-bold uppercase tracking-wider mr-1">
                          Absolute Floor
                        </Text>
                        <TrendingDown size={12} color={c.danger} />
                      </View>
                      <Text style={{ color: c.textPrimary }} className="text-base font-bold">
                        ₦{Number(item.floor || item.price * 0.85 || 0).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      {/* Add / Edit Product Side Panel */}
      <SidePanel
        visible={panelVisible}
        onClose={() => setPanelVisible(false)}
        title={editingSku ? 'Edit Product' : 'Add New Product'}
        subtitle={
          editingSku
            ? 'Update pricing floors, stock, or description.'
            : 'Fill in details below to instantly add to your live catalog.'
        }
      >
        <View className="mb-2">
          {/* Primary Product Information Fields */}
          <PanelField
            label="Product Name"
            value={form.name}
            onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="e.g. Ankara Floral Wrap Dress"
          />

          <PanelField
            label="Retail Price (₦)"
            value={form.price}
            onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
            placeholder="e.g. 25000"
            helper="The standard customer-facing price."
          />

          <PanelField
            label="Absolute Floor Price (₦)"
            value={form.floor}
            onChangeText={(v) => setForm((f) => ({ ...f, floor: v }))}
            placeholder="e.g. 20000"
            helper="The lowest price AI Negotiator can grant VIP customers."
          />

          <PanelField
            label="Stock Quantity"
            value={form.stock}
            onChangeText={(v) => setForm((f) => ({ ...f, stock: v }))}
            placeholder="e.g. 15"
            helper="Available units. At 0, AI marks item as out-of-stock."
          />

          <PanelField
            label="Category"
            value={form.category}
            onChangeText={(v) => setForm((f) => ({ ...f, category: v }))}
            placeholder="e.g. Fabrics, Shoes, Accessories"
          />

          <PanelField
            label="SKU Identifier (Optional)"
            value={form.sku}
            onChangeText={(v) => setForm((f) => ({ ...f, sku: v }))}
            placeholder="e.g. SKU-10492"
            helper="Auto-generated if left unchanged."
          />

          <PanelField
            label="Description (Optional)"
            value={form.description}
            onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
            placeholder="Brief product notes or selling points"
          />

          <Pressable
            onPress={handleSave}
            disabled={addMutation.isPending}
            style={{ backgroundColor: c.accent }}
            className="py-3.5 rounded-2xl items-center justify-center active:opacity-80 mt-3 mb-6"
          >
            {addMutation.isPending ? (
              <InlineLoadingDots color={isDark ? '#090A0C' : '#FFFFFF'} />
            ) : (
              <Text style={{ color: isDark ? '#090A0C' : '#FFFFFF' }} className="font-bold text-sm">
                {editingSku ? 'Save Changes' : 'Add to Catalog'}
              </Text>
            )}
          </Pressable>

          {/* Secondary / Optional WhatsApp Catalog Import */}
          {!editingSku && (
            <View
              style={{ backgroundColor: '#22C55E10', borderColor: '#22C55E25' }}
              className="p-4 rounded-2xl border mb-6"
            >
              <View className="flex-row items-center mb-1.5">
                <FontAwesome5 name="whatsapp" size={16} color="#22C55E" />
                <Text style={{ color: c.textPrimary }} className="font-bold text-xs ml-2">
                  Already have a WhatsApp Business Catalog?
                </Text>
              </View>
              <Text style={{ color: c.textSecondary }} className="text-[11px] leading-relaxed mb-3">
                Auto-import existing catalog items and photos directly from your connected WhatsApp number.
              </Text>

              <View className="flex-row" style={{ gap: 8 }}>
                <Pressable
                  onPress={handleSyncWhatsApp}
                  disabled={syncMutation.isPending}
                  style={{ backgroundColor: '#22C55E' }}
                  className="flex-1 py-2 rounded-xl flex-row items-center justify-center active:opacity-80"
                >
                  {syncMutation.isPending ? (
                    <InlineLoadingDots color="#FFFFFF" />
                  ) : (
                    <>
                      <RefreshCw size={12} color="#FFFFFF" />
                      <Text className="text-white text-xs font-bold ml-1.5">Sync Catalog</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => {
                    setPanelVisible(false);
                    router.push('/more');
                  }}
                  style={{ backgroundColor: c.surfaceAlt }}
                  className="px-3 py-2 rounded-xl flex-row items-center justify-center active:opacity-80"
                >
                  <Text style={{ color: c.textPrimary }} className="text-xs font-semibold mr-1">
                    Link Device
                  </Text>
                  <ExternalLink size={11} color={c.textTertiary} />
                </Pressable>
              </View>

              {syncFeedback && (
                <Text
                  style={{ color: syncFeedback.includes('Success') ? '#22C55E' : '#EF4444' }}
                  className="text-xs mt-2 font-medium"
                >
                  {syncFeedback}
                </Text>
              )}
            </View>
          )}
        </View>
      </SidePanel>

      {/* Delete Confirmation Dialog with Soft-Delete / Archive support */}
      <ConfirmDialog
        visible={pendingDeleteSku !== null}
        title="Remove Product"
        message="Choose whether to archive this product (hides from WhatsApp catalog while preserving past sales data) or permanently delete it."
        itemName={inventory?.find((i: any) => (i.sku || i.id) === pendingDeleteSku)?.name || pendingDeleteSku || undefined}
        confirmLabel="🗑️ Permanently Delete"
        softDeleteLabel="📦 Archive (Soft Delete)"
        onSoftDelete={handleSoftDelete}
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteSku(null)}
      />
    </View>
  );
}
