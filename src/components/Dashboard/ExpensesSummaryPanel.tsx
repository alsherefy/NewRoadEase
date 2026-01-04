import { Receipt, Calendar, PieChart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFormatNumber } from '../../hooks/useFormatNumber';

interface ExpenseInstallment {
  id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  payment_status: string;
  expenses: {
    expense_number: string;
    description: string;
    category: string;
  };
}

interface ExpensesSummaryPanelProps {
  data: {
    dueToday: ExpenseInstallment[];
    monthlyTotal: number;
    byCategory: Record<string, number>;
  };
  onViewExpenses?: () => void;
}

export default function ExpensesSummaryPanel({ data, onViewExpenses }: ExpensesSummaryPanelProps) {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatNumber();

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      salaries: t('expenses.types.salaries'),
      maintenance: t('expenses.types.maintenance'),
      materials: t('expenses.types.materials'),
      equipment: t('expenses.types.equipment'),
      rent: t('expenses.types.rent'),
      electricity: t('expenses.types.electricity'),
      water: t('expenses.types.water'),
      fuel: t('expenses.types.fuel'),
      other: t('expenses.types.other'),
    };
    return labels[category] || category;
  };

  const getCategoryColor = (index: number) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-orange-500',
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900">
            {t('dashboard.expensesSummary')}
          </h3>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">{t('dashboard.monthlyTotal')}</p>
          <p className="text-lg font-bold text-gray-900">
            {formatCurrency(data.monthlyTotal)}
          </p>
        </div>
      </div>

      {data.dueToday.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {t('dashboard.dueToday')}
          </h4>
          <div className="space-y-2">
            {data.dueToday.map((installment) => (
              <div
                key={installment.id}
                onClick={onViewExpenses}
                className="p-3 bg-orange-50 border border-orange-200 rounded-lg cursor-pointer hover:bg-orange-100 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {installment.expenses.description}
                    </p>
                    <p className="text-sm text-gray-600">
                      {getCategoryLabel(installment.expenses.category)}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-orange-600">
                    {formatCurrency(installment.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(data.byCategory).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <PieChart className="w-4 h-4" />
            {t('dashboard.byCategory')}
          </h4>
          <div className="space-y-2">
            {Object.entries(data.byCategory)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([category, amount], index) => (
                <div key={category} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${getCategoryColor(index)}`} />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                      {getCategoryLabel(category)}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(amount)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <button
        onClick={onViewExpenses}
        className="w-full mt-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        {t('dashboard.viewAll')}
      </button>
    </div>
  );
}
