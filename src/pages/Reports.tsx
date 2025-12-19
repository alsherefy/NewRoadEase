import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Technician } from '../types';
import { displayNumber, toEnglishDigits } from '../utils/numberUtils';
import {
  User,
  DollarSign,
  Briefcase,
  TrendingUp,
  Package,
  FileText,
  Calendar,
  Printer,
  Download,
  BarChart3,
  PieChart,
  Activity,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface TechnicianReport {
  technician: Technician;
  totalRevenue: number;
  totalEarnings: number;
  jobsCompleted: number;
  averageJobValue: number;
  jobs: Array<{
    service_type: string;
    description: string;
    share_amount: number;
    created_at: string;
  }>;
}

interface OverviewStats {
  totalRevenue: number;
  totalWorkOrders: number;
  completedOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  totalInvoices: number;
  paidInvoices: number;
  unpaidInvoices: number;
  totalSparePartsSold: number;
  sparePartsRevenue: number;
  lowStockItems: number;
}

interface InventoryStats {
  totalItems: number;
  totalValue: number;
  lowStockItems: Array<{
    name: string;
    quantity: number;
    minimum_quantity: number;
  }>;
}

export function Reports() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'inventory' | 'technicians'>('overview');
  const [reports, setReports] = useState<TechnicianReport[]>([]);
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [inventoryStats, setInventoryStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadAllReports();
  }, [startDate, endDate]);

  async function loadAllReports() {
    setLoading(true);
    await Promise.all([
      loadOverviewStats(),
      loadInventoryStats(),
      loadTechnicianReports(),
    ]);
    setLoading(false);
  }

  async function loadOverviewStats() {
    try {
      let workOrdersQuery = supabase.from('work_orders').select('*');
      let invoicesQuery = supabase.from('invoices').select('*');

      if (startDate) {
        workOrdersQuery = workOrdersQuery.gte('created_at', startDate);
        invoicesQuery = invoicesQuery.gte('created_at', startDate);
      }
      if (endDate) {
        workOrdersQuery = workOrdersQuery.lte('created_at', endDate);
        invoicesQuery = invoicesQuery.lte('created_at', endDate);
      }

      const [
        { data: workOrders },
        { data: invoices },
        { data: sparePartsSold },
      ] = await Promise.all([
        workOrdersQuery,
        invoicesQuery,
        supabase.from('work_order_spare_parts').select('quantity, unit_price'),
      ]);

      const completedOrders = workOrders?.filter(wo => wo.status === 'completed').length || 0;
      const pendingOrders = workOrders?.filter(wo => wo.status === 'pending').length || 0;
      const inProgressOrders = workOrders?.filter(wo => wo.status === 'in_progress').length || 0;

      const paidInvoices = invoices?.filter(inv => inv.status === 'paid').length || 0;
      const unpaidInvoices = invoices?.filter(inv => inv.status === 'unpaid' || inv.status === 'partially_paid').length || 0;

      const totalRevenue = invoices?.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0) || 0;
      const sparePartsRevenue = sparePartsSold?.reduce((sum, sp) => sum + (sp.quantity * sp.unit_price), 0) || 0;
      const totalSparePartsSold = sparePartsSold?.reduce((sum, sp) => sum + sp.quantity, 0) || 0;

      const { data: allSpareParts } = await supabase
        .from('spare_parts')
        .select('*');

      const lowStockData = allSpareParts?.filter(sp => sp.quantity <= sp.minimum_quantity) || [];

      setOverviewStats({
        totalRevenue,
        totalWorkOrders: workOrders?.length || 0,
        completedOrders,
        pendingOrders,
        inProgressOrders,
        totalInvoices: invoices?.length || 0,
        paidInvoices,
        unpaidInvoices,
        totalSparePartsSold,
        sparePartsRevenue,
        lowStockItems: lowStockData?.length || 0,
      });
    } catch (error) {
      console.error('Error loading overview stats:', error);
    }
  }

  async function loadInventoryStats() {
    try {
      const { data: spareParts } = await supabase
        .from('spare_parts')
        .select('*');

      const totalValue = spareParts?.reduce((sum, sp) => sum + (sp.quantity * Number(sp.unit_price)), 0) || 0;
      const lowStockItems = spareParts?.filter(sp => sp.quantity <= sp.minimum_quantity) || [];

      setInventoryStats({
        totalItems: spareParts?.length || 0,
        totalValue,
        lowStockItems: lowStockItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          minimum_quantity: item.minimum_quantity,
        })),
      });
    } catch (error) {
      console.error('Error loading inventory stats:', error);
    }
  }

  async function loadTechnicianReports() {
    try {
      const { data: technicians, error: techError } = await supabase
        .from('technicians')
        .select('*')
        .eq('is_active', true);

      if (techError) throw techError;

      const reportsData: TechnicianReport[] = [];

      for (const technician of technicians || []) {
        let query = supabase
          .from('technician_assignments')
          .select(`
            *,
            service:work_order_services!inner(
              *,
              work_order:work_orders!inner(status, created_at)
            )
          `)
          .eq('technician_id', technician.id)
          .eq('service.work_order.status', 'completed');

        if (startDate) {
          query = query.gte('service.work_order.created_at', startDate);
        }
        if (endDate) {
          query = query.lte('service.work_order.created_at', endDate);
        }

        const { data: assignments } = await query;

        const totalRevenue = assignments?.reduce((sum, a) => sum + (a.share_amount || 0), 0) || 0;
        const jobsCompleted = assignments?.length || 0;
        const averageJobValue = jobsCompleted > 0 ? totalRevenue / jobsCompleted : 0;

        let totalEarnings = 0;
        if (technician.contract_type === 'percentage') {
          totalEarnings = (totalRevenue * technician.percentage) / 100;
        } else {
          totalEarnings = technician.fixed_salary;
        }

        const jobs = (assignments || []).map((a: any) => ({
          service_type: a.service?.service_type || '',
          description: a.service?.description || '',
          share_amount: a.share_amount,
          created_at: a.service?.work_order?.created_at || '',
        }));

        reportsData.push({
          technician,
          totalRevenue,
          totalEarnings,
          jobsCompleted,
          averageJobValue,
          jobs,
        });
      }

      reportsData.sort((a, b) => b.totalRevenue - a.totalRevenue);
      setReports(reportsData);
    } catch (error) {
      console.error('Error loading reports:', error);
    }
  }

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const data = {
      overview: overviewStats,
      inventory: inventoryStats,
      technicians: reports,
      generatedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workshop-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selectedReport = reports.find(r => r.technician.id === selectedTechnicianId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="h-12 w-12 text-blue-600 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600 text-lg">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h2 className="text-3xl font-bold text-gray-800">{t('reports.title')}</h2>
        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Printer className="h-5 w-5" />
            {t('common.print')}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="h-5 w-5" />
            {t('common.export')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 print:shadow-none print:p-4">
        <h3 className="text-xl font-bold text-gray-800 mb-4">{t('reports.select_period')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="h-4 w-4 inline ml-2" />
              {t('common.from')}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="h-4 w-4 inline ml-2" />
              {t('common.to')}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md print:shadow-none print:hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'overview'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <BarChart3 className="h-5 w-5 inline ml-2" />
            {t('reports.overview')}
          </button>
          <button
            onClick={() => setActiveTab('financial')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'financial'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <DollarSign className="h-5 w-5 inline ml-2" />
            {t('reports.financial_reports')}
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'inventory'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Package className="h-5 w-5 inline ml-2" />
            {t('nav.inventory')}
          </button>
          <button
            onClick={() => setActiveTab('technicians')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'technicians'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <User className="h-5 w-5 inline ml-2" />
            {t('nav.technicians')}
          </button>
        </div>
      </div>

      {activeTab === 'overview' && overviewStats && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg p-8 text-white print:bg-blue-600">
            <h3 className="text-2xl font-bold mb-2">{t('reports.total_revenue')}</h3>
            <p className="text-5xl font-bold">
              {displayNumber(overviewStats.totalRevenue)} {t('dashboard.sar')}
            </p>
            <p className="text-blue-100 mt-2">
              {startDate || endDate ? t('dashboard.for_selected_period') : t('dashboard.all_time')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-md p-6 border-r-4 border-blue-500">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-blue-100 rounded-lg p-3">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-3xl font-bold text-gray-800">
                  {overviewStats.totalWorkOrders}
                </span>
              </div>
              <h4 className="text-gray-600 font-medium">{t('dashboard.total_work_orders')}</h4>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 border-r-4 border-green-500">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-green-100 rounded-lg p-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <span className="text-3xl font-bold text-gray-800">
                  {overviewStats.completedOrders}
                </span>
              </div>
              <h4 className="text-gray-600 font-medium">{t('dashboard.completed_orders')}</h4>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 border-r-4 border-yellow-500">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-yellow-100 rounded-lg p-3">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <span className="text-3xl font-bold text-gray-800">
                  {overviewStats.inProgressOrders}
                </span>
              </div>
              <h4 className="text-gray-600 font-medium">{t('status.in_progress')}</h4>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 border-r-4 border-orange-500">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-orange-100 rounded-lg p-3">
                  <AlertTriangle className="h-6 w-6 text-orange-600" />
                </div>
                <span className="text-3xl font-bold text-gray-800">
                  {overviewStats.pendingOrders}
                </span>
              </div>
              <h4 className="text-gray-600 font-medium">{t('dashboard.pending_orders')}</h4>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-teal-100 rounded-lg p-3">
                  <DollarSign className="h-6 w-6 text-teal-600" />
                </div>
                <h4 className="text-lg font-bold text-gray-800">{t('nav.invoices')}</h4>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{t('dashboard.total_invoices')}</span>
                  <span className="font-bold text-gray-800">{overviewStats.totalInvoices}</span>
                </div>
                <div className="flex items-center justify-between text-green-600">
                  <span>{t('dashboard.paid_invoices')}</span>
                  <span className="font-bold">{overviewStats.paidInvoices}</span>
                </div>
                <div className="flex items-center justify-between text-red-600">
                  <span>{t('dashboard.unpaid_invoices')}</span>
                  <span className="font-bold">{overviewStats.unpaidInvoices}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-orange-100 rounded-lg p-3">
                  <ShoppingCart className="h-6 w-6 text-orange-600" />
                </div>
                <h4 className="text-lg font-bold text-gray-800">{t('work_orders.spare_parts')}</h4>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{t('dashboard.parts_sold')}</span>
                  <span className="font-bold text-gray-800">{overviewStats.totalSparePartsSold}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{t('dashboard.revenue')}</span>
                  <span className="font-bold text-green-600">
                    {displayNumber(overviewStats.sparePartsRevenue)} {t('dashboard.sar')}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-100 rounded-lg p-3">
                  <Package className="h-6 w-6 text-red-600" />
                </div>
                <h4 className="text-lg font-bold text-gray-800">{t('dashboard.stock_alerts')}</h4>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{t('dashboard.low_stock_items')}</span>
                  <span className="font-bold text-red-600">{overviewStats.lowStockItems}</span>
                </div>
                {overviewStats.lowStockItems > 0 && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                    <AlertTriangle className="h-4 w-4 inline ml-1" />
                    {t('dashboard.reorder_required')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'financial' && overviewStats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-6">{t('reports.revenue_by_source')}</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-blue-600 rounded"></div>
                    <span className="text-gray-700 font-medium">{t('dashboard.services_maintenance')}</span>
                  </div>
                  <span className="font-bold text-blue-700">
                    {displayNumber(overviewStats.totalRevenue - overviewStats.sparePartsRevenue)} {t('dashboard.sar')}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-orange-600 rounded"></div>
                    <span className="text-gray-700 font-medium">{t('work_orders.spare_parts')}</span>
                  </div>
                  <span className="font-bold text-orange-700">
                    {displayNumber(overviewStats.sparePartsRevenue)} {t('dashboard.sar')}
                  </span>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-gray-800">{t('common.total')}</span>
                    <span className="text-2xl font-bold text-green-600">
                      {displayNumber(overviewStats.totalRevenue)} {t('dashboard.sar')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-6">{t('reports.invoice_status')}</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-gray-700 font-medium">{t('dashboard.paid_invoices')}</span>
                  </div>
                  <span className="font-bold text-green-700">{overviewStats.paidInvoices}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <span className="text-gray-700 font-medium">{t('dashboard.unpaid_invoices')}</span>
                  </div>
                  <span className="font-bold text-red-700">{overviewStats.unpaidInvoices}</span>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-gray-800">{t('dashboard.total_invoices')}</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {overviewStats.totalInvoices}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-6">{t('reports.financial_performance_summary')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                <PieChart className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-1">{t('reports.paid_invoices_percentage')}</p>
                <p className="text-2xl font-bold text-green-700">
                  {overviewStats.totalInvoices > 0
                    ? Math.round((overviewStats.paidInvoices / overviewStats.totalInvoices) * 100)
                    : 0}%
                </p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                <BarChart3 className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-1">{t('reports.avg_invoice_value')}</p>
                <p className="text-2xl font-bold text-blue-700">
                  {overviewStats.totalInvoices > 0
                    ? displayNumber(Math.round(overviewStats.totalRevenue / overviewStats.totalInvoices))
                    : 0} {t('dashboard.sar')}
                </p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg">
                <Activity className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-1">{t('reports.spare_parts_percentage')}</p>
                <p className="text-2xl font-bold text-orange-700">
                  {overviewStats.totalRevenue > 0
                    ? Math.round((overviewStats.sparePartsRevenue / overviewStats.totalRevenue) * 100)
                    : 0}%
                </p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg">
                <TrendingUp className="h-8 w-8 text-teal-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-1">{t('reports.completion_rate')}</p>
                <p className="text-2xl font-bold text-teal-700">
                  {overviewStats.totalWorkOrders > 0
                    ? Math.round((overviewStats.completedOrders / overviewStats.totalWorkOrders) * 100)
                    : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && inventoryStats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl shadow-lg p-8 text-white">
              <Package className="h-12 w-12 mb-4" />
              <h3 className="text-xl font-bold mb-2">{t('inventory.total_parts')}</h3>
              <p className="text-5xl font-bold">{inventoryStats.totalItems}</p>
            </div>

            <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl shadow-lg p-8 text-white">
              <DollarSign className="h-12 w-12 mb-4" />
              <h3 className="text-xl font-bold mb-2">{t('reports.inventory_value')}</h3>
              <p className="text-5xl font-bold">
                {displayNumber(Math.round(inventoryStats.totalValue))} {t('dashboard.sar')}
              </p>
            </div>
          </div>

          {inventoryStats.lowStockItems.length > 0 && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-red-100 rounded-lg p-3">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">
                  {t('reports.reorder_required_items')} ({inventoryStats.lowStockItems.length})
                </h3>
              </div>
              <div className="space-y-3">
                {inventoryStats.lowStockItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <div>
                      <h4 className="font-bold text-gray-800">{item.name}</h4>
                      <p className="text-sm text-gray-600">
                        {t('reports.min_quantity')}: {item.minimum_quantity}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-gray-600 mb-1">{t('reports.current_quantity')}</p>
                      <p className="text-2xl font-bold text-red-600">{item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {inventoryStats.lowStockItems.length === 0 && (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{t('reports.all_items_stocked')}</h3>
              <p className="text-gray-600">{t('reports.no_reorder_needed')}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'technicians' && (
        <div className="space-y-6">
          {!selectedTechnicianId ? (
            <>
              <div className="bg-white rounded-xl shadow-md p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('reports.select_technician')}
                </label>
                <select
                  value={selectedTechnicianId}
                  onChange={(e) => setSelectedTechnicianId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t('reports.select_technician_placeholder')}</option>
                  {reports.map((report) => (
                    <option key={report.technician.id} value={report.technician.id}>
                      {report.technician.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reports.map((report) => (
                  <div
                    key={report.technician.id}
                    className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-500"
                    onClick={() => setSelectedTechnicianId(report.technician.id)}
                  >
                    <div className="flex items-center space-x-3 space-x-reverse mb-6">
                      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-full p-3">
                        <User className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">{report.technician.name}</h3>
                        <p className="text-sm text-gray-600">{t(`technicians.specializations.${report.technician.specialization}`)}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <DollarSign className="h-5 w-5 text-green-600" />
                          <span className="text-sm text-gray-700">{t('evaluation.total_revenue')}</span>
                        </div>
                        <span className="font-bold text-green-700">
                          {displayNumber(report.totalRevenue)} {t('dashboard.sar')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <Briefcase className="h-5 w-5 text-blue-600" />
                          <span className="text-sm text-gray-700">{t('evaluation.jobs_completed')}</span>
                        </div>
                        <span className="font-bold text-blue-700">{report.jobsCompleted}</span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <TrendingUp className="h-5 w-5 text-orange-600" />
                          <span className="text-sm text-gray-700">{t('evaluation.avg_job_value')}</span>
                        </div>
                        <span className="font-bold text-orange-700">
                          {displayNumber(Math.round(report.averageJobValue))} {t('dashboard.sar')}
                        </span>
                      </div>

                      <div className="pt-3 border-t border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">{t('reports.dues')}</div>
                        <div className="text-xl font-bold text-gray-800">
                          {displayNumber(Math.round(report.totalEarnings))} {t('dashboard.sar')}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {report.technician.contract_type === 'percentage'
                            ? `${toEnglishDigits(report.technician.percentage)}% ${t('reports.from_revenue')}`
                            : t('reports.fixed_salary')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            selectedReport && (
              <div className="space-y-6">
                <button
                  onClick={() => setSelectedTechnicianId('')}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  {t('common.back')}
                </button>

                <div className="bg-white rounded-xl shadow-md p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-full p-4">
                      <User className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800">
                        {selectedReport.technician.name}
                      </h3>
                      <p className="text-gray-600">{t(`technicians.specializations.${selectedReport.technician.specialization}`)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">{t('evaluation.total_revenue')}</p>
                      <p className="text-2xl font-bold text-green-700">
                        {displayNumber(selectedReport.totalRevenue)} {t('dashboard.sar')}
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">{t('evaluation.jobs_completed')}</p>
                      <p className="text-2xl font-bold text-blue-700">{selectedReport.jobsCompleted}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">{t('evaluation.avg_job_value')}</p>
                      <p className="text-2xl font-bold text-orange-700">
                        {displayNumber(Math.round(selectedReport.averageJobValue))} {t('dashboard.sar')}
                      </p>
                    </div>
                    <div className="bg-teal-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">{t('reports.dues')}</p>
                      <p className="text-2xl font-bold text-teal-700">
                        {displayNumber(Math.round(selectedReport.totalEarnings))} {t('dashboard.sar')}
                      </p>
                    </div>
                  </div>

                  <h4 className="text-xl font-bold text-gray-800 mb-4">{t('reports.completed_jobs_list')}</h4>
                  <div className="space-y-3">
                    {selectedReport.jobs.length > 0 ? (
                      selectedReport.jobs.map((job, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="font-bold text-gray-800">{job.service_type}</h5>
                              <p className="text-gray-600 text-sm mt-1">{job.description}</p>
                              <p className="text-xs text-gray-500 mt-2">
                                {new Date(job.created_at).toLocaleDateString('en-US')}
                              </p>
                            </div>
                            <div className="text-left">
                              <p className="text-sm text-gray-600">{t('reports.share')}</p>
                              <p className="text-lg font-bold text-green-600">
                                {displayNumber(job.share_amount)} {t('dashboard.sar')}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        {t('reports.no_jobs_in_period')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          )}

          {reports.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl shadow-md">
              <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">{t('common.no_data')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
