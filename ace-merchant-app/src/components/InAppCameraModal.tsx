import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  Image,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { CameraView, CameraType, FlashMode, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { safeHaptics } from '../utils/sanitizers';
import {
  Camera,
  SwitchCamera,
  Zap,
  ZapOff,
  RotateCcw,
  Check,
  X,
  Package,
  FileText,
  CreditCard,
  ShieldCheck,
  Image as ImageIcon,
  Send,
} from 'lucide-react-native';

export type AttachmentType =
  | 'product_photo'
  | 'supplier_invoice'
  | 'payment_receipt'
  | 'business_doc';

export interface CapturedMediaResult {
  uri: string;
  base64: string;
  type: AttachmentType;
  note?: string;
}

interface InAppCameraModalProps {
  visible: boolean;
  initialCategory?: AttachmentType;
  onClose: () => void;
  onCapture: (captured: CapturedMediaResult) => void;
}

const CATEGORIES: {
  id: AttachmentType;
  label: string;
  shortLabel: string;
  color: string;
  hint: string;
  icon: any;
}[] = [
  {
    id: 'product_photo',
    label: 'Product Photo',
    shortLabel: 'Product',
    color: '#10B981',
    hint: 'Frame the item clearly under good lighting',
    icon: Package,
  },
  {
    id: 'supplier_invoice',
    label: 'Supplier Invoice',
    shortLabel: 'Invoice',
    color: '#F59E0B',
    hint: 'Align invoice borders for wholesale OCR',
    icon: FileText,
  },
  {
    id: 'payment_receipt',
    label: 'Transfer Slip',
    shortLabel: 'Receipt',
    color: '#3B82F6',
    hint: 'Ensure session ID and amount are legible',
    icon: CreditCard,
  },
  {
    id: 'business_doc',
    label: 'CAC Document',
    shortLabel: 'CAC Doc',
    color: '#A855F7',
    hint: 'Capture full certificate with RC number',
    icon: ShieldCheck,
  },
];

export default function InAppCameraModal({
  visible,
  initialCategory = 'product_photo',
  onClose,
  onCapture,
}: InAppCameraModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [category, setCategory] = useState<AttachmentType>(initialCategory);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [note, setNote] = useState('');

  // Sync initial category when opening
  React.useEffect(() => {
    if (visible) {
      setCategory(initialCategory);
      setCapturedPhoto(null);
      setNote('');
    }
  }, [visible, initialCategory]);

  const activeCategoryConfig = CATEGORIES.find((c) => c.id === category) || CATEGORIES[0];
  const ActiveIcon = activeCategoryConfig.icon;

  const handleToggleFacing = () => {
    safeHaptics.impact();
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  const handleToggleFlash = () => {
    safeHaptics.impact();
    setFlash((prev) => (prev === 'off' ? 'on' : 'off'));
  };

  const handleTakePicture = async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      safeHaptics.impact();

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: true,
      });

      if (photo && photo.uri) {
        setCapturedPhoto({
          uri: photo.uri,
          base64: photo.base64 || '',
        });
      }
    } catch (err) {
      console.error('[InAppCamera] Capture error:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const handlePickFromLibrary = async () => {
    safeHaptics.impact();
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setCapturedPhoto({
          uri: result.assets[0].uri,
          base64: result.assets[0].base64 || '',
        });
      }
    } catch (err) {
      console.warn('[InAppCamera] Library pick error:', err);
    }
  };

  const handleRetake = () => {
    safeHaptics.impact();
    setCapturedPhoto(null);
    setNote('');
  };

  const handleConfirm = () => {
    if (!capturedPhoto) return;
    safeHaptics.impact();

    onCapture({
      uri: capturedPhoto.uri,
      base64: capturedPhoto.base64,
      type: category,
      note: note.trim() || undefined,
    });

    onClose();
  };

  const handleRequestPermission = async () => {
    safeHaptics.impact();
    if (permission && !permission.granted && !permission.canAskAgain) {
      await Linking.openSettings();
      return;
    }
    await requestPermission();
  };

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]} className="flex-1 bg-black">
      {/* ─── Permission Check Screen ─── */}
      {!permission?.granted ? (
        <View className="flex-1 items-center justify-center p-6 bg-[#0B0F0E]">
          <View className="w-20 h-20 rounded-full bg-emerald-500/20 items-center justify-center mb-5 border border-emerald-500/30">
            <Camera size={36} color="#10B981" />
          </View>
          <Text className="text-white text-xl font-bold text-center mb-2">
            Camera Access Required
          </Text>
          <Text className="text-zinc-400 text-sm text-center mb-8 max-w-xs leading-5">
            Biblio Assistant needs camera permission to capture live product photos, scan supplier
            restock invoices, transfer receipts, and CAC documents.
          </Text>
          <View className="w-full gap-3">
            <Pressable
              onPress={handleRequestPermission}
              className="w-full py-4 rounded-2xl bg-emerald-500 items-center justify-center active:opacity-80"
            >
              <Text className="text-black font-bold text-base">
                {permission && !permission.granted && !permission.canAskAgain
                  ? 'Open System Settings'
                  : 'Allow Camera Access'}
              </Text>
            </Pressable>
            <Pressable
              onPress={handlePickFromLibrary}
              className="w-full py-3.5 rounded-2xl bg-zinc-800/80 items-center justify-center border border-zinc-700 active:opacity-80 flex-row gap-2"
            >
              <ImageIcon size={18} color="#E4E4E7" />
              <Text className="text-zinc-200 font-semibold text-sm">Choose from Photo Library</Text>
            </Pressable>
            <Pressable onPress={onClose} className="w-full py-2.5 items-center justify-center">
              <Text className="text-zinc-500 font-semibold text-sm">Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : capturedPhoto ? (
          /* ─── Photo Review & Confirmation Screen ─── */
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="flex-1 bg-black"
          >
            <Image
              source={{ uri: capturedPhoto.uri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />

            {/* Top Bar on Review Screen */}
            <View className="pt-12 px-4 pb-4 flex-row items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
              <Pressable
                onPress={handleRetake}
                className="w-10 h-10 rounded-full bg-black/60 items-center justify-center border border-white/20 active:opacity-70"
              >
                <X size={20} color="#FFFFFF" />
              </Pressable>

              <View
                style={{
                  backgroundColor: `${activeCategoryConfig.color}25`,
                  borderColor: activeCategoryConfig.color,
                }}
                className="px-3.5 py-1.5 rounded-full border flex-row items-center gap-1.5 backdrop-blur-md"
              >
                <ActiveIcon size={14} color={activeCategoryConfig.color} />
                <Text
                  style={{ color: activeCategoryConfig.color }}
                  className="text-xs font-bold uppercase tracking-wider"
                >
                  {activeCategoryConfig.label}
                </Text>
              </View>

              <View className="w-10" />
            </View>

            {/* Spacer */}
            <View className="flex-1" />

            {/* Bottom Review Controls */}
            <View className="p-5 bg-black/85 border-t border-white/10 gap-3.5">
              {/* Category Pill Switcher (Allows Changing Category After Snap) */}
              <View className="flex-row items-center gap-2">
                {CATEGORIES.map((cat) => {
                  const isSelected = cat.id === category;
                  const Icon = cat.icon;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => {
                        safeHaptics.impact();
                        setCategory(cat.id);
                      }}
                      style={{
                        backgroundColor: isSelected ? cat.color : 'rgba(255,255,255,0.08)',
                        borderColor: isSelected ? cat.color : 'rgba(255,255,255,0.15)',
                      }}
                      className="px-3 py-1.5 rounded-full border flex-row items-center gap-1"
                    >
                      <Icon size={12} color={isSelected ? '#000000' : '#FFFFFF'} />
                      <Text
                        style={{ color: isSelected ? '#000000' : '#D4D4D8' }}
                        className="text-[11px] font-bold"
                      >
                        {cat.shortLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Optional Merchant Note Field */}
              <View className="flex-row items-center bg-zinc-900/90 rounded-2xl px-4 py-2.5 border border-white/10">
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder={`Add note for ${activeCategoryConfig.shortLabel} (e.g. price, supplier)...`}
                  placeholderTextColor="#71717A"
                  className="flex-1 text-white text-sm"
                  multiline={false}
                />
              </View>

              {/* Retake vs Use Photo Actions */}
              <View className="flex-row items-center gap-3">
                <Pressable
                  onPress={handleRetake}
                  className="flex-1 py-3.5 rounded-2xl bg-zinc-800/90 items-center justify-center border border-zinc-700 flex-row gap-2 active:opacity-70"
                >
                  <RotateCcw size={16} color="#E4E4E7" />
                  <Text className="text-zinc-200 font-bold text-sm">Retake</Text>
                </Pressable>

                <Pressable
                  onPress={handleConfirm}
                  style={{ backgroundColor: activeCategoryConfig.color }}
                  className="flex-2 py-3.5 rounded-2xl items-center justify-center flex-row gap-2 active:opacity-80 px-6"
                >
                  <Check size={18} color="#000000" />
                  <Text className="text-black font-extrabold text-sm">Send to Copilot</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        ) : (
          /* ─── Live Viewfinder Screen ─── */
          <View className="flex-1">
            <CameraView
              ref={cameraRef}
              facing={facing}
              flash={flash}
              style={StyleSheet.absoluteFill}
            />

            {/* Top Bar Controls */}
            <View className="pt-12 px-4 pb-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
              <View className="flex-row items-center justify-between mb-3">
                {/* Close Button */}
                <Pressable
                  onPress={onClose}
                  className="w-10 h-10 rounded-full bg-black/50 items-center justify-center border border-white/20 active:opacity-70 backdrop-blur-md"
                >
                  <X size={20} color="#FFFFFF" />
                </Pressable>

                {/* Live Mode Title */}
                <View className="items-center">
                  <View className="flex-row items-center gap-1.5">
                    <View className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <Text className="text-white text-xs font-bold uppercase tracking-widest">
                      In-App Camera
                    </Text>
                  </View>
                  <Text className="text-zinc-300 text-[10px] mt-0.5">
                    {activeCategoryConfig.hint}
                  </Text>
                </View>

                {/* Flash Toggle */}
                <Pressable
                  onPress={handleToggleFlash}
                  className="w-10 h-10 rounded-full bg-black/50 items-center justify-center border border-white/20 active:opacity-70 backdrop-blur-md"
                >
                  {flash === 'on' ? (
                    <Zap size={18} color="#FBBF24" />
                  ) : (
                    <ZapOff size={18} color="#A1A1AA" />
                  )}
                </Pressable>
              </View>

              {/* Category Pills Along Top */}
              <View className="flex-row items-center justify-center gap-2">
                {CATEGORIES.map((cat) => {
                  const isSelected = cat.id === category;
                  const Icon = cat.icon;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => {
                        safeHaptics.impact();
                        setCategory(cat.id);
                      }}
                      style={{
                        backgroundColor: isSelected ? cat.color : 'rgba(0,0,0,0.5)',
                        borderColor: isSelected ? cat.color : 'rgba(255,255,255,0.2)',
                      }}
                      className="px-3 py-1.5 rounded-full border flex-row items-center gap-1.5 backdrop-blur-md"
                    >
                      <Icon size={12} color={isSelected ? '#000000' : '#FFFFFF'} />
                      <Text
                        style={{ color: isSelected ? '#000000' : '#E4E4E7' }}
                        className="text-[11px] font-bold"
                      >
                        {cat.shortLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Viewfinder Reticle / Alignment Guide in Center */}
            <View className="flex-1 items-center justify-center pointer-events-none p-8">
              <View
                style={{
                  borderColor: activeCategoryConfig.color,
                  borderWidth: 2,
                  borderRadius: 24,
                  borderStyle: 'dashed',
                }}
                className="w-full h-80 opacity-60 items-center justify-center"
              >
                <ActiveIcon size={32} color={activeCategoryConfig.color} opacity={0.6} />
                <Text
                  style={{ color: activeCategoryConfig.color }}
                  className="text-xs font-semibold mt-2 opacity-80"
                >
                  {activeCategoryConfig.label}
                </Text>
              </View>
            </View>

            {/* Bottom Controls Bar */}
            <View className="pb-12 pt-6 px-8 flex-row items-center justify-between bg-gradient-to-t from-black/90 via-black/60 to-transparent">
              {/* Photo Library Picker */}
              <Pressable
                onPress={handlePickFromLibrary}
                className="w-12 h-12 rounded-full bg-black/60 items-center justify-center border border-white/20 active:opacity-70 backdrop-blur-md"
              >
                <ImageIcon size={22} color="#FFFFFF" />
              </Pressable>

              {/* Big Shutter Button */}
              <Pressable
                onPress={handleTakePicture}
                disabled={isCapturing}
                className="items-center justify-center active:scale-95"
              >
                <View
                  style={{ borderColor: activeCategoryConfig.color }}
                  className="w-20 h-20 rounded-full border-4 items-center justify-center p-1"
                >
                  <View className="w-full h-full rounded-full bg-white items-center justify-center">
                    {isCapturing ? (
                      <ActivityIndicator size="small" color="#000000" />
                    ) : (
                      <View
                        style={{ backgroundColor: activeCategoryConfig.color }}
                        className="w-4 h-4 rounded-full"
                      />
                    )}
                  </View>
                </View>
              </Pressable>

              {/* Flip Facing (Front/Back) */}
              <Pressable
                onPress={handleToggleFacing}
                className="w-12 h-12 rounded-full bg-black/60 items-center justify-center border border-white/20 active:opacity-70 backdrop-blur-md"
              >
                <SwitchCamera size={22} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        )}
    </View>
  );
}
