import { create } from 'zustand';
import { AlertAction, AlertVariant } from '../components/CustomAlertModal';

export interface AlertModalOptions {
  title: string;
  message?: string;
  variant?: AlertVariant;
  icon?: React.ReactNode;
  badge?: string;
  itemName?: string;
  actions?: AlertAction[];
  children?: React.ReactNode;
  dismissible?: boolean;
  buttonLayout?: 'row' | 'column' | 'auto';
  onClose?: () => void;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  variant?: AlertVariant;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export interface SoftDeleteOptions {
  title: string;
  message?: string;
  itemName?: string;
  softDeleteLabel?: string;
  permanentDeleteLabel?: string;
  cancelLabel?: string;
  onSoftDelete: () => void | Promise<void>;
  onPermanentDelete: () => void | Promise<void>;
  onCancel?: () => void;
}

interface AlertState {
  isOpen: boolean;
  options: AlertModalOptions | null;
  showAlert: (options: AlertModalOptions) => void;
  showConfirm: (options: ConfirmOptions) => void;
  showSoftDelete: (options: SoftDeleteOptions) => void;
  info: (title: string, message?: string, onOk?: () => void) => void;
  success: (title: string, message?: string, onOk?: () => void) => void;
  warning: (title: string, message?: string, onOk?: () => void) => void;
  error: (title: string, message?: string, onOk?: () => void) => void;
  closeAlert: () => void;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  isOpen: false,
  options: null,

  showAlert: (options) => {
    set({
      isOpen: true,
      options,
    });
  },

  showConfirm: ({
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
    variant,
    onConfirm,
    onCancel,
  }) => {
    set({
      isOpen: true,
      options: {
        title,
        message,
        variant: variant || (destructive ? 'danger' : 'warning'),
        buttonLayout: 'row',
        actions: [
          {
            label: cancelLabel,
            variant: 'cancel',
            onPress: () => {
              if (onCancel) onCancel();
            },
          },
          {
            label: confirmLabel,
            variant: destructive ? 'destructive' : 'primary',
            onPress: onConfirm,
          },
        ],
        onClose: onCancel,
      },
    });
  },

  showSoftDelete: ({
    title,
    message,
    itemName,
    softDeleteLabel = '📦 Archive (Soft Delete)',
    permanentDeleteLabel = '🗑️ Delete Permanently',
    cancelLabel = 'Cancel',
    onSoftDelete,
    onPermanentDelete,
    onCancel,
  }) => {
    set({
      isOpen: true,
      options: {
        title,
        message:
          message ||
          'Soft-deleting archives this item so it is hidden from the catalog while preserving historical order analytics.',
        variant: 'soft-delete',
        itemName,
        badge: 'Archive Mode',
        buttonLayout: 'column',
        actions: [
          {
            label: softDeleteLabel,
            variant: 'soft-delete',
            onPress: onSoftDelete,
          },
          {
            label: permanentDeleteLabel,
            variant: 'destructive',
            onPress: onPermanentDelete,
          },
          {
            label: cancelLabel,
            variant: 'cancel',
            onPress: () => {
              if (onCancel) onCancel();
            },
          },
        ],
        onClose: onCancel,
      },
    });
  },

  info: (title, message, onOk) => {
    get().showAlert({
      title,
      message,
      variant: 'info',
      actions: [{ label: 'OK', variant: 'primary', onPress: onOk }],
    });
  },

  success: (title, message, onOk) => {
    get().showAlert({
      title,
      message,
      variant: 'success',
      actions: [{ label: 'OK', variant: 'primary', onPress: onOk }],
    });
  },

  warning: (title, message, onOk) => {
    get().showAlert({
      title,
      message,
      variant: 'warning',
      actions: [{ label: 'OK', variant: 'primary', onPress: onOk }],
    });
  },

  error: (title, message, onOk) => {
    get().showAlert({
      title,
      message,
      variant: 'danger',
      actions: [{ label: 'OK', variant: 'primary', onPress: onOk }],
    });
  },

  closeAlert: () => {
    const currentOnClose = get().options?.onClose;
    if (currentOnClose) currentOnClose();
    set({ isOpen: false, options: null });
  },
}));

/**
 * Convenient hook export
 */
export const useAlert = () => useAlertStore();
