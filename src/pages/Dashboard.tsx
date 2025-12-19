import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, ClipboardList, Users, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../utils/numberUtils';

interface Stats {
  totalRevenue: number;
  completedOrders: number;
  activeCustomers: number;
  activeTechnicians: number;
}

export function Dashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    completedOrders: 0,
    activeCustomers: 0,
    activeTechnicians: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const [revenueResult, completedCountResult, customersResult, techniciansResult] = await Promise.all([
        supabase.from('work_orders')
          .select('total_labor_cost')
          .eq('status', 'completed'),
        supabase.from('work_orders')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completed'),
        supabase.from('customers')
          .select('id', { count: 'exact', head: true }),
        supabase.from('technicians')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),
      ]);

      const totalRevenue = revenueResult.data?.reduce((sum, order) => sum + (order.total_labor_cost || 0), 0) || 0;

      setStats({
        totalRevenue,
        completedOrders: completedCountResult.count || 0,
        activeCustomers: customersResult.count || 0,
        activeTechnicians: techniciansResult.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    {
      title: t('dashboard.total_revenue'),
      value: `${formatNumber(stats.totalRevenue)} ${t('dashboard.sar')}`,
      icon: DollarSign,
      color: 'bg-gradient-to-br from-green-500 to-green-600',
    },
    {
      title: t('dashboard.completed_work_orders'),
      value: stats.completedOrders.toString(),
      icon: ClipboardList,
      color: 'bg-gradient-to-br from-blue-500 to-blue-600',
    },
    {
      title: t('dashboard.active_customers'),
      value: stats.activeCustomers.toString(),
      icon: Users,
      color: 'bg-gradient-to-br from-orange-500 to-orange-600',
    },
    {
      title: t('dashboard.active_technicians'),
      value: stats.activeTechnicians.toString(),
      icon: TrendingUp,
      color: 'bg-gradient-to-br from-teal-500 to-teal-600',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-600">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">{t('dashboard.title')}</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className={`${card.color} rounded-lg sm:rounded-xl shadow-lg p-4 sm:p-5 lg:p-6 text-white transform transition-transform hover:scale-105`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm opacity-90 mb-1 truncate">{card.title}</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">{card.value}</p>
                </div>
                <Icon className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 opacity-80 flex-shrink-0 ml-2" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-lg sm:rounded-xl shadow-md p-4 sm:p-6 lg:p-8">
        <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-3 sm:mb-4">{t('dashboard.welcome')}</h3>
        <p className="text-gray-600 text-sm sm:text-base lg:text-lg leading-relaxed">
          {t('dashboard.welcome_message')}
        </p>
      </div>
    </div>
  );
}
