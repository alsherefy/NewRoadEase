import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Salary, Technician } from '../types';
import { Plus, Edit2, Trash2, DollarSign, Calculator, Calendar, CreditCard, Banknote, Building2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { displayNumber, normalizeNumberInput } from '../utils/numberUtils';

interface SalariesManagementProps {
  technicians: Technician[];
}

export function SalariesManagement({ technicians }: SalariesManagementProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid' | 'partial'>('all');

  const [formData, setFormData] = useState({
    technician_id: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    basic_salary: 0,
    commission_amount: 0,
    bonus: 0,
    deductions: 0,
    total_salary: 0,
    work_orders_count: 0,
    total_work_orders_value: 0,
    payment_status: 'unpaid' as 'paid' | 'unpaid' | 'partial',
    paid_amount: 0,
    payment_method: 'cash' as 'cash' | 'card' | 'bank_transfer',
    card_type: undefined as 'mada' | 'visa' | undefined,
    payment_date: '',
    notes: '',
  });

  const months = [
    t('common.months.january'), t('common.months.february'), t('common.months.march'),
    t('common.months.april'), t('common.months.may'), t('common.months.june'),
    t('common.months.july'), t('common.months.august'), t('common.months.september'),
    t('common.months.october'), t('common.months.november'), t('common.months.december')
  ];

  useEffect(() => {
    loadSalaries();
  }, [selectedMonth, selectedYear, filterStatus]);

  useEffect(() => {
    const total = formData.basic_salary + formData.commission_amount + formData.bonus - formData.deductions;
    setFormData(prev => ({ ...prev, total_salary: total }));
  }, [formData.basic_salary, formData.commission_amount, formData.bonus, formData.deductions]);

  async function loadSalaries() {
    setLoading(true);
    try {
      let query = supabase
        .from('salaries')
        .select(`
          *,
          technician:technicians(*)
        `)
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('payment_status', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSalaries(data || []);
    } catch (error) {
      console.error('Error loading salaries:', error);
      toast.error(t('salaries.load_error'));
    } finally {
      setLoading(false);
    }
  }

  async function calculateSalary(technicianId: string, month: number, year: number) {
    try {
      const { data, error } = await supabase.rpc('calculate_technician_salary', {
        p_technician_id: technicianId,
        p_month: month,
        p_year: year
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const result = data[0];
        return {
          basic_salary: result.basic_salary || 0,
          commission_amount: result.commission_amount || 0,
          work_orders_count: result.work_orders_count || 0,
          total_work_orders_value: result.total_work_orders_value || 0,
        };
      }

      const technician = technicians.find(t => t.id === technicianId);
      return {
        basic_salary: technician?.monthly_salary || 0,
        commission_amount: 0,
        work_orders_count: 0,
        total_work_orders_value: 0,
      };
    } catch (error) {
      console.error('Error calculating salary:', error);
      toast.error(t('salaries.calculate_error'));
      return {
        basic_salary: 0,
        commission_amount: 0,
        work_orders_count: 0,
        total_work_orders_value: 0,
      };
    }
  }

  async function handleTechnicianChange(technicianId: string) {
    setFormData({ ...formData, technician_id: technicianId });

    if (technicianId && !editingId) {
      const calculated = await calculateSalary(technicianId, formData.month, formData.year);
      const total = calculated.basic_salary + calculated.commission_amount;
      setFormData({
        ...formData,
        technician_id: technicianId,
        basic_salary: calculated.basic_salary,
        commission_amount: calculated.commission_amount,
        work_orders_count: calculated.work_orders_count,
        total_work_orders_value: calculated.total_work_orders_value,
        total_salary: total,
      });
    }
  }

  async function handleMonthYearChange(month: number, year: number) {
    setFormData({ ...formData, month, year });

    if (formData.technician_id && !editingId) {
      const calculated = await calculateSalary(formData.technician_id, month, year);
      const total = calculated.basic_salary + calculated.commission_amount + formData.bonus - formData.deductions;
      setFormData({
        ...formData,
        month,
        year,
        basic_salary: calculated.basic_salary,
        commission_amount: calculated.commission_amount,
        work_orders_count: calculated.work_orders_count,
        total_work_orders_value: calculated.total_work_orders_value,
        total_salary: total,
      });
    }
  }

  function calculateTotal() {
    return formData.basic_salary + formData.commission_amount + formData.bonus - formData.deductions;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const total = calculateTotal();

    try {
      const { data: salaryNumber } = await supabase.rpc('generate_salary_number');

      const salaryData = {
        ...formData,
        total_salary: total,
        salary_number: editingId ? undefined : salaryNumber,
        created_by: user?.id,
      };

      if (editingId) {
        const { error } = await supabase
          .from('salaries')
          .update(salaryData)
          .eq('id', editingId);
        if (error) throw error;
        toast.success(t('salaries.update_success'));
      } else {
        const { error } = await supabase
          .from('salaries')
          .insert([salaryData]);
        if (error) throw error;
        toast.success(t('salaries.add_success'));
      }

      resetForm();
      loadSalaries();
    } catch (error: any) {
      console.error('Error saving salary:', error);
      if (error.code === '23505') {
        toast.error(t('salaries.duplicate_error'));
      } else {
        toast.error(t('errors.save_failed'));
      }
    }
  }

  async function handleDelete(id: string) {
    const confirmed = await confirm({
      title: t('common.confirm_delete'),
      message: t('salaries.delete_confirm'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      isDangerous: true,
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('salaries')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success(t('salaries.delete_success'));
      loadSalaries();
    } catch (error) {
      console.error('Error deleting salary:', error);
      toast.error(t('errors.delete_failed'));
    }
  }

  function handleEdit(salary: Salary) {
    setEditingId(salary.id);
    setFormData({
      technician_id: salary.technician_id,
      month: salary.month,
      year: salary.year,
      basic_salary: salary.basic_salary,
      commission_amount: salary.commission_amount,
      bonus: salary.bonus,
      deductions: salary.deductions,
      total_salary: salary.total_salary,
      work_orders_count: salary.work_orders_count,
      total_work_orders_value: salary.total_work_orders_value,
      payment_status: salary.payment_status,
      paid_amount: salary.paid_amount,
      payment_method: salary.payment_method || 'cash',
      card_type: salary.card_type,
      payment_date: salary.payment_date || '',
      notes: salary.notes || '',
    });
    setShowModal(true);
  }

  function resetForm() {
    setFormData({
      technician_id: '',
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      basic_salary: 0,
      commission_amount: 0,
      bonus: 0,
      deductions: 0,
      total_salary: 0,
      work_orders_count: 0,
      total_work_orders_value: 0,
      payment_status: 'unpaid',
      paid_amount: 0,
      payment_method: 'cash',
      card_type: undefined,
      payment_date: '',
      notes: '',
    });
    setEditingId(null);
    setShowModal(false);
  }

  const totalSalaries = salaries.reduce((sum, s) => sum + s.total_salary, 0);
  const totalPaid = salaries.reduce((sum, s) => sum + s.paid_amount, 0);
  const totalUnpaid = totalSalaries - totalPaid;

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 space-x-reverse bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
        >
          <Plus className="h-5 w-5" />
          <span>{t('salaries.add_salary')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-100">{t('salaries.total_salaries')}</span>
            <DollarSign className="h-8 w-8 text-blue-200" />
          </div>
          <p className="text-3xl font-bold">{displayNumber(totalSalaries)} {t('common.currency')}</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-100">{t('salaries.paid')}</span>
            <DollarSign className="h-8 w-8 text-green-200" />
          </div>
          <p className="text-3xl font-bold">{displayNumber(totalPaid)} {t('common.currency')}</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-orange-100">{t('salaries.remaining')}</span>
            <DollarSign className="h-8 w-8 text-orange-200" />
          </div>
          <p className="text-3xl font-bold">{displayNumber(totalUnpaid)} {t('common.currency')}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Calendar className="h-5 w-5 text-gray-500" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {months.map((month, index) => (
                <option key={index} value={index + 1}>{month}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {[...Array(5)].map((_, i) => {
                const year = new Date().getFullYear() - 2 + i;
                return <option key={year} value={year}>{year}</option>;
              })}
            </select>
          </div>

          <div className="flex space-x-2 space-x-reverse">
            {(['all', 'paid', 'unpaid', 'partial'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filterStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status === 'all' && t('common.all')}
                {status === 'paid' && t('salaries.status_paid')}
                {status === 'unpaid' && t('salaries.status_unpaid')}
                {status === 'partial' && t('salaries.status_partial')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-2xl font-bold text-gray-800">
                {editingId ? t('salaries.edit_form_title') : t('salaries.add_form_title')}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('salaries.technician')}</label>
                  <select
                    required
                    value={formData.technician_id}
                    onChange={(e) => handleTechnicianChange(e.target.value)}
                    disabled={editingId !== null}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value="">{t('salaries.select_technician')}</option>
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>{tech.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('salaries.month')}</label>
                  <select
                    required
                    value={formData.month}
                    onChange={(e) => handleMonthYearChange(parseInt(e.target.value), formData.year)}
                    disabled={editingId !== null}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    {months.map((month, index) => (
                      <option key={index} value={index + 1}>{month}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('salaries.year')}</label>
                  <select
                    required
                    value={formData.year}
                    onChange={(e) => handleMonthYearChange(formData.month, parseInt(e.target.value))}
                    disabled={editingId !== null}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    {[...Array(5)].map((_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return <option key={year} value={year}>{year}</option>;
                    })}
                  </select>
                </div>

                {formData.technician_id && technicians.find(t => t.id === formData.technician_id)?.contract_type === 'fixed' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('technicians.fixed_salary_label')} ({t('common.currency')})</label>
                      <input
                        type="text"
                        value={technicians.find(t => t.id === formData.technician_id)?.fixed_salary || 0}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('technicians.allowances')} ({t('common.currency')})</label>
                      <input
                        type="text"
                        value={technicians.find(t => t.id === formData.technician_id)?.allowances || 0}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                        readOnly
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('salaries.basic_salary_currency')}</label>
                  <input
                    type="text"
                    value={formData.basic_salary}
                    onChange={(e) => setFormData({ ...formData, basic_salary: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('salaries.commissions_currency')}</label>
                  <input
                    type="text"
                    value={formData.commission_amount}
                    onChange={(e) => setFormData({ ...formData, commission_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('salaries.bonuses_currency')}</label>
                  <input
                    type="text"
                    value={formData.bonus}
                    onChange={(e) => setFormData({ ...formData, bonus: parseFloat(normalizeNumberInput(e.target.value)) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('salaries.deductions_currency')}</label>
                  <input
                    type="text"
                    value={formData.deductions}
                    onChange={(e) => setFormData({ ...formData, deductions: parseFloat(normalizeNumberInput(e.target.value)) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('salaries.work_orders_completed')}</label>
                  <input
                    type="text"
                    value={formData.work_orders_count}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    readOnly
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-medium text-gray-700">{t('salaries.grand_total')}:</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {displayNumber(calculateTotal())} {t('common.currency')}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('salaries.payment_status')}</label>
                  <select
                    value={formData.payment_status}
                    onChange={(e) => setFormData({ ...formData, payment_status: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="unpaid">{t('salaries.status_unpaid')}</option>
                    <option value="partial">{t('salaries.status_partial')}</option>
                    <option value="paid">{t('salaries.status_paid')}</option>
                  </select>
                </div>

                {formData.payment_status !== 'unpaid' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('salaries.paid_amount_currency')}</label>
                      <input
                        type="text"
                        value={formData.paid_amount}
                        onChange={(e) => setFormData({ ...formData, paid_amount: parseFloat(normalizeNumberInput(e.target.value)) || 0 })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('salaries.payment_method')}</label>
                      <div className="flex space-x-2 space-x-reverse">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, payment_method: 'cash', card_type: undefined })}
                          className={`flex-1 flex items-center justify-center space-x-2 space-x-reverse py-2 px-4 rounded-lg border-2 transition-all ${
                            formData.payment_method === 'cash'
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <Banknote className="h-5 w-5" />
                          <span>{t('common.payment_methods.cash')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, payment_method: 'card' })}
                          className={`flex-1 flex items-center justify-center space-x-2 space-x-reverse py-2 px-4 rounded-lg border-2 transition-all ${
                            formData.payment_method === 'card'
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <CreditCard className="h-5 w-5" />
                          <span>{t('common.payment_methods.card')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, payment_method: 'bank_transfer', card_type: undefined })}
                          className={`flex-1 flex items-center justify-center space-x-2 space-x-reverse py-2 px-4 rounded-lg border-2 transition-all ${
                            formData.payment_method === 'bank_transfer'
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <Building2 className="h-5 w-5" />
                          <span>{t('common.payment_methods.bank_transfer')}</span>
                        </button>
                      </div>
                    </div>

                    {formData.payment_method === 'card' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.card_type')}</label>
                        <div className="flex space-x-2 space-x-reverse">
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, card_type: 'mada' })}
                            className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
                              formData.card_type === 'mada'
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            {t('common.card_types.mada')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, card_type: 'visa' })}
                            className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
                              formData.card_type === 'visa'
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            {t('common.card_types.visa')}
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('salaries.payment_date')}</label>
                      <input
                        type="date"
                        value={formData.payment_date}
                        onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.notes')}</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex space-x-3 space-x-reverse pt-4 border-t">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  {editingId ? t('common.save_changes') : t('salaries.add_salary_button')}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">{t('salaries.salary_number')}</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">{t('salaries.technician')}</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">{t('salaries.month_year')}</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">{t('salaries.basic_salary')}</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">{t('salaries.commissions')}</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">{t('salaries.total')}</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">{t('salaries.status')}</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {salaries.map((salary) => (
                <tr key={salary.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{salary.salary_number}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{salary.technician?.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{months[salary.month - 1]} {salary.year}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{displayNumber(salary.basic_salary)} {t('common.currency')}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{displayNumber(salary.commission_amount)} {t('common.currency')}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{displayNumber(salary.total_salary)} {t('common.currency')}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      salary.payment_status === 'paid'
                        ? 'bg-green-100 text-green-700'
                        : salary.payment_status === 'partial'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {salary.payment_status === 'paid' && t('salaries.status_paid')}
                      {salary.payment_status === 'partial' && t('salaries.status_partial')}
                      {salary.payment_status === 'unpaid' && t('salaries.status_unpaid')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2 space-x-reverse">
                      <button
                        onClick={() => handleEdit(salary)}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(salary.id)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {salaries.length === 0 && (
          <div className="text-center py-12">
            <Calculator className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">{t('salaries.no_salaries_month')}</p>
          </div>
        )}
      </div>
      {ConfirmDialogComponent}
    </div>
  );
}
