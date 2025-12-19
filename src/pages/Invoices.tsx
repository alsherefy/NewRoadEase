import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Plus, Eye, Search, CheckCircle, XCircle, Clock, CreditCard, Banknote, Calendar, DollarSign, TrendingUp, Edit, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatToFixed } from '../utils/numberUtils';

interface Invoice {
  id: string;
  invoice_number: string;
  work_order_id: string;
  customer_id: string;
  vehicle_id: string;
  subtotal: number;
  discount_percentage: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  paid_amount: number;
  payment_status: 'paid' | 'partial' | 'unpaid';
  payment_method: 'cash' | 'card';
  card_type?: 'mada' | 'visa';
  notes: string;
  created_at: string;
}

interface Customer {
  name: string;
}

interface InvoicesProps {
  onNewInvoice: () => void;
  onViewInvoice: (id: string) => void;
  onEditInvoice?: (id: string) => void;
}

export function Invoices({ onNewInvoice, onViewInvoice, onEditInvoice }: InvoicesProps) {
  const { t } = useTranslation();
  const { isCustomerServiceOrAdmin } = useAuth();
  const toast = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; invoiceId: string; invoiceNumber: string }>({
    isOpen: false,
    invoiceId: '',
    invoiceNumber: '',
  });

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async (resetPage = false) => {
    try {
      const currentPage = resetPage ? 0 : page;
      const { data: invoiceData, error: invoiceError, count } = await supabase
        .from('invoices')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      if (invoiceError) throw invoiceError;

      if (resetPage) {
        setInvoices(invoiceData || []);
        setPage(0);
      } else {
        setInvoices(prev => currentPage === 0 ? (invoiceData || []) : [...prev, ...(invoiceData || [])]);
      }

      setHasMore((invoiceData?.length || 0) === PAGE_SIZE && ((currentPage + 1) * PAGE_SIZE) < (count || 0));

      const customerIds = [...new Set(invoiceData?.map(inv => inv.customer_id))];
      if (customerIds.length > 0) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('id, name')
          .in('id', customerIds);

        const customerMap: Record<string, Customer> = { ...customers };
        customerData?.forEach(customer => {
          customerMap[customer.id] = { name: customer.name };
        });
        setCustomers(customerMap);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  async function loadMore() {
    setPage(prev => prev + 1);
    await fetchInvoices();
  }

  const handleDeleteClick = (id: string, invoiceNumber: string) => {
    if (!isCustomerServiceOrAdmin()) {
      toast.error(t('invoices.error_delete'));
      return;
    }

    setDeleteConfirm({
      isOpen: true,
      invoiceId: id,
      invoiceNumber: invoiceNumber,
    });
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', deleteConfirm.invoiceId);

      if (itemsError) throw itemsError;

      const { error: invoiceError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', deleteConfirm.invoiceId);

      if (invoiceError) throw invoiceError;

      toast.success(t('invoices.success_deleted'));
      await fetchInvoices(true);
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error(t('invoices.error_delete'));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
            <CheckCircle className="h-3.5 w-3.5" />
            {t('status.paid')}
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
            <Clock className="h-3.5 w-3.5" />
            {t('status.partially_paid')}
          </span>
        );
      case 'unpaid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
            <XCircle className="h-3.5 w-3.5" />
            {t('status.unpaid')}
          </span>
        );
      default:
        return null;
    }
  };

  const getPaymentMethodBadge = (method: 'cash' | 'card', cardType?: 'mada' | 'visa') => {
    if (method === 'cash') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200">
          <Banknote className="h-3.5 w-3.5" />
          {t('common.cash')}
        </span>
      );
    }
    if (method === 'card') {
      const cardLabel = cardType === 'mada' ? t('common.mada') : cardType === 'visa' ? t('common.visa') : t('common.card');
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <CreditCard className="h-3.5 w-3.5" />
          {cardLabel}
        </span>
      );
    }
    return null;
  };

  const filteredInvoices = invoices
    .filter(invoice => {
      const matchesSearch = invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           customers[invoice.customer_id]?.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || invoice.payment_status === filterStatus;
      return matchesSearch && matchesStatus;
    });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayInvoices = invoices.filter(inv => {
    const invDate = new Date(inv.created_at);
    invDate.setHours(0, 0, 0, 0);
    return invDate.getTime() === today.getTime();
  });

  const paidInvoices = invoices.filter(inv => inv.payment_status === 'paid');
  const unpaidInvoices = invoices.filter(inv => inv.payment_status === 'unpaid');
  const partialInvoices = invoices.filter(inv => inv.payment_status === 'partial');

  const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.paid_amount), 0);
  const totalOutstanding = totalRevenue - totalPaid;

  if (loading) {
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
    <div className="space-y-3 sm:space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{t('invoices.title')}</h2>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">{t('invoices.invoice_info')}</p>
        </div>
        <button
          onClick={onNewInvoice}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 sm:px-6 py-3 rounded-lg sm:rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 duration-200 min-h-[44px]"
        >
          <Plus className="h-5 w-5" />
          <span className="font-semibold">{t('invoices.new_invoice')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg sm:rounded-2xl shadow-lg p-4 sm:p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                <Calendar className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">{t('common.today')}</span>
            </div>
            <p className="text-blue-100 text-xs sm:text-sm mb-1 font-medium">{t('invoices.open_invoices')}</p>
            <p className="text-2xl sm:text-3xl font-bold">{todayInvoices.length}</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg sm:rounded-2xl shadow-lg p-4 sm:p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
            </div>
            <p className="text-emerald-100 text-xs sm:text-sm mb-1 font-medium">{t('invoices.paid_invoices')}</p>
            <p className="text-2xl sm:text-3xl font-bold">{paidInvoices.length}</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg sm:rounded-2xl shadow-lg p-4 sm:p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
            </div>
            <p className="text-amber-100 text-xs sm:text-sm mb-1 font-medium">{t('status.partially_paid')}</p>
            <p className="text-2xl sm:text-3xl font-bold">{partialInvoices.length}</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-lg sm:rounded-2xl shadow-lg p-4 sm:p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                <XCircle className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
            </div>
            <p className="text-rose-100 text-xs sm:text-sm mb-1 font-medium">{t('status.unpaid')}</p>
            <p className="text-2xl sm:text-3xl font-bold">{unpaidInvoices.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg sm:rounded-2xl shadow-md p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-3 bg-blue-50 rounded-lg sm:rounded-xl">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">{t('invoices.grand_total')}</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{formatToFixed(totalRevenue)} <span className="text-sm sm:text-base text-gray-500">{t('common.sar')}</span></p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg sm:rounded-2xl shadow-md p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-3 bg-green-50 rounded-lg sm:rounded-xl">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">{t('invoices.amount_paid')}</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{formatToFixed(totalPaid)} <span className="text-sm sm:text-base text-gray-500">{t('common.sar')}</span></p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg sm:rounded-2xl shadow-md p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-3 bg-red-50 rounded-lg sm:rounded-xl">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">{t('invoices.remaining_amount')}</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{formatToFixed(totalOutstanding)} <span className="text-sm sm:text-base text-gray-500">{t('common.sar')}</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg sm:rounded-2xl shadow-md border border-gray-100">
        <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-100">
          <div className="flex flex-col gap-3">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder={t('customers.search_placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 sm:px-4 py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap min-h-[44px] ${
                  filterStatus === 'all'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t('common.all')} ({invoices.length})
              </button>
              <button
                onClick={() => setFilterStatus('paid')}
                className={`px-3 sm:px-4 py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap min-h-[44px] ${
                  filterStatus === 'paid'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t('status.paid')} ({paidInvoices.length})
              </button>
              <button
                onClick={() => setFilterStatus('partial')}
                className={`px-3 sm:px-4 py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap min-h-[44px] ${
                  filterStatus === 'partial'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t('status.partially_paid')} ({partialInvoices.length})
              </button>
              <button
                onClick={() => setFilterStatus('unpaid')}
                className={`px-3 sm:px-4 py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap min-h-[44px] ${
                  filterStatus === 'unpaid'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t('status.unpaid')} ({unpaidInvoices.length})
              </button>
            </div>
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">{t('invoices.no_invoices')}</h3>
            <p className="text-sm sm:text-base text-gray-500 mb-6 px-4">{t('invoices.invoice_info')}</p>
            <button
              onClick={onNewInvoice}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg min-h-[44px]"
            >
              <Plus className="h-5 w-5" />
              {t('invoices.new_invoice')}
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table Layout */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-right py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">{t('invoices.invoice_number')}</th>
                    <th className="text-right py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">{t('customers.name')}</th>
                    <th className="text-right py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">{t('common.date')}</th>
                    <th className="text-right py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">{t('invoices.grand_total')}</th>
                    <th className="text-right py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">{t('invoices.amount_paid')}</th>
                    <th className="text-right py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">{t('common.payment_method')}</th>
                    <th className="text-right py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">{t('status.status')}</th>
                    <th className="text-center py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="py-4 px-6">
                        <span className="font-semibold text-gray-900">{invoice.invoice_number}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-gray-700">{customers[invoice.customer_id]?.name || t('common.not_specified')}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-gray-600">
                          {new Date(invoice.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-semibold text-gray-900">{formatToFixed(Number(invoice.total))} {t('common.sar')}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-gray-700">{formatToFixed(Number(invoice.paid_amount))} {t('common.sar')}</span>
                      </td>
                      <td className="py-4 px-6">
                        {getPaymentMethodBadge(invoice.payment_method, invoice.card_type)}
                      </td>
                      <td className="py-4 px-6">{getStatusBadge(invoice.payment_status)}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 justify-center">
                          <button
                            onClick={() => onViewInvoice(invoice.id)}
                            className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-2 rounded-lg transition-all"
                            title={t('common.view')}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {isCustomerServiceOrAdmin() && onEditInvoice && (
                            <button
                              onClick={() => onEditInvoice(invoice.id)}
                              className="inline-flex items-center gap-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 px-3 py-2 rounded-lg transition-all"
                              title={t('common.edit')}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                          {isCustomerServiceOrAdmin() && (
                            <button
                              onClick={() => handleDeleteClick(invoice.id, invoice.invoice_number)}
                              className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-2 rounded-lg transition-all"
                              title={t('common.delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout */}
            <div className="lg:hidden p-3 space-y-3">
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-white font-bold text-lg mb-1">{invoice.invoice_number}</p>
                        <p className="text-blue-100 text-sm">{customers[invoice.customer_id]?.name || t('common.not_specified')}</p>
                      </div>
                      {getStatusBadge(invoice.payment_status)}
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse text-white text-sm">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(invoice.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">{t('invoices.grand_total')}</p>
                        <p className="font-bold text-gray-900">{formatToFixed(Number(invoice.total))} {t('common.sar')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">{t('invoices.amount_paid')}</p>
                        <p className="font-bold text-gray-900">{formatToFixed(Number(invoice.paid_amount))} {t('common.sar')}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <div>{getPaymentMethodBadge(invoice.payment_method, invoice.card_type)}</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onViewInvoice(invoice.id)}
                          className="flex items-center justify-center bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors min-h-[44px] min-w-[44px]"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        {isCustomerServiceOrAdmin() && onEditInvoice && (
                          <button
                            onClick={() => onEditInvoice(invoice.id)}
                            className="flex items-center justify-center bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors min-h-[44px] min-w-[44px]"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                        )}
                        {isCustomerServiceOrAdmin() && (
                          <button
                            onClick={() => handleDeleteClick(invoice.id, invoice.invoice_number)}
                            className="flex items-center justify-center bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors min-h-[44px] min-w-[44px]"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {hasMore && filteredInvoices.length > 0 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={loadMore}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md font-medium min-h-[44px]"
          >
            {t('common.load_more')}
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={t('invoices.confirm_delete')}
        message={`${t('invoices.confirm_delete')} ${deleteConfirm.invoiceNumber}؟`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm({ isOpen: false, invoiceId: '', invoiceNumber: '' })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isDangerous={true}
      />
    </div>
  );
}
