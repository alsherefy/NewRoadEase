import { useState, useEffect } from 'react';
import { Plus, Trash2, Package, Edit, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SparePart } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import { useTranslation } from 'react-i18next';
import { displayNumber, normalizeNumberInput, formatToFixed } from '../utils/numberUtils';

interface WorkOrderSparePart {
  id: string;
  spare_part_id: string;
  quantity: number;
  unit_price: number;
  total: number;
  spare_part?: SparePart;
}

interface WorkOrderSparePartsProps {
  workOrderId: string;
  isCompleted: boolean;
  onUpdate?: () => void;
}

export function WorkOrderSpareParts({ workOrderId, isCompleted, onUpdate }: WorkOrderSparePartsProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [workOrderParts, setWorkOrderParts] = useState<WorkOrderSparePart[]>([]);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);

  useEffect(() => {
    fetchSpareParts();
    fetchWorkOrderParts();
  }, [workOrderId]);

  const fetchSpareParts = async () => {
    const { data } = await supabase
      .from('spare_parts')
      .select('*')
      .gt('quantity', 0)
      .order('name');
    setSpareParts(data || []);
  };

  const fetchWorkOrderParts = async () => {
    const { data } = await supabase
      .from('work_order_spare_parts')
      .select(`
        *,
        spare_part:spare_parts(*)
      `)
      .eq('work_order_id', workOrderId);
    setWorkOrderParts(data || []);
  };

  const handleAddPart = async () => {
    if (!selectedPartId) {
      toast.error(t('validation.required_field'));
      return;
    }

    const selectedPart = spareParts.find(p => p.id === selectedPartId);
    if (!selectedPart) return;

    if (quantity > selectedPart.quantity) {
      toast.error(`${t('inventory.quantity')} ${selectedPart.name} ${selectedPart.quantity}`);
      return;
    }

    setLoading(true);
    try {
      const { error: insertError } = await supabase
        .from('work_order_spare_parts')
        .insert({
          work_order_id: workOrderId,
          spare_part_id: selectedPartId,
          quantity: quantity,
          unit_price: Number(selectedPart.unit_price)
        });

      if (insertError) throw insertError;

      const newQuantity = selectedPart.quantity - quantity;
      const { error: updateError } = await supabase
        .from('spare_parts')
        .update({ quantity: newQuantity })
        .eq('id', selectedPartId);

      if (updateError) throw updateError;

      setSelectedPartId('');
      setQuantity(1);
      await fetchSpareParts();
      await fetchWorkOrderParts();
      onUpdate?.();

      toast.success(t('inventory.success_created'));
    } catch (error) {
      console.error('Error adding spare part:', error);
      toast.error(t('inventory.error_create'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePart = async (partId: string, sparePartId: string, qty: number) => {
    const confirmed = await confirm({
      title: t('common.delete'),
      message: t('inventory.confirm_delete'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      isDangerous: true,
    });
    if (!confirmed) return;

    setLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('work_order_spare_parts')
        .delete()
        .eq('id', partId);

      if (deleteError) throw deleteError;

      const { data: sparePart } = await supabase
        .from('spare_parts')
        .select('quantity')
        .eq('id', sparePartId)
        .single();

      if (sparePart) {
        const newQuantity = sparePart.quantity + qty;
        const { error: updateError } = await supabase
          .from('spare_parts')
          .update({ quantity: newQuantity })
          .eq('id', sparePartId);

        if (updateError) throw updateError;
      }

      await fetchSpareParts();
      await fetchWorkOrderParts();
      onUpdate?.();

      toast.success(t('inventory.success_deleted'));
    } catch (error) {
      console.error('Error removing spare part:', error);
      toast.error(t('inventory.error_delete'));
    } finally {
      setLoading(false);
    }
  };

  const startEditPrice = (part: WorkOrderSparePart) => {
    setEditingPartId(part.id);
    setEditPrice(part.unit_price);
  };

  const cancelEdit = () => {
    setEditingPartId(null);
    setEditPrice(0);
  };

  const handleUpdatePrice = async (partId: string, quantity: number) => {
    if (editPrice <= 0) {
      toast.error(t('validation.greater_than_zero'));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('work_order_spare_parts')
        .update({
          unit_price: editPrice
        })
        .eq('id', partId);

      if (error) throw error;

      await fetchWorkOrderParts();
      onUpdate?.();
      setEditingPartId(null);
      setEditPrice(0);

      toast.success(t('inventory.success_updated'));
    } catch (error) {
      console.error('Error updating price:', error);
      toast.error(t('inventory.error_update'));
    } finally {
      setLoading(false);
    }
  };

  const getTotalParts = () => {
    return workOrderParts.reduce((sum, part) => sum + part.total, 0);
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-6 w-6 text-blue-600" />
        <h3 className="text-xl font-bold text-gray-800">{t('work_orders.used_spare_parts')}</h3>
      </div>

      {!isCompleted && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold text-gray-700 mb-3">{t('work_orders.add_spare_part')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('inventory.part_name')}
              </label>
              <select
                value={selectedPartId}
                onChange={(e) => setSelectedPartId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">{t('common.select')}</option>
                {spareParts.map(part => (
                  <option key={part.id} value={part.id}>
                    {part.name} - {part.unit_price} {t('dashboard.sar')} ({t('inventory.quantity')}: {part.quantity})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('inventory.quantity')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(normalizeNumberInput(e.target.value)))}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleAddPart}
                  disabled={loading}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                >
                  <Plus className="h-4 w-4" />
                  {t('common.add')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {workOrderParts.length > 0 ? (
        <>
          <div className="space-y-3">
            {workOrderParts.map((part) => (
              <div key={part.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-2">{part.spare_part?.name}</h4>
                    {editingPartId === part.id ? (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">{t('inventory.quantity')}: {part.quantity} ×</span>
                          <input
                            type="text"
                            value={editPrice}
                            onChange={(e) => setEditPrice(Number(normalizeNumberInput(e.target.value)))}
                            className="w-28 px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <span className="text-sm text-gray-600">{t('dashboard.sar')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUpdatePrice(part.id, part.quantity)}
                            disabled={loading}
                            className="text-green-600 hover:bg-green-50 p-1.5 rounded-lg transition-colors disabled:opacity-50"
                            title={t('common.save')}
                          >
                            <Check className="h-5 w-5" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={loading}
                            className="text-gray-600 hover:bg-gray-50 p-1.5 rounded-lg transition-colors disabled:opacity-50"
                            title={t('common.cancel')}
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">
                        {t('inventory.quantity')}: {part.quantity} × {displayNumber(part.unit_price)} {t('dashboard.sar')} = {displayNumber(part.total)} {t('dashboard.sar')}
                      </p>
                    )}
                  </div>
                  {!isCompleted && editingPartId !== part.id && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditPrice(part)}
                        disabled={loading}
                        className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors disabled:opacity-50"
                        title={t('common.edit')}
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleRemovePart(part.id, part.spare_part_id, part.quantity)}
                        disabled={loading}
                        className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors disabled:opacity-50"
                        title={t('common.delete')}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-700">{t('work_orders.total_parts_cost')}:</span>
              <span className="text-xl font-bold text-blue-600">{formatToFixed(getTotalParts())} {t('dashboard.sar')}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-gray-500">
          {t('work_orders.no_spare_parts')}
        </div>
      )}
      {ConfirmDialogComponent}
    </div>
  );
}
