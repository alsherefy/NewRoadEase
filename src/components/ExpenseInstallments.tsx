import { useState, useEffect } from 'react';
import { CheckCircle, Clock, Calendar, DollarSign, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import { formatToFixed } from '../utils/numberUtils';

interface Installment {
  id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  is_paid: boolean;
  paid_date: string | null;
  notes: string;
}

interface ExpenseInstallmentsProps {
  expenseId: string;
  expenseDescription: string;
  totalAmount: number;
  paidInstallments: number;
  totalInstallments: number;
  onClose: () => void;
  onUpdate: () => void;
}

export function ExpenseInstallments({
  expenseId,
  expenseDescription,
  totalAmount,
  paidInstallments,
  totalInstallments,
  onClose,
  onUpdate
}: ExpenseInstallmentsProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInstallments();
  }, [expenseId]);

  const fetchInstallments = async () => {
    try {
      const { data, error } = await supabase
        .from('expense_installments')
        .select('*')
        .eq('expense_id', expenseId)
        .order('installment_number', { ascending: true });

      if (error) throw error;
      setInstallments(data || []);
    } catch (error) {
      console.error('Error fetching installments:', error);
      toast.error(t('expenses.error_loading_installments'));
    } finally {
      setLoading(false);
    }
  };

  const handlePayInstallment = async (installment: Installment) => {
    try {
      const { error: updateError } = await supabase
        .from('expense_installments')
        .update({
          is_paid: true,
          paid_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', installment.id);

      if (updateError) throw updateError;

      const newPaidCount = paidInstallments + 1;
      const { error: expenseError } = await supabase
        .from('expenses')
        .update({
          paid_installments: newPaidCount
        })
        .eq('id', expenseId);

      if (expenseError) throw expenseError;

      toast.success(t('expenses.installment_paid'));
      await fetchInstallments();
      onUpdate();
    } catch (error) {
      console.error('Error paying installment:', error);
      toast.error(t('expenses.error_pay_installment'));
    }
  };

  const isDue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    return due <= today;
  };

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{t('expenses.installment_schedule')}</h3>
            <p className="text-gray-600 mt-1">{expenseDescription}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                <p className="text-sm font-medium text-blue-900">{t('expenses.total_amount')}</p>
              </div>
              <p className="text-2xl font-bold text-blue-700">{formatToFixed(totalAmount)} {t('common.sar')}</p>
            </div>

            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="text-sm font-medium text-green-900">{t('expenses.paid_installments')}</p>
              </div>
              <p className="text-2xl font-bold text-green-700">{paidInstallments} / {totalInstallments}</p>
            </div>

            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-orange-600" />
                <p className="text-sm font-medium text-orange-900">{t('expenses.remaining_installments')}</p>
              </div>
              <p className="text-2xl font-bold text-orange-700">{totalInstallments - paidInstallments}</p>
            </div>
          </div>

          <div className="space-y-3">
            {installments.map((installment) => {
              const daysUntilDue = getDaysUntilDue(installment.due_date);
              const isOverdue = !installment.is_paid && daysUntilDue < 0;
              const isDueNow = !installment.is_paid && isDue(installment.due_date) && daysUntilDue >= 0;

              return (
                <div
                  key={installment.id}
                  className={`border-2 rounded-xl p-4 transition-all ${
                    installment.is_paid
                      ? 'border-green-200 bg-green-50'
                      : isOverdue
                      ? 'border-red-300 bg-red-50'
                      : isDueNow
                      ? 'border-orange-300 bg-orange-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                        installment.is_paid
                          ? 'bg-green-600 text-white'
                          : isOverdue
                          ? 'bg-red-600 text-white'
                          : isDueNow
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {installment.installment_number}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-lg text-gray-900">
                            {formatToFixed(installment.amount)} {t('common.sar')}
                          </span>
                          {installment.is_paid && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-green-600 text-white">
                              <CheckCircle className="h-3 w-3" />
                              {t('expenses.paid')}
                            </span>
                          )}
                          {isOverdue && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-red-600 text-white">
                              {t('expenses.overdue')}
                            </span>
                          )}
                          {isDueNow && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-orange-600 text-white">
                              {t('expenses.due_now')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>{t('expenses.due_date')}: {new Date(installment.due_date).toLocaleDateString('ar-SA')}</span>
                          </div>
                          {installment.paid_date && (
                            <div className="text-green-700 font-medium">
                              {t('expenses.paid_on')}: {new Date(installment.paid_date).toLocaleDateString('ar-SA')}
                            </div>
                          )}
                          {!installment.is_paid && daysUntilDue > 0 && (
                            <div className="text-gray-600">
                              {daysUntilDue} {t('expenses.days_remaining')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {!installment.is_paid && (
                      <button
                        onClick={() => handlePayInstallment(installment)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold shadow-md"
                      >
                        {t('expenses.mark_as_paid')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-semibold"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}