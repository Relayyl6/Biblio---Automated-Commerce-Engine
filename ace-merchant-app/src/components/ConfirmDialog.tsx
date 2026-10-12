import React from 'react';
import { CustomAlertModal, AlertAction, AlertVariant } from './CustomAlertModal';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  variant?: AlertVariant;
  itemName?: string;
  badge?: string;
  softDeleteLabel?: string;
  onSoftDelete?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  actions?: AlertAction[];
  children?: React.ReactNode;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  variant,
  itemName,
  badge,
  softDeleteLabel,
  onSoftDelete,
  onConfirm,
  onCancel,
  actions,
  children,
}: ConfirmDialogProps) {
  // If caller provided explicit custom actions, use them
  if (actions && actions.length > 0) {
    return (
      <CustomAlertModal
        visible={visible}
        title={title}
        message={message}
        variant={variant || (destructive ? 'danger' : 'warning')}
        itemName={itemName}
        badge={badge}
        actions={actions}
        onClose={onCancel}
      >
        {children}
      </CustomAlertModal>
    );
  }

  // Build actions list supporting Cancel, Soft Delete (optional), and Confirm/Destructive
  const dialogActions: AlertAction[] = [];

  // If soft delete handler is provided, make it a 3-tier action dialog
  if (onSoftDelete) {
    dialogActions.push({
      label: softDeleteLabel || '📦 Archive (Soft Delete)',
      variant: 'soft-delete',
      onPress: onSoftDelete,
    });
  }

  // Primary confirm / destructive action
  dialogActions.push({
    label: confirmLabel,
    variant: destructive ? 'destructive' : 'primary',
    onPress: onConfirm,
  });

  // Cancel action
  dialogActions.push({
    label: cancelLabel,
    variant: 'cancel',
    onPress: onCancel,
  });

  return (
    <CustomAlertModal
      visible={visible}
      title={title}
      message={message}
      variant={variant || (onSoftDelete ? 'soft-delete' : destructive ? 'danger' : 'warning')}
      itemName={itemName}
      badge={badge}
      buttonLayout={onSoftDelete ? 'column' : 'row'}
      actions={dialogActions}
      onClose={onCancel}
    >
      {children}
    </CustomAlertModal>
  );
}
