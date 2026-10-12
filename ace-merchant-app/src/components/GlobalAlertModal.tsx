import React from 'react';
import { useAlertStore } from '../store/alertStore';
import { CustomAlertModal } from './CustomAlertModal';

export function GlobalAlertModal() {
  const isOpen = useAlertStore((state) => state.isOpen);
  const options = useAlertStore((state) => state.options);
  const closeAlert = useAlertStore((state) => state.closeAlert);

  if (!isOpen || !options) return null;

  return (
    <CustomAlertModal
      visible={isOpen}
      title={options.title}
      message={options.message}
      variant={options.variant}
      icon={options.icon}
      badge={options.badge}
      itemName={options.itemName}
      actions={options.actions}
      buttonLayout={options.buttonLayout}
      dismissible={options.dismissible}
      onClose={closeAlert}
    >
      {options.children}
    </CustomAlertModal>
  );
}
