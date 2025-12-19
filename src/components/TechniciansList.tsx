import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Technician } from '../types';
import { Plus, CreditCard as Edit2, Trash2, Phone, Award } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import { displayNumber, normalizeNumberInput, toEnglishDigits } from '../utils/numberUtils';

interface TechniciansListProps {
  technicians: Technician[];
  onUpdate: () => void;
}

export function TechniciansList({ technicians, onUpdate }: TechniciansListProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    specialization: '',
    contract_type: 'percentage' as 'percentage' | 'fixed',
    percentage: 0,
    fixed_salary: 0,
    monthly_salary: 0,
    commission_rate: 0,
    allowances: 0,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingId) {
        const { error } = await supabase
          .from('technicians')
          .update(formData)
          .eq('id', editingId);
        if (error) throw error;
        toast.success(t('technicians.update_success'));
      } else {
        const { error } = await supabase
          .from('technicians')
          .insert([formData]);
        if (error) throw error;
        toast.success(t('technicians.add_success'));
      }
      resetForm();
      onUpdate();
    } catch (error) {
      console.error('Error saving technician:', error);
      toast.error(t('errors.save_failed'));
    }
  }

  async function handleDelete(id: string) {
    const confirmed = await confirm({
      title: t('common.confirm_delete'),
      message: t('technicians.delete_confirm'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      isDangerous: true,
    });
    if (!confirmed) return;
    try {
      const { error } = await supabase
        .from('technicians')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success(t('technicians.delete_success'));
      onUpdate();
    } catch (error) {
      console.error('Error deleting technician:', error);
      toast.error(t('errors.delete_failed'));
    }
  }

  function handleEdit(technician: Technician) {
    setEditingId(technician.id);
    setFormData({
      name: technician.name,
      phone: technician.phone,
      specialization: technician.specialization,
      contract_type: technician.contract_type,
      percentage: technician.percentage,
      fixed_salary: technician.fixed_salary,
      monthly_salary: technician.monthly_salary || 0,
      commission_rate: technician.commission_rate || 0,
      allowances: technician.allowances || 0,
    });
    setShowForm(true);
  }

  function resetForm() {
    setFormData({
      name: '',
      phone: '',
      specialization: '',
      contract_type: 'percentage',
      percentage: 0,
      fixed_salary: 0,
      monthly_salary: 0,
      commission_rate: 0,
      allowances: 0,
    });
    setEditingId(null);
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-800">{t('technicians.list_title')}</h3>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 space-x-reverse bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
        >
          <Plus className="h-5 w-5" />
          <span>{t('technicians.add_new')}</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            {editingId ? t('technicians.edit_form_title') : t('technicians.add_form_title')}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('technicians.name')}</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('technicians.phone')}</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('technicians.specialization')}</label>
                <select
                  required
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t('technicians.select_specialization')}</option>
                  <option value="electrician">{t('technicians.specializations.electrician')}</option>
                  <option value="mechanic">{t('technicians.specializations.mechanic')}</option>
                  <option value="bodywork">{t('technicians.specializations.bodywork')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('technicians.contract_type')}</label>
                <select
                  value={formData.contract_type}
                  onChange={(e) => setFormData({ ...formData, contract_type: e.target.value as 'percentage' | 'fixed' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="percentage">{t('technicians.percentage_contract')}</option>
                  <option value="fixed">{t('technicians.fixed_contract')}</option>
                </select>
              </div>
              {formData.contract_type === 'percentage' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('technicians.percentage_label')}</label>
                  <input
                    type="text"
                    value={formData.percentage}
                    onChange={(e) => setFormData({ ...formData, percentage: parseFloat(normalizeNumberInput(e.target.value)) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
              {formData.contract_type === 'fixed' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('technicians.fixed_salary_label')}</label>
                    <input
                      type="text"
                      value={formData.fixed_salary}
                      onChange={(e) => setFormData({ ...formData, fixed_salary: parseFloat(normalizeNumberInput(e.target.value)) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('technicians.allowances')}</label>
                    <input
                      type="text"
                      value={formData.allowances}
                      onChange={(e) => setFormData({ ...formData, allowances: parseFloat(normalizeNumberInput(e.target.value)) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={t('technicians.allowances_placeholder')}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex space-x-3 space-x-reverse">
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingId ? t('common.save_changes') : t('common.add')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {technicians.map((technician) => (
          <div
            key={technician.id}
            className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3 space-x-reverse">
                <div className="bg-blue-100 rounded-full p-3">
                  <Award className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">{technician.name}</h3>
                  <p className="text-sm text-gray-600">{t(`technicians.specializations.${technician.specialization}`)}</p>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                technician.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {technician.is_active ? t('status.active') : t('status.inactive')}
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center space-x-2 space-x-reverse text-gray-600">
                <Phone className="h-4 w-4" />
                <span className="text-sm">{technician.phone}</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-700">{t('technicians.base_salary_display')}: </span>
                <span className="text-gray-600">
                  {displayNumber(technician.monthly_salary)} {t('common.currency')}
                </span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-700">{t('technicians.commission_rate')}: </span>
                <span className="text-gray-600">
                  {toEnglishDigits(technician.commission_rate)}%
                </span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-700">{t('technicians.contract_type')}: </span>
                <span className="text-gray-600">
                  {technician.contract_type === 'percentage'
                    ? `${toEnglishDigits(technician.percentage)}% ${t('technicians.of_revenue')}`
                    : `${displayNumber(technician.fixed_salary)} ${t('common.currency')}`}
                </span>
              </div>
            </div>

            <div className="flex space-x-2 space-x-reverse">
              <button
                onClick={() => handleEdit(technician)}
                className="flex-1 flex items-center justify-center space-x-2 space-x-reverse bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Edit2 className="h-4 w-4" />
                <span>{t('common.edit')}</span>
              </button>
              <button
                onClick={() => handleDelete(technician.id)}
                className="flex-1 flex items-center justify-center space-x-2 space-x-reverse bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span>{t('common.delete')}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {technicians.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <p className="text-gray-500 text-lg">{t('technicians.no_technicians')}</p>
        </div>
      )}
      {ConfirmDialogComponent}
    </div>
  );
}
