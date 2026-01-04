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
import {
  DashboardBasicStats,
  EnhancedDashboardData,
} from '../types/dashboard';

interface DashboardProps {
  onNavigate?: (view: string, id?: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps = {}) {
  const { t } = useTranslation();
  const { hasPermission, hasDetailedPermission } = useAuth();
  const [stats, setStats] = useState<DashboardBasicStats>({
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

      console.log('=== DASHBOARD DEBUG START ===');
      console.log('1. Basic Stats:', JSON.stringify(basicStats, null, 2));
      console.log('2. Enhanced Data:', JSON.stringify(enhanced, null, 2));
      console.log('3. Open Invoices Section:', JSON.stringify(enhanced?.sections?.openInvoices, null, 2));
      console.log('4. Financial Stats Section:', JSON.stringify(enhanced?.sections?.financialStats, null, 2));
      console.log('5. Inventory Alerts:', JSON.stringify(enhanced?.sections?.inventoryAlerts, null, 2));
      console.log('6. Expenses:', JSON.stringify(enhanced?.sections?.expenses, null, 2));
      console.log('7. Permissions:', JSON.stringify(enhanced?.permissions, null, 2));
      console.log('=== DASHBOARD DEBUG END ===');

      setStats(basicStats);
      setEnhancedData(enhanced);
    } catch (error) {
      console.error('=== DASHBOARD ERROR ===');
      console.error('Error details:', error);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      console.error('=== ERROR END ===');
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

  const handleCardClick = (cardType: string) => {
    if (!onNavigate) return;

    switch (cardType) {
      case 'revenue':
        onNavigate('reports');
        break;
      case 'work_orders':
        onNavigate('work-orders');
        break;
      case 'customers':
        onNavigate('customers');
        break;
      case 'technicians':
        onNavigate('technicians');
        break;
    }
  };

  const statCards = [
    {
      title: t('dashboard.total_revenue'),
      value: showFinancialStats ? `${formatNumber(stats.totalRevenue)} ${t('dashboard.sar')}` : '****',
      icon: DollarSign,
      color: 'bg-gradient-to-br from-green-500 to-green-600',
      show: true,
      onClick: () => handleCardClick('revenue'),
    },
    {
      title: t('dashboard.completed_work_orders'),
      value: stats.completedOrders.toString(),
      icon: ClipboardList,
      color: 'bg-gradient-to-br from-blue-500 to-blue-600',
      show: showOpenOrders,
      onClick: () => handleCardClick('work_orders'),
    },
    {
      title: t('dashboard.active_customers'),
      value: stats.activeCustomers.toString(),
      icon: Users,
      color: 'bg-gradient-to-br from-orange-500 to-orange-600',
      show: true,
      onClick: () => handleCardClick('customers'),
    },
    {
      title: t('dashboard.active_technicians'),
      value: stats.activeTechnicians.toString(),
      icon: TrendingUp,
      color: 'bg-gradient-to-br from-teal-500 to-teal-600',
      show: showTechniciansPerformance,
      onClick: () => handleCardClick('technicians'),
    },
  ].filter(card => card.show);

  const hasAnySections = showFinancialStats || showOpenOrders || showOpenInvoices ||
                         showInventoryAlerts || showExpenses || showTechniciansPerformance;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">{t('dashboard.title')}</h2>
          <p className="text-gray-600 mt-1">{t('dashboard.subtitle')}</p>
        </div>
      </div>

      {statCards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                onClick={card.onClick}
                className={`${card.color} rounded-xl shadow-lg p-6 text-white transform transition-all duration-200 hover:scale-105 hover:shadow-2xl cursor-pointer`}
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
          <p className="text-gray-600 text-lg leading-relaxed mb-6">
            {t('dashboard.welcome_message')}
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-blue-900 mb-3">
              {t('dashboard.gettingStarted')}
            </h4>
            <ul className="space-y-2 text-blue-800">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>{t('dashboard.tip1')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>{t('dashboard.tip2')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>{t('dashboard.tip3')}</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {hasAnySections && enhancedData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {showFinancialStats && (
            <div className="lg:col-span-2">
              <FinancialStatsCard data={enhancedData.sections.financialStats || {
                todayRevenue: 0,
                weekRevenue: 0,
                monthRevenue: 0,
                todayExpenses: 0,
                netProfit: 0,
              }} />
            </div>
          )}

          {showOpenOrders && (
            <OpenOrdersPanel
              data={enhancedData.sections.openOrders || {
                inProgress: [],
                pending: [],
                totalCount: 0,
              }}
              onViewOrder={(orderId) => onNavigate?.('work-order-details', orderId)}
              onViewAll={() => onNavigate?.('work-orders')}
            />
          )}

          {showOpenInvoices && (
            <OpenInvoicesPanel
              data={enhancedData.sections.openInvoices || {
                unpaidInvoices: [],
                overdueInvoices: [],
                totalAmount: 0,
                totalCount: 0,
              }}
              showAmounts={showFinancialStats}
              onViewInvoice={(invoiceId) => onNavigate?.('invoice-details', invoiceId)}
              onViewAll={() => onNavigate?.('invoices')}
            />
          )}

          {showInventoryAlerts && (
            <InventoryAlertsPanel
              data={enhancedData.sections.inventoryAlerts || {
                outOfStock: [],
                lowStock: [],
                totalLowStockItems: 0,
              }}
              onViewInventory={() => onNavigate?.('inventory')}
            />
          )}

          {showExpenses && (
            <ExpensesSummaryPanel
              data={enhancedData.sections.expenses || {
                dueToday: [],
                monthlyTotal: 0,
                byCategory: {},
              }}
              onViewExpenses={() => onNavigate?.('expenses')}
            />
          )}

          {showTechniciansPerformance && (
            <TechniciansPerformancePanel
              data={enhancedData.sections.techniciansPerformance || {
                activeTechnicians: 0,
                technicians: [],
              }}
              onViewTechnicians={() => onNavigate?.('technicians')}
            />
          )}
        </div>
      )}
    </div>
  );
}
