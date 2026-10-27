import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Switch, Pressable, Modal } from 'react-native';
import { useColorScheme } from 'nativewind';
import { useRouter } from 'expo-router';
import { useAlert } from '../src/store/alertStore';
import {
  Bell,
  BellOff,
  Smartphone,
  Mail,
  MessageCircle,
  Moon,
  ShoppingBag,
  Sparkles,
  Package,
  ShieldCheck,
  Megaphone,
  History,
  RotateCcw,
  Trash2,
  ChevronRight,
  Check,
  AlertTriangle,
} from 'lucide-react-native';
import { colors } from '../theme';
import { ScreenHeader } from '../src/components/ScreenHeader';

type C = typeof colors.light;

function useNotificationPermission(): 'granted' | 'denied' | 'undetermined' {
  return 'granted';
}

type Frequency = 'off' | 'daily' | 'weekly';
const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

function formatTime(hhmm: string) {
  const [hStr, m] = hhmm.split(':');
  const h = Number(hStr);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${m} ${period}`;
}

function SectionHeader({ label, c }: { label: string; c: C }) {
  return (
    <Text style={{ color: c.textTertiary }} className="text-xs font-bold uppercase tracking-wider mb-3 mt-2">
      {label}
    </Text>
  );
}

function IconBadge({ icon, bg, c }: { icon: React.ReactNode; bg?: string; c: C }) {
  return (
    <View
      style={{ backgroundColor: bg ?? c.surfaceAlt }}
      className="w-10 h-10 rounded-2xl items-center justify-center mr-4"
    >
      {icon}
    </View>
  );
}

type ToggleRowProps = {
  icon?: React.ReactNode;
  iconBg?: string;
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  last?: boolean;
  c: C;
};

function ToggleRow({ icon, iconBg, title, subtitle, value, onValueChange, disabled, last, c }: ToggleRowProps) {
  return (
    <View
      style={{ borderColor: c.border }}
      className={`flex-row items-center py-4 ${last ? '' : 'border-b'}`}
    >
      {icon && <IconBadge icon={icon} bg={iconBg} c={c} />}
      <View className="flex-1 pr-4" style={{ opacity: disabled ? 0.45 : 1 }}>
        <Text style={{ color: c.textPrimary }} className="text-sm font-bold mb-1">
          {title}
        </Text>
        <Text style={{ color: c.textSecondary }} className="text-xs leading-relaxed">
          {subtitle}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: c.surfaceAlt, true: c.accentSoft }}
        thumbColor={value ? c.accent : c.textTertiary}
      />
    </View>
  );
}

function SegmentedControl({
  value,
  onChange,
  disabled,
  c,
}: {
  value: Frequency;
  onChange: (v: Frequency) => void;
  disabled?: boolean;
  c: C;
}) {
  return (
    <View
      style={{ backgroundColor: c.surfaceAlt, opacity: disabled ? 0.45 : 1 }}
      className="flex-row rounded-2xl p-1"
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      {FREQUENCY_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={{ backgroundColor: active ? c.accent : 'transparent' }}
            className="flex-1 py-2 rounded-xl items-center"
          >
            <Text
              style={{ color: active ? '#FFFFFF' : c.textSecondary }}
              className="text-xs font-bold"
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TimePickerRow({
  label,
  value,
  onPress,
  disabled,
  last,
  c,
}: {
  label: string;
  value: string;
  onPress: () => void;
  disabled?: boolean;
  last?: boolean;
  c: C;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={{ borderColor: c.border, opacity: disabled ? 0.45 : 1 }}
      className={`flex-row items-center justify-between py-4 ${last ? '' : 'border-b'}`}
    >
      <Text style={{ color: c.textPrimary }} className="text-sm font-bold">
        {label}
      </Text>
      <View className="flex-row items-center">
        <Text style={{ color: c.textSecondary }} className="text-sm mr-1">
          {formatTime(value)}
        </Text>
        <ChevronRight size={16} color={c.textTertiary} />
      </View>
    </Pressable>
  );
}

function TimePickerModal({
  visible,
  title,
  value,
  onSelect,
  onClose,
  c,
}: {
  visible: boolean;
  title: string;
  value: string;
  onSelect: (time: string) => void;
  onClose: () => void;
  c: C;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: c.bg }}
          className="rounded-t-3xl max-h-[70%]"
        >
          <View style={{ borderColor: c.border }} className="px-4 py-4 border-b items-center">
            <View style={{ backgroundColor: c.border }} className="w-10 h-1 rounded-full mb-3" />
            <Text style={{ color: c.textPrimary }} className="text-base font-bold">
              {title}
            </Text>
          </View>
          <ScrollView className="px-4" contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24 }}>
            {TIME_OPTIONS.map((time) => {
              const selected = time === value;
              return (
                <Pressable
                  key={time}
                  onPress={() => {
                    onSelect(time);
                    onClose();
                  }}
                  className="flex-row items-center justify-between py-3"
                >
                  <Text
                    style={{ color: selected ? c.accent : c.textPrimary }}
                    className={`text-sm ${selected ? 'font-bold' : ''}`}
                  >
                    {formatTime(time)}
                  </Text>
                  {selected && <Check size={16} color={c.accent} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function NotificationsScreen() {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;
  const permission = useNotificationPermission();
  const alert = useAlert();
  const router = useRouter();

  const [allEnabled, setAllEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [emailFrequency, setEmailFrequency] = useState<Frequency>('daily');
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [pickerOpen, setPickerOpen] = useState<'start' | 'end' | null>(null);

  const [notifyOrders, setNotifyOrders] = useState(true);
  const [notifyPaymentFailures, setNotifyPaymentFailures] = useState(true);
  const [notifyApprovals, setNotifyApprovals] = useState(true);
  const [notifyLowConfidence, setNotifyLowConfidence] = useState(true);
  const [notifyRestocks, setNotifyRestocks] = useState(false);
  const [notifyRestockConfirmed, setNotifyRestockConfirmed] = useState(false);
  const [notifyNewDevice, setNotifyNewDevice] = useState(true);
  const [notifyPasswordChange, setNotifyPasswordChange] = useState(true);
  const [notifyMarketing, setNotifyMarketing] = useState(false);

  const disabled = !allEnabled;

  const defaults = useMemo(
    () => ({
      pushEnabled: true,
      whatsappEnabled: true,
      emailFrequency: 'daily' as Frequency,
      quietHoursEnabled: false,
      quietStart: '22:00',
      quietEnd: '07:00',
      notifyOrders: true,
      notifyPaymentFailures: true,
      notifyApprovals: true,
      notifyLowConfidence: true,
      notifyRestocks: false,
      notifyRestockConfirmed: false,
      notifyNewDevice: true,
      notifyPasswordChange: true,
      notifyMarketing: false,
    }),
    []
  );

  function handleReset() {
    alert.showConfirm({
      title: 'Reset Notification Settings?',
      message: 'This will restore every notification toggle and digest preference to defaults.',
      confirmLabel: 'Reset All',
      destructive: true,
      onConfirm: () => {
        setAllEnabled(true);
        setPushEnabled(defaults.pushEnabled);
        setWhatsappEnabled(defaults.whatsappEnabled);
        setEmailFrequency(defaults.emailFrequency);
        setQuietHoursEnabled(defaults.quietHoursEnabled);
        setQuietStart(defaults.quietStart);
        setQuietEnd(defaults.quietEnd);
        setNotifyOrders(defaults.notifyOrders);
        setNotifyPaymentFailures(defaults.notifyPaymentFailures);
        setNotifyApprovals(defaults.notifyApprovals);
        setNotifyLowConfidence(defaults.notifyLowConfidence);
        setNotifyRestocks(defaults.notifyRestocks);
        setNotifyRestockConfirmed(defaults.notifyRestockConfirmed);
        setNotifyNewDevice(defaults.notifyNewDevice);
        setNotifyPasswordChange(defaults.notifyPasswordChange);
        setNotifyMarketing(defaults.notifyMarketing);
        alert.success('Settings Restored', 'Notification settings have been reset to system defaults.');
      },
    });
  }

  function handleTestNotification() {
    alert.info('Test Push Notification', "This is a preview of an incoming Biblo real-time push notification.");
  }

  function handleClearBadge() {
    alert.success('Badge Cleared', 'Your app icon unread badge count has been reset.');
  }

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader title="Notifications" variant="bar" />

      <ScrollView className="flex-1 px-4 pt-3" contentContainerStyle={{ paddingBottom: 100 }}>
        {permission === 'denied' && (
          <View
            style={{ backgroundColor: '#F59E0B1A', borderColor: '#F59E0B40' }}
            className="flex-row items-start p-4 rounded-2xl border mb-6"
          >
            <AlertTriangle size={18} color="#F59E0B" style={{ marginTop: 1 }} />
            <View className="flex-1 ml-3">
              <Text style={{ color: c.textPrimary }} className="text-sm font-bold mb-1">
                Push notifications are off at the system level
              </Text>
              <Text style={{ color: c.textSecondary }} className="text-xs leading-relaxed mb-2">
                Turn them on in your device settings to receive alerts from Biblo.
              </Text>
              <Pressable onPress={() => alert.info('Device Settings', 'Open your phone Settings > Biblo to enable push notification permissions.')}>
                <Text style={{ color: '#F59E0B' }} className="text-xs font-bold">
                  Open Settings
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Master switch */}
        <View
          style={{ backgroundColor: c.surface, borderColor: c.border }}
          className="flex-row items-center px-5 py-4 rounded-3xl border mb-8"
        >
          <IconBadge
            icon={allEnabled ? <Bell size={20} color={c.accent} /> : <BellOff size={20} color={c.textTertiary} />}
            bg={allEnabled ? c.accentSoft : c.surfaceAlt}
            c={c}
          />
          <View className="flex-1 pr-4">
            <Text style={{ color: c.textPrimary }} className="text-sm font-bold mb-1">
              All Notifications
            </Text>
            <Text style={{ color: c.textSecondary }} className="text-xs leading-relaxed">
              {allEnabled ? 'Biblo can notify you below.' : 'Everything below is paused.'}
            </Text>
          </View>
          <Switch
            value={allEnabled}
            onValueChange={setAllEnabled}
            trackColor={{ false: c.surfaceAlt, true: c.accentSoft }}
            thumbColor={allEnabled ? c.accent : c.textTertiary}
          />
        </View>

        <SectionHeader label="Delivery Methods" c={c} />
        <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="px-5 rounded-3xl border mb-8">
          <ToggleRow
            icon={<Smartphone size={18} color={c.textPrimary} />}
            title="Push Notifications"
            subtitle="Receive alerts directly on your device."
            value={pushEnabled}
            onValueChange={setPushEnabled}
            disabled={disabled}
            c={c}
          />
          <ToggleRow
            icon={<MessageCircle size={18} color="#22C55E" />}
            iconBg="#22C55E1A"
            title="WhatsApp Alerts"
            subtitle="Get urgent alerts on WhatsApp, same place your customers message you."
            value={whatsappEnabled}
            onValueChange={setWhatsappEnabled}
            disabled={disabled}
            c={c}
          />

          <View style={{ borderColor: c.border, opacity: disabled ? 0.45 : 1 }} className="py-4">
            <View className="flex-row items-center mb-3">
              <IconBadge icon={<Mail size={18} color={c.textPrimary} />} c={c} />
              <View className="flex-1">
                <Text style={{ color: c.textPrimary }} className="text-sm font-bold mb-1">
                  Email Digest
                </Text>
                <Text style={{ color: c.textSecondary }} className="text-xs leading-relaxed">
                  A summary of AI actions, sent to your inbox.
                </Text>
              </View>
            </View>
            <SegmentedControl value={emailFrequency} onChange={setEmailFrequency} disabled={disabled} c={c} />
          </View>

          <Pressable
            onPress={disabled || !pushEnabled ? undefined : handleTestNotification}
            style={{ opacity: disabled || !pushEnabled ? 0.4 : 1 }}
            className="py-4"
          >
            <Text style={{ color: c.accent }} className="text-xs font-bold text-center">
              Send me a test notification
            </Text>
          </Pressable>
        </View>

        <SectionHeader label="Quiet Hours" c={c} />
        <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="px-5 rounded-3xl border mb-8">
          <ToggleRow
            icon={<Moon size={18} color={c.textPrimary} />}
            title="Do Not Disturb"
            subtitle="Pause non-urgent alerts during these hours. Order and security alerts still come through."
            value={quietHoursEnabled}
            onValueChange={setQuietHoursEnabled}
            disabled={disabled}
            c={c}
          />
          <TimePickerRow
            label="Starts at"
            value={quietStart}
            onPress={() => setPickerOpen('start')}
            disabled={disabled || !quietHoursEnabled}
            c={c}
          />
          <TimePickerRow
            label="Ends at"
            value={quietEnd}
            onPress={() => setPickerOpen('end')}
            disabled={disabled || !quietHoursEnabled}
            last
            c={c}
          />
        </View>

        <SectionHeader label="Orders & Payments" c={c} />
        <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="px-5 rounded-3xl border mb-8">
          <ToggleRow
            icon={<ShoppingBag size={18} color={c.textPrimary} />}
            title="New Orders"
            subtitle="Alert when a customer successfully pays."
            value={notifyOrders}
            onValueChange={setNotifyOrders}
            disabled={disabled}
            c={c}
          />
          <ToggleRow
            icon={<AlertTriangle size={18} color="#EF4444" />}
            iconBg="#EF44441A"
            title="Payment Failures"
            subtitle="Alert when a customer's payment doesn't go through."
            value={notifyPaymentFailures}
            onValueChange={setNotifyPaymentFailures}
            disabled={disabled}
            last
            c={c}
          />
        </View>

        <SectionHeader label="AI & Approvals" c={c} />
        <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="px-5 rounded-3xl border mb-8">
          <ToggleRow
            icon={<Sparkles size={18} color={c.accent} />}
            iconBg={c.accentSoft}
            title="Inbox Approvals"
            subtitle="Alert when the AI drafts a response needing your review."
            value={notifyApprovals}
            onValueChange={setNotifyApprovals}
            disabled={disabled}
            c={c}
          />
          <ToggleRow
            icon={<Sparkles size={18} color={c.textTertiary} />}
            title="Low-Confidence Flags"
            subtitle="Alert when the AI isn't sure how to respond and needs you."
            value={notifyLowConfidence}
            onValueChange={setNotifyLowConfidence}
            disabled={disabled}
            last
            c={c}
          />
        </View>

        <SectionHeader label="Inventory" c={c} />
        <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="px-5 rounded-3xl border mb-8">
          <ToggleRow
            icon={<Package size={18} color={c.textPrimary} />}
            title="Low Stock Warnings"
            subtitle="Alert when an item is nearing depletion."
            value={notifyRestocks}
            onValueChange={setNotifyRestocks}
            disabled={disabled}
            c={c}
          />
          <ToggleRow
            icon={<Package size={18} color={c.textPrimary} />}
            title="Restock Confirmations"
            subtitle="Alert once a supplier restock has been logged."
            value={notifyRestockConfirmed}
            onValueChange={setNotifyRestockConfirmed}
            disabled={disabled}
            last
            c={c}
          />
        </View>

        <SectionHeader label="Account & Security" c={c} />
        <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="px-5 rounded-3xl border mb-8">
          <ToggleRow
            icon={<ShieldCheck size={18} color={c.textPrimary} />}
            title="New Device Login"
            subtitle="Alert when your account is signed in from a new device."
            value={notifyNewDevice}
            onValueChange={setNotifyNewDevice}
            disabled={disabled}
            c={c}
          />
          <ToggleRow
            icon={<ShieldCheck size={18} color={c.textPrimary} />}
            title="Password Changes"
            subtitle="Alert whenever your password is changed."
            value={notifyPasswordChange}
            onValueChange={setNotifyPasswordChange}
            disabled={disabled}
            last
            c={c}
          />
        </View>

        <SectionHeader label="Marketing" c={c} />
        <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="px-5 rounded-3xl border mb-8">
          <ToggleRow
            icon={<Megaphone size={18} color={c.textPrimary} />}
            title="Marketing & Updates"
            subtitle="News about Biblo updates."
            value={notifyMarketing}
            onValueChange={setNotifyMarketing}
            disabled={disabled}
            last
            c={c}
          />
        </View>

        <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="px-5 rounded-3xl border mb-8">
          <Pressable
            onPress={() => router.push('/notification-history')}
            style={{ borderColor: c.border }}
            className="flex-row items-center justify-between py-4 border-b"
          >
            <View className="flex-row items-center">
              <IconBadge icon={<History size={18} color={c.textPrimary} />} c={c} />
              <Text style={{ color: c.textPrimary }} className="text-sm font-bold">
                View Notification History
              </Text>
            </View>
            <ChevronRight size={16} color={c.textTertiary} />
          </Pressable>

          <Pressable onPress={handleClearBadge} className="flex-row items-center justify-between py-4 border-b" style={{ borderColor: c.border }}>
            <View className="flex-row items-center">
              <IconBadge icon={<Trash2 size={18} color={c.textPrimary} />} c={c} />
              <Text style={{ color: c.textPrimary }} className="text-sm font-bold">
                Clear App Badge
              </Text>
            </View>
            <ChevronRight size={16} color={c.textTertiary} />
          </Pressable>

          <Pressable onPress={handleReset} className="flex-row items-center justify-between py-4">
            <View className="flex-row items-center">
              <IconBadge icon={<RotateCcw size={18} color="#EF4444" />} bg="#EF44441A" c={c} />
              <Text style={{ color: '#EF4444' }} className="text-sm font-bold">
                Reset to Defaults
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      <TimePickerModal
        visible={pickerOpen === 'start'}
        title="Quiet hours start"
        value={quietStart}
        onSelect={setQuietStart}
        onClose={() => setPickerOpen(null)}
        c={c}
      />
      <TimePickerModal
        visible={pickerOpen === 'end'}
        title="Quiet hours end"
        value={quietEnd}
        onSelect={setQuietEnd}
        onClose={() => setPickerOpen(null)}
        c={c}
      />
    </View>
  );
}
