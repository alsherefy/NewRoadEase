import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Technician } from '../types';
import { Award, TrendingUp, TrendingDown, Minus, Trophy, FileText, X } from 'lucide-react';
import { displayNumber, formatToFixed } from '../utils/numberUtils';

interface TechnicianEvaluation {
  technician: Technician;
  totalRevenue: number;
  jobsCompleted: number;
  averageJobValue: number;
  revenuePercentage: number;
  rank: number;
}

interface InvoiceDetail {
  id: string;
  invoice_number: string;
  work_order_id: string;
  total: number;
  payment_status: string;
  created_at: string;
  work_order: {
    order_number: string;
    completed_at: string;
  };
}

interface EvaluationManagementProps {
  technicians: Technician[];
}

export function EvaluationManagement({ technicians }: EvaluationManagementProps) {
  const { t } = useTranslation();
  const [evaluations, setEvaluations] = useState<TechnicianEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadEvaluations();
  }, [startDate, endDate, technicians]);

  async function loadEvaluations() {
    setLoading(true);
    try {
      const activeTechnicians = technicians.filter(t => t.is_active);

      let totalWorkshopRevenue = 0;
      const evaluationsData: Omit<TechnicianEvaluation, 'rank'>[] = [];

      for (const technician of activeTechnicians) {
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

        totalWorkshopRevenue += totalRevenue;

        evaluationsData.push({
          technician,
          totalRevenue,
          jobsCompleted,
          averageJobValue,
          revenuePercentage: 0,
        });
      }

      evaluationsData.forEach((e) => {
        e.revenuePercentage = totalWorkshopRevenue > 0 ? (e.totalRevenue / totalWorkshopRevenue) * 100 : 0;
      });

      evaluationsData.sort((a, b) => b.totalRevenue - a.totalRevenue);

      const rankedEvaluations: TechnicianEvaluation[] = evaluationsData.map((e, index) => ({
        ...e,
        rank: index + 1,
      }));

      setEvaluations(rankedEvaluations);
    } catch (error) {
      console.error('Error loading evaluations:', error);
    } finally {
      setLoading(false);
    }
  }

  const getPerformanceBadge = (percentage: number) => {
    if (percentage >= 30) {
      return {
        label: t('evaluation.excellent'),
        color: 'bg-gradient-to-r from-green-500 to-green-600',
        icon: TrendingUp,
      };
    } else if (percentage >= 20) {
      return {
        label: t('evaluation.very_good'),
        color: 'bg-gradient-to-r from-blue-500 to-blue-600',
        icon: TrendingUp,
      };
    } else if (percentage >= 10) {
      return {
        label: t('evaluation.good'),
        color: 'bg-gradient-to-r from-orange-500 to-orange-600',
        icon: Minus,
      };
    } else {
      return {
        label: t('evaluation.average'),
        color: 'bg-gradient-to-r from-gray-400 to-gray-500',
        icon: TrendingDown,
      };
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return {
        color: 'bg-gradient-to-r from-yellow-400 to-yellow-500',
        icon: '🥇',
      };
    } else if (rank === 2) {
      return {
        color: 'bg-gradient-to-r from-gray-300 to-gray-400',
        icon: '🥈',
      };
    } else if (rank === 3) {
      return {
        color: 'bg-gradient-to-r from-orange-400 to-orange-500',
        icon: '🥉',
      };
    } else {
      return {
        color: 'bg-gradient-to-r from-gray-200 to-gray-300',
        icon: `#${rank}`,
      };
    }
  };

  async function loadTechnicianDetails(technician: Technician) {
    setSelectedTechnician(technician);
    setShowDetailModal(true);
    setLoadingDetails(true);

    try {
      let query = supabase
        .from('technician_assignments')
        .select(`
          *,
          service:work_order_services!inner(
            work_order_id,
            work_order:work_orders!inner(
              order_number,
              status,
              completed_at
            )
          )
        `)
        .eq('technician_id', technician.id)
        .eq('service.work_order.status', 'completed');

      if (startDate) {
        query = query.gte('service.work_order.completed_at', startDate);
      }
      if (endDate) {
        query = query.lte('service.work_order.completed_at', endDate);
      }

      const { data: assignments } = await query;

      const workOrderIds = [...new Set(assignments?.map(a => a.service?.work_order_id) || [])];

      let invoicesQuery = supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          work_order_id,
          total,
          payment_status,
          created_at,
          work_order:work_orders(order_number, completed_at)
        `)
        .in('work_order_id', workOrderIds)
        .eq('payment_status', 'paid');

      const { data: invoices } = await invoicesQuery;

      setInvoiceDetails((invoices || []) as InvoiceDetail[]);
    } catch (error) {
      console.error('Error loading technician details:', error);
    } finally {
      setLoadingDetails(false);
    }
  }

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">{t('evaluation.filter_title')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.from_date')}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.to_date')}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {evaluations.length > 0 && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
          <h3 className="text-xl font-bold mb-4">{t('evaluation.total_workshop_revenue')}</h3>
          <p className="text-4xl font-bold">
            {displayNumber(evaluations.reduce((sum, e) => sum + e.totalRevenue, 0))} {t('common.currency')}
          </p>
          <p className="text-sm opacity-90 mt-2">{t('evaluation.from_jobs', { count: evaluations.reduce((sum, e) => sum + e.jobsCompleted, 0) })}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">{t('evaluation.rank')}</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">{t('evaluation.technician')}</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">{t('evaluation.total_revenue')}</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">{t('evaluation.jobs_count')}</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">{t('evaluation.avg_job_value')}</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">{t('evaluation.contribution_percentage')}</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">{t('evaluation.rating')}</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {evaluations.map((evaluation) => {
                const rankBadge = getRankBadge(evaluation.rank);
                const performance = getPerformanceBadge(evaluation.revenuePercentage);
                const PerformanceIcon = performance.icon;

                return (
                  <tr key={evaluation.technician.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center justify-center w-12 h-12 ${rankBadge.color} rounded-full text-white font-bold text-lg shadow-md`}>
                        {rankBadge.icon}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3 space-x-reverse">
                        <div className="bg-blue-100 rounded-full p-2">
                          <Award className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{evaluation.technician.name}</p>
                          <p className="text-sm text-gray-600">{t(`technicians.specializations.${evaluation.technician.specialization}`)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-lg font-bold text-green-600">
                        {displayNumber(evaluation.totalRevenue)} {t('common.currency')}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-lg font-semibold text-gray-800">{evaluation.jobsCompleted}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-lg font-semibold text-gray-800">
                        {evaluation.averageJobValue.toLocaleString('en-US', { maximumFractionDigits: 0 })} {t('common.currency')}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <p className="text-lg font-bold text-blue-600">
                          {formatToFixed(evaluation.revenuePercentage, 1)}%
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(evaluation.revenuePercentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center space-x-2 space-x-reverse ${performance.color} text-white px-4 py-2 rounded-lg shadow-md`}>
                        <PerformanceIcon className="h-5 w-5" />
                        <span className="font-bold">{performance.label}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => loadTechnicianDetails(evaluation.technician)}
                        className="flex items-center space-x-2 space-x-reverse bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <FileText className="h-5 w-5" />
                        <span>{t('evaluation.view_report')}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {evaluations.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <p className="text-gray-500 text-lg">{t('evaluation.no_data')}</p>
        </div>
      )}

      {showDetailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-800">
                  {t('evaluation.detailed_report')}
                </h3>
                <p className="text-gray-600 mt-1">
                  {t('evaluation.technician')}: {selectedTechnician?.name}
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              {loadingDetails ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">{t('common.loading')}</p>
                </div>
              ) : (
                <>
                  <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">{t('evaluation.total_invoices')}</p>
                        <p className="text-2xl font-bold text-blue-600">{invoiceDetails.length}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">{t('evaluation.total_paid_amount')}</p>
                        <p className="text-2xl font-bold text-green-600">
                          {displayNumber(invoiceDetails.reduce((sum, inv) => sum + inv.total, 0))} {t('common.currency')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">{t('evaluation.date_range')}</p>
                        <p className="text-sm font-medium text-gray-800">
                          {startDate || t('evaluation.all_time')} - {endDate || t('evaluation.now')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{t('evaluation.invoice_number')}</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{t('evaluation.work_order_number')}</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{t('evaluation.invoice_amount')}</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{t('evaluation.completed_date')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {invoiceDetails.map((invoice) => (
                          <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-blue-600">
                              {invoice.invoice_number}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {invoice.work_order.order_number}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-green-600">
                              {displayNumber(invoice.total)} {t('common.currency')}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {new Date(invoice.work_order.completed_at).toLocaleDateString('ar-SA')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {invoiceDetails.length === 0 && (
                    <div className="text-center py-12">
                      <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">{t('evaluation.no_invoices')}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
