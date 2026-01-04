import { DollarSign, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFormatNumber } from '../../hooks/useFormatNumber';
import { DashboardFinancialStats } from '../../types/dashboard';

interface FinancialStatsCardProps {
  data: DashboardFinancialStats;
}

export default function FinancialStatsCard({ data }: FinancialStatsCardProps) {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatNumber();

  const stats = [
    {
      label: t('dashboard.todayRevenue'),
      value: data?.todayRevenue || 0,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: t('dashboard.weekRevenue'),
      value: data?.weekRevenue || 0,
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: t('dashboard.monthRevenue'),
      value: data?.monthRevenue || 0,
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: t('dashboard.todayExpenses'),
      value: data?.todayExpenses || 0,
      icon: TrendingDown,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {t('dashboard.financialSummary')}
        </h3>
        <div className="flex items-center gap-2">
          {(data?.netProfit || 0) >= 0 ? (
            <TrendingUp className="w-5 h-5 text-green-600" />
          ) : (
            <TrendingDown className="w-5 h-5 text-red-600" />
          )}
          <span
            className={`text-sm font-medium ${
              (data?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {t('dashboard.netProfit')}: {formatCurrency(data?.netProfit || 0)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="flex items-start gap-3">
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <Icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {formatCurrency(stat.value)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
