import { useState, useEffect } from 'react';
import { DollarSign, Plus, Edit, Trash2, Search, Calendar, TrendingDown, CreditCard, Banknote, Receipt, Clock } from 'lucide-react';
import { expensesService, ServiceError } from '../services';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { useTranslation } from 'react-i18next';
import { normalizeNumberInput, formatToFixed } from '../utils/numberUtils';
import { ExpenseInstallments } from '../components/ExpenseInstallments';
import { getErrorMessage } from '../utils/errorHandler';

interface Expense {
  id: string;
  expense_number: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  receipt_number?: string;
  notes: string;
  expense_date: string;
  payment_type: string;
  total_amount: number;
  installment_months: number | null;
  paid_installments: number;
  created_at: string;
}

export function Expenses() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showInstallmentsModal, setShowInstallmentsModal] = useState(false);
  const [selectedExpenseForInstallments, setSelectedExpenseForInstallments] = useState<Expense | null>(null);

  const [formData, setFormData] = useState({
    category: 'other',
    description: '',
    amount: '',
    payment_method: 'cash',
    receipt_number: '',
    notes: '',
    expense_date: new Date().toISOString().split('T')[0],
    payment_type: 'full',
    installment_months: '1'
  });

  const categories = {
    salaries: { label: t('expenses.types.salaries'), color: 'blue' },
    maintenance: { label: t('expenses.types.maintenance'), color: 'orange' },
    materials: { label: t('expenses.types.materials'), color: 'green' },
    equipment: { label: t('expenses.types.equipment'), color: 'teal' },
    rent: { label: t('expenses.types.rent'), color: 'purple' },
    electricity: { label: t('expenses.types.electricity'), color: 'yellow' },
    water: { label: t('expenses.types.water'), color: 'cyan' },
    fuel: { label: t('expenses.types.fuel'), color: 'red' },
    other: { label: t('expenses.types.other'), color: 'gray' }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const data = await expensesService.getAllExpenses();
      setExpenses(data as Expense[]);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error(t('expenses.error_create'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description || !formData.amount) {
      toast.warning(t('validation.fill_all_required'));
      return;
    }

    if (formData.payment_type === 'installments' && (!formData.installment_months || Number(formData.installment_months) < 1 || Number(formData.installment_months) > 12)) {
      toast.warning(t('expenses.invalid_installment_months'));
      return;
    }

    setLoading(true);

    try {
      if (editingExpense) {
        await expensesService.updateExpense(editingExpense.id, {
          category: formData.category,
          description: formData.description,
          payment_method: formData.payment_method,
          receipt_number: formData.receipt_number || undefined,
          notes: formData.notes,
          expense_date: formData.expense_date
        });
        toast.success(t('expenses.success_updated'));
      } else {
        const expenseData: any = {
          category: formData.category,
          description: formData.description,
          payment_method: formData.payment_method,
          receipt_number: formData.receipt_number || undefined,
          notes: formData.notes,
          expense_date: formData.expense_date,
          payment_type: formData.payment_type
        };

        if (formData.payment_type === 'full') {
          expenseData.amount = Number(formData.amount);
        } else {
          expenseData.total_amount = Number(formData.amount);
          expenseData.installment_months = Number(formData.installment_months);
        }

        await expensesService.createExpense(expenseData);
        toast.success(t('expenses.success_created'));
      }

      resetForm();
      fetchExpenses();
    } catch (error: any) {
      console.error('Error saving expense:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: t('expenses.confirm_delete'),
      message: t('expenses.confirm_delete_message'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      isDangerous: true,
    });
    if (!confirmed) return;

    try {
      await expensesService.deleteExpense(id);
      toast.success(t('expenses.success_deleted'));
      fetchExpenses();
    } catch (error: any) {
      console.error('Error deleting expense:', error);
      toast.error(getErrorMessage(error));
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
      payment_method: expense.payment_method,
      receipt_number: expense.receipt_number || '',
      notes: expense.notes || '',
      expense_date: expense.expense_date,
      payment_type: 'full',
      installment_months: '1'
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      category: 'other',
      description: '',
      amount: '',
      payment_method: 'cash',
      receipt_number: '',
      notes: '',
      expense_date: new Date().toISOString().split('T')[0],
      payment_type: 'full',
      installment_months: '1'
    });
    setEditingExpense(null);
    setShowAddModal(false);
  };

  const getCategoryBadge = (category: string) => {
    const cat = categories[category as keyof typeof categories] || categories.other;
    const colorClasses = {
      blue: 'bg-blue-100 text-blue-700 border-blue-200',
      orange: 'bg-orange-100 text-orange-700 border-orange-200',
      green: 'bg-green-100 text-green-700 border-green-200',
      teal: 'bg-teal-100 text-teal-700 border-teal-200',
      purple: 'bg-purple-100 text-purple-700 border-purple-200',
      yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
      red: 'bg-red-100 text-red-700 border-red-200',
      gray: 'bg-gray-100 text-gray-700 border-gray-200'
    };

    return (
      <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${colorClasses[cat.color as keyof typeof colorClasses]}`}>
        {cat.label}
      </span>
    );
  };

  const getPaymentMethodBadge = (method: string) => {
    if (method === 'cash') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200">
          <Banknote className="h-3.5 w-3.5" />
          {t('common.cash')}
        </span>
      );
    }
    if (method === 'card') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <CreditCard className="h-3.5 w-3.5" />
          {t('common.card')}
        </span>
      );
    }
    return null;
  };

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.expense_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || expense.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  const todayExpenses = expenses
    .filter(exp => exp.expense_date === new Date().toISOString().split('T')[0])
    .reduce((sum, exp) => sum + Number(exp.amount), 0);
  const monthExpenses = expenses
    .filter(exp => {
      const expDate = new Date(exp.expense_date);
      const now = new Date();
      return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, exp) => sum + Number(exp.amount), 0);

  if (loading && expenses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <div className="text-lg text-gray-600 font-medium">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">{t('expenses.title')}</h2>
          <p className="text-gray-500 mt-1">{t('expenses.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 duration-200"
        >
          <Plus className="h-5 w-5" />
          <span className="font-semibold">{t('expenses.add_expense')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                <TrendingDown className="h-6 w-6" />
              </div>
            </div>
            <p className="text-red-100 text-sm mb-1 font-medium">{t('expenses.total_expenses')}</p>
            <p className="text-3xl font-bold">{formatToFixed(totalExpenses)} {t('common.currency')}</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                <Calendar className="h-6 w-6" />
              </div>
              <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">{t('common.today')}</span>
            </div>
            <p className="text-orange-100 text-sm mb-1 font-medium">{t('expenses.today_expenses')}</p>
            <p className="text-3xl font-bold">{formatToFixed(todayExpenses)} {t('common.currency')}</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                <DollarSign className="h-6 w-6" />
              </div>
            </div>
            <p className="text-purple-100 text-sm mb-1 font-medium">{t('expenses.month_expenses')}</p>
            <p className="text-3xl font-bold">{formatToFixed(monthExpenses)} {t('common.currency')}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-md border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder={t('expenses.search_placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="all">{t('expenses.all_types')}</option>
              {Object.entries(categories).map(([key, cat]) => (
                <option key={key} value={key}>{cat.label}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Receipt className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{t('expenses.no_expenses')}</h3>
            <p className="text-gray-500 mb-6">{t('expenses.start_adding')}</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg"
            >
              <Plus className="h-5 w-5" />
              {t('expenses.add_expense')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-right py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">{t('expenses.expense_number')}</th>
                  <th className="text-right py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">{t('common.date')}</th>
                  <th className="text-right py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">{t('expenses.expense_type')}</th>
                  <th className="text-right py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">{t('expenses.description')}</th>
                  <th className="text-right py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">{t('expenses.amount')}</th>
                  <th className="text-right py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">{t('expenses.payment_method')}</th>
                  <th className="text-center py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <span className="font-semibold text-gray-900">{expense.expense_number}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-600">
                        {new Date(expense.expense_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </td>
                    <td className="py-4 px-6">{getCategoryBadge(expense.category)}</td>
                    <td className="py-4 px-6">
                      <span className="text-gray-700">{expense.description}</span>
                      {expense.receipt_number && (
                        <span className="block text-xs text-gray-500 mt-1">
                          {t('expenses.receipt')}: {expense.receipt_number}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        <span className="font-bold text-red-600">{formatToFixed(Number(expense.amount))} {t('common.currency')}</span>
                        {expense.payment_type === 'installments' && (
                          <div className="text-xs text-gray-600 mt-1">
                            <div>{t('expenses.total')}: {formatToFixed(expense.total_amount)} {t('common.currency')}</div>
                            <div className="flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3" />
                              <span>{expense.paid_installments} / {expense.installment_months} {t('expenses.paid')}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {getPaymentMethodBadge(expense.payment_method)}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-2">
                        {expense.payment_type === 'installments' && (
                          <button
                            onClick={() => {
                              setSelectedExpenseForInstallments(expense);
                              setShowInstallmentsModal(true);
                            }}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                            title={t('expenses.view_installments')}
                          >
                            <Clock className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(expense)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
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
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900">
                {editingExpense ? t('expenses.edit_expense') : t('expenses.add_expense')}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('expenses.expense_type')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    {Object.entries(categories).map(([key, cat]) => (
                      <option key={key} value={key}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('common.date')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.expense_date}
                    onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('expenses.description')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    placeholder={t('expenses.description_placeholder')}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                {!editingExpense && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      {t('expenses.payment_type')}
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, payment_type: 'full' })}
                        className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all font-semibold ${
                          formData.payment_type === 'full'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }`}
                      >
                        {t('expenses.full_payment')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, payment_type: 'installments' })}
                        className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all font-semibold ${
                          formData.payment_type === 'installments'
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }`}
                      >
                        {t('expenses.installment_payment')}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {formData.payment_type === 'installments' ? t('expenses.total_amount') : t('expenses.amount')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: normalizeNumberInput(e.target.value) })}
                    required
                    placeholder="0.00"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                {!editingExpense && formData.payment_type === 'installments' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('expenses.installment_months')} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.installment_months}
                      onChange={(e) => setFormData({ ...formData, installment_months: e.target.value })}
                      required
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    >
                      {[...Array(12)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1} {t('expenses.months')}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-2">
                      {t('expenses.monthly_amount')}: {formatToFixed(Number(formData.amount) / Number(formData.installment_months) || 0)} {t('common.sar')}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('expenses.receipt_number')}
                  </label>
                  <input
                    type="text"
                    value={formData.receipt_number}
                    onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
                    placeholder={t('expenses.receipt_number_placeholder')}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    {t('expenses.payment_method')}
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, payment_method: 'cash' })}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all ${
                        formData.payment_method === 'cash'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <Banknote className="h-5 w-5" />
                      {t('common.cash')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, payment_method: 'card' })}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all ${
                        formData.payment_method === 'card'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <CreditCard className="h-5 w-5" />
                      {t('common.card')}
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('common.notes')}
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder={t('expenses.notes_placeholder')}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg font-semibold"
                >
                  {loading ? t('common.saving') : editingExpense ? t('common.update') : t('common.save')}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={loading}
                  className="px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showInstallmentsModal && selectedExpenseForInstallments && (
        <ExpenseInstallments
          expenseId={selectedExpenseForInstallments.id}
          expenseDescription={selectedExpenseForInstallments.description}
          totalAmount={selectedExpenseForInstallments.total_amount}
          paidInstallments={selectedExpenseForInstallments.paid_installments}
          totalInstallments={selectedExpenseForInstallments.installment_months || 1}
          onClose={() => {
            setShowInstallmentsModal(false);
            setSelectedExpenseForInstallments(null);
          }}
          onUpdate={() => {
            fetchExpenses();
          }}
        />
      )}
      {ConfirmDialogComponent}
    </div>
  );
}
