import { useState, useEffect, useMemo } from 'react';
import { Package, Plus, Edit2, Trash2, Search, AlertTriangle, CheckCircle } from 'lucide-react';
import { SparePart } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import { useTranslation } from 'react-i18next';
import { normalizeNumberInput, formatToFixed } from '../utils/numberUtils';
import { inventoryService } from '../services';

export function Inventory() {
  const { t } = useTranslation();
  const toast = useToast();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    part_number: '',
    category: '',
    supplier: '',
    quantity: 0,
    minimum_quantity: 0,
    unit_price: 0,
    location: ''
  });

  useEffect(() => {
    fetchSpareParts();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchSpareParts = async () => {
    try {
      const data = await inventoryService.getAllSpareParts({ orderBy: 'name', orderDirection: 'asc' });
      setSpareParts(data || []);
    } catch (error) {
      console.error('Error fetching spare parts:', error);
      toast.error(t('inventory.error_loading'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingPart(null);
    setFormData({
      name: '',
      part_number: '',
      category: '',
      supplier: '',
      quantity: 0,
      minimum_quantity: 0,
      unit_price: 0,
      location: ''
    });
    setShowAddModal(true);
  };

  const handleOpenEditModal = (part: SparePart) => {
    setEditingPart(part);
    setFormData({
      name: part.name,
      part_number: part.part_number,
      category: part.category || '',
      supplier: part.supplier || '',
      quantity: part.quantity,
      minimum_quantity: part.minimum_quantity,
      unit_price: Number(part.unit_price),
      location: part.location || ''
    });
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingPart(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingPart) {
        await inventoryService.updateSparePart(editingPart.id, formData);
        toast.success(t('inventory.success_updated'));
      } else {
        await inventoryService.createSparePart(formData as Omit<SparePart, 'id' | 'created_at' | 'updated_at'>);
        toast.success(t('inventory.success_created'));
      }

      handleCloseModal();
      fetchSpareParts();
    } catch (error) {
      console.error('Error saving spare part:', error);
      toast.error(t('inventory.error_create'));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirm({
      title: t('inventory.confirm_delete'),
      message: `${t('inventory.confirm_delete_message')} ${name}?`,
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      isDangerous: true,
    });
    if (!confirmed) return;

    try {
      await inventoryService.deleteSparePart(id);
      toast.success(t('inventory.success_deleted'));
      fetchSpareParts();
    } catch (error) {
      console.error('Error deleting spare part:', error);
      toast.error(t('inventory.error_delete'));
    }
  };

  const filteredParts = useMemo(() =>
    spareParts.filter(part =>
      part.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      part.part_number.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      part.category?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    ),
    [spareParts, debouncedSearchTerm]
  );

  const totalValue = spareParts.reduce((sum, part) => sum + (part.quantity * Number(part.unit_price)), 0);
  const lowStockItems = spareParts.filter(part => part.quantity <= part.minimum_quantity).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-600">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">{t('inventory.title')}</h2>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 sm:px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md min-h-[44px]"
        >
          <Plus className="h-5 w-5" />
          {t('inventory.add_spare_part')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg sm:rounded-xl shadow-lg p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-xs sm:text-sm mb-1">{t('inventory.total_parts')}</p>
              <p className="text-2xl sm:text-3xl font-bold">{spareParts.length}</p>
            </div>
            <Package className="h-8 w-8 sm:h-12 sm:w-12 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg sm:rounded-xl shadow-lg p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-green-100 text-xs sm:text-sm mb-1 truncate">{t('inventory.total_value')}</p>
              <p className="text-2xl sm:text-3xl font-bold truncate">{formatToFixed(totalValue)} {t('common.currency')}</p>
            </div>
            <CheckCircle className="h-8 w-8 sm:h-12 sm:w-12 text-green-200 flex-shrink-0 ml-2" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg sm:rounded-xl shadow-lg p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-xs sm:text-sm mb-1">{t('inventory.low_stock')}</p>
              <p className="text-2xl sm:text-3xl font-bold">{lowStockItems}</p>
            </div>
            <AlertTriangle className="h-8 w-8 sm:h-12 sm:w-12 text-red-200" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg sm:rounded-xl shadow-md p-3 sm:p-4 lg:p-6">
        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder={t('inventory.search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {filteredParts.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <Package className="h-16 w-16 sm:h-24 sm:w-24 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">{t('inventory.no_spare_parts')}</h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4">{t('inventory.start_adding')}</p>
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors min-h-[44px]"
            >
              <Plus className="h-5 w-5" />
              {t('inventory.add_spare_part')}
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-right py-4 px-4 font-semibold text-gray-700">{t('inventory.part_name')}</th>
                    <th className="text-right py-4 px-4 font-semibold text-gray-700">{t('inventory.part_number')}</th>
                    <th className="text-right py-4 px-4 font-semibold text-gray-700">{t('inventory.category')}</th>
                    <th className="text-right py-4 px-4 font-semibold text-gray-700">{t('inventory.quantity')}</th>
                    <th className="text-right py-4 px-4 font-semibold text-gray-700">{t('inventory.min_stock')}</th>
                    <th className="text-right py-4 px-4 font-semibold text-gray-700">{t('inventory.unit_price')}</th>
                    <th className="text-right py-4 px-4 font-semibold text-gray-700">{t('inventory.location')}</th>
                    <th className="text-right py-4 px-4 font-semibold text-gray-700">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParts.map((part) => (
                    <tr
                      key={part.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        part.quantity <= part.minimum_quantity ? 'bg-red-50' : ''
                      }`}
                    >
                      <td className="py-4 px-4 font-medium text-gray-900">{part.name}</td>
                      <td className="py-4 px-4 text-gray-600">{part.part_number}</td>
                      <td className="py-4 px-4 text-gray-600">{part.category || '-'}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${
                            part.quantity <= part.minimum_quantity ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            {part.quantity}
                          </span>
                          {part.quantity <= part.minimum_quantity && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray-600">{part.minimum_quantity}</td>
                      <td className="py-4 px-4 text-gray-900 font-medium">
                        {formatToFixed(Number(part.unit_price))} {t('common.currency')}
                      </td>
                      <td className="py-4 px-4 text-gray-600">{part.location || '-'}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditModal(part)}
                            className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(part.id, part.name)}
                            className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout */}
            <div className="lg:hidden space-y-3">
              {filteredParts.map((part) => (
                <div
                  key={part.id}
                  className={`rounded-lg border-2 overflow-hidden ${
                    part.quantity <= part.minimum_quantity ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-white font-bold text-lg mb-1">{part.name}</h3>
                        <p className="text-blue-100 text-sm">{part.part_number}</p>
                      </div>
                      {part.quantity <= part.minimum_quantity && (
                        <AlertTriangle className="h-6 w-6 text-yellow-300" />
                      )}
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-600 text-xs">{t('inventory.category')}</p>
                        <p className="font-medium text-gray-900">{part.category || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-xs">{t('inventory.location')}</p>
                        <p className="font-medium text-gray-900">{part.location || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-xs">{t('inventory.quantity')}</p>
                        <p className={`font-bold ${part.quantity <= part.minimum_quantity ? 'text-red-600' : 'text-gray-900'}`}>
                          {part.quantity} / {part.minimum_quantity}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-xs">{t('inventory.unit_price')}</p>
                        <p className="font-bold text-gray-900">{formatToFixed(Number(part.unit_price))} {t('common.currency')}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => handleOpenEditModal(part)}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors min-h-[44px]"
                      >
                        <Edit2 className="h-5 w-5" />
                        <span className="font-medium">{t('common.edit')}</span>
                      </button>
                      <button
                        onClick={() => handleDelete(part.id, part.name)}
                        className="flex items-center justify-center bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-700 transition-colors min-h-[44px] min-w-[44px]"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-2xl font-bold text-gray-800">
                {editingPart ? t('inventory.edit_spare_part') : t('inventory.add_spare_part')}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('inventory.part_name')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('inventory.part_number')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.part_number}
                    onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('inventory.category')}
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder={t('inventory.category_placeholder')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('inventory.supplier')}
                  </label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('inventory.quantity')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(normalizeNumberInput(e.target.value)) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('inventory.min_stock')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.minimum_quantity}
                    onChange={(e) => setFormData({ ...formData, minimum_quantity: Number(normalizeNumberInput(e.target.value)) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('inventory.unit_price')} ({t('common.currency')}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: Number(normalizeNumberInput(e.target.value)) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('inventory.location')}
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder={t('inventory.location_placeholder')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  {editingPart ? t('common.update') : t('common.add')}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {ConfirmDialogComponent}
    </div>
  );
}
