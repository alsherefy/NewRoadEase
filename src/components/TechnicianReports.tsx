import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Technician } from '../types';
import { FileText, Calendar } from 'lucide-react';
import { displayNumber } from '../utils/numberUtils';
import { useToast } from '../contexts/ToastContext';

interface TechnicianReportsProps {
  technicians: Technician[];
}

interface TechnicianStats {
  technician: Technician;
  totalRevenue: number;
  jobsCompleted: number;
  averageJobValue: number;
  withdrawals: number;
  invoices: InvoiceDetail[];
}

interface InvoiceDetail {
  id: string;
  invoice_number: string;
  work_order_number: string;
  invoice_amount: number;
  completed_date: string;
}

export function TechnicianReports({ technicians }: TechnicianReportsProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [technicianStats, setTechnicianStats] = useState<TechnicianStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (technicians.length > 0 && !selectedTechnician) {
      setSelectedTechnician(technicians[0]);
    }
  }, [technicians, selectedTechnician]);

  useEffect(() => {
    if (selectedTechnician) {
      loadTechnicianStats();
    }
  }, [selectedTechnician, startDate, endDate]);

  async function loadTechnicianStats() {
    if (!selectedTechnician) return;

    setLoading(true);
    try {
      const { data: assignments } = await supabase
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
        .eq('technician_id', selectedTechnician.id)
        .eq('service.work_order.status', 'completed');

      const workOrderIds = [...new Set(assignments?.map(a => a.service?.work_order_id).filter(Boolean) || [])];

      let query = supabase
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

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data: invoices } = await query;

      const invoiceData: InvoiceDetail[] = (invoices || []).map(inv => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        work_order_number: inv.work_order?.order_number || '',
        invoice_amount: inv.total,
        completed_date: inv.work_order?.completed_at || inv.created_at,
      }));

      const totalRevenue = invoiceData.reduce((sum, inv) => sum + inv.invoice_amount, 0);
      const jobsCompleted = invoiceData.length;
      const averageJobValue = jobsCompleted > 0 ? totalRevenue / jobsCompleted : 0;

      const { data: salaries } = await supabase
        .from('salaries')
        .select('total_salary')
        .eq('technician_id', selectedTechnician.id);

      const withdrawals = salaries?.reduce((sum, s) => sum + (s.total_salary || 0), 0) || 0;

      setTechnicianStats({
        technician: selectedTechnician,
        totalRevenue,
        jobsCompleted,
        averageJobValue,
        withdrawals,
        invoices: invoiceData,
      });
    } catch (error) {
      console.error('Error loading technician stats:', error);
      toast.error(t('errors.load_failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('technicians.select_technician')}
            </label>
            <select
              value={selectedTechnician?.id || ''}
              onChange={(e) => {
                const tech = technicians.find(t => t.id === e.target.value);
                setSelectedTechnician(tech || null);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name} - {t(`technicians.specializations.${tech.specialization}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('common.from')}
            </label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('common.to')}
            </label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">{t('common.loading')}</p>
        </div>
      ) : technicianStats ? (
        <>
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3 space-x-reverse">
                <div className="bg-blue-100 rounded-full p-3">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{technicianStats.technician.name}</h3>
                  <p className="text-sm text-gray-600">
                    {t(`technicians.specializations.${technicianStats.technician.specialization}`)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-700 mb-1">{t('technicians.total_revenue')}</p>
                <p className="text-2xl font-bold text-green-600">
                  {displayNumber(technicianStats.totalRevenue)} {t('common.currency')}
                </p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-700 mb-1">{t('technicians.jobs_completed')}</p>
                <p className="text-2xl font-bold text-blue-600">{technicianStats.jobsCompleted}</p>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-700 mb-1">{t('technicians.average_job_value')}</p>
                <p className="text-2xl font-bold text-orange-600">
                  {displayNumber(technicianStats.averageJobValue)} {t('common.currency')}
                </p>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700 mb-1">{t('technicians.withdrawals')}</p>
                <p className="text-2xl font-bold text-red-600">
                  {displayNumber(technicianStats.withdrawals)} {t('common.currency')}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-lg font-bold text-gray-800 mb-4">
                {t('technicians.completed_jobs_list')}
              </h4>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">#</th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                          {t('technicians.invoice_number')}
                        </th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                          {t('technicians.work_order_number')}
                        </th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                          {t('technicians.invoice_amount')}
                        </th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                          {t('technicians.completed_date')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {technicianStats.invoices.map((invoice, index) => (
                        <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-600">{index + 1}</td>
                          <td className="px-6 py-4 text-sm font-medium text-blue-600">
                            {invoice.invoice_number}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {invoice.work_order_number}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-green-600">
                            {displayNumber(invoice.invoice_amount)} {t('common.currency')}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {new Date(invoice.completed_date).toLocaleDateString('ar-SA')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {technicianStats.invoices.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">{t('technicians.no_invoices')}</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
