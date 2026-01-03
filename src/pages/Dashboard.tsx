import { useEffect, useState } from 'react';
import { DollarSign, ClipboardList, Users, TrendingUp, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../utils/numberUtils';
import { dashboardService } from '../services';
import { useAuth } from '../contexts/AuthContext';
import FinancialStatsCard from '../components/Dashboard/FinancialStatsCard';
import OpenOrdersPanel from '../components/Dashboard/OpenOrdersPanel';
import OpenInvoicesPanel from '../components/Dashboard/OpenInvoicesPanel';
import InventoryAlertsPanel from '../components/Dashboard/InventoryAlertsPanel';
import ExpensesSummaryPanel from '../components/Dashboard/ExpensesSummaryPanel';
import TechniciansPerformancePanel from '../components/Dashboard/TechniciansPerformancePanel';

interface Stats {
  totalRevenue: number;
  completedOrders: number;
  activeCustomers: number;
  activeTechnicians: number;
}

interface EnhancedDashboardData {
  sections: {
    financialStats?: any;
    openOrders?: any;
    openInvoices?: any;
    inventoryAlerts?: any;
    expenses?: any;
    techniciansPerformance?: any;
  };
  permissions: {
    financialStats: boolean;
    openOrders: boolean;
    openInvoices: boolean;
    inventoryAlerts: boolean;
    expenses: boolean;
    techniciansPerformance: boolean;
    activities: boolean;
  };
}

export function Dashboard() {
  const { t } = useTranslation();
  const { hasPermission, hasDetailedPermission } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    completedOrders: 0,
    activeCustomers: 0,
    activeTechnicians: 0,
  });
  const [enhancedData, setEnhancedData] = useState<EnhancedDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const [basicStats, enhanced] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getEnhancedDashboard(),
      ]);
      setStats(basicStats);
      setEnhancedData(enhanced);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!hasPermission('dashboard')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">غير مصرح</h3>
          <p className="text-gray-600">ليس لديك صلاحية لعرض هذه الصفحة</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-600">{t('common.loading')}</div>
      </div>
    );
  }

  const showFinancialStats = hasDetailedPermission('dashboard.view_financial_stats');
  const showOpenOrders = hasDetailedPermission('dashboard.view_open_orders');
  const showOpenInvoices = hasDetailedPermission('dashboard.view_open_invoices');
  const showInventoryAlerts = hasDetailedPermission('dashboard.view_inventory_alerts');
  const showExpenses = hasDetailedPermission('dashboard.view_expenses');
  const showTechniciansPerformance = hasDetailedPermission('dashboard.view_technicians_performance');

  const statCards = [
    {
      title: t('dashboard.total_revenue'),
      value: showFinancialStats ? `${formatNumber(stats.totalRevenue)} ${t('dashboard.sar')}` : '****',
      icon: DollarSign,
      color: 'bg-gradient-to-br from-green-500 to-green-600',
      show: true,
    },
    {
      title: t('dashboard.completed_work_orders'),
      value: stats.completedOrders.toString(),
      icon: ClipboardList,
      color: 'bg-gradient-to-br from-blue-500 to-blue-600',
      show: showOpenOrders,
    },
    {
      title: t('dashboard.active_customers'),
      value: stats.activeCustomers.toString(),
      icon: Users,
      color: 'bg-gradient-to-br from-orange-500 to-orange-600',
      show: true,
    },
    {
      title: t('dashboard.active_technicians'),
      value: stats.activeTechnicians.toString(),
      icon: TrendingUp,
      color: 'bg-gradient-to-br from-teal-500 to-teal-600',
      show: showTechniciansPerformance,
    },
  ].filter(card => card.show);

  const hasAnySections = showFinancialStats || showOpenOrders || showOpenInvoices ||
                         showInventoryAlerts || showExpenses || showTechniciansPerformance;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-800">{t('dashboard.title')}</h2>
      </div>

      {statCards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className={`${card.color} rounded-xl shadow-lg p-6 text-white transform transition-transform hover:scale-105`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">{card.title}</p>
                    <p className="text-3xl font-bold">{card.value}</p>
                  </div>
                  <Icon className="h-12 w-12 opacity-80" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!hasAnySections && (
        <div className="bg-white rounded-xl shadow-md p-8">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">{t('dashboard.welcome')}</h3>
          <p className="text-gray-600 text-lg leading-relaxed">
            {t('dashboard.welcome_message')}
          </p>
        </div>
      )}

      {hasAnySections && enhancedData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {showFinancialStats && enhancedData.sections.financialStats && (
            <div className="lg:col-span-2">
              <FinancialStatsCard data={enhancedData.sections.financialStats} />
            </div>
          )}

          {showOpenOrders && enhancedData.sections.openOrders && (
            <OpenOrdersPanel data={enhancedData.sections.openOrders} />
          )}

          {showOpenInvoices && enhancedData.sections.openInvoices && (
            <OpenInvoicesPanel
              data={enhancedData.sections.openInvoices}
              showAmounts={showFinancialStats}
            />
          )}

          {showInventoryAlerts && enhancedData.sections.inventoryAlerts && (
            <InventoryAlertsPanel data={enhancedData.sections.inventoryAlerts} />
          )}

          {showExpenses && enhancedData.sections.expenses && (
            <ExpensesSummaryPanel data={enhancedData.sections.expenses} />
          )}

          {showTechniciansPerformance && enhancedData.sections.techniciansPerformance && (
            <TechniciansPerformancePanel data={enhancedData.sections.techniciansPerformance} />
          )}
        </div>
      )}
    </div>
  );
}
