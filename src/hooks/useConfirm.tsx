import { useState, useCallback } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

export function useConfirm() {
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmState) {
      confirmState.resolve(true);
      setConfirmState(null);
    }
  }, [confirmState]);

  const handleCancel = useCallback(() => {
    if (confirmState) {
      confirmState.resolve(false);
      setConfirmState(null);
    }
  }, [confirmState]);

  const ConfirmDialogComponent = confirmState ? (
    <ConfirmDialog
      isOpen={confirmState.isOpen}
      title={confirmState.options.title}
      message={confirmState.options.message}
      confirmText={confirmState.options.confirmText}
      cancelText={confirmState.options.cancelText}
      isDangerous={confirmState.options.isDangerous}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirm, ConfirmDialogComponent };
}
