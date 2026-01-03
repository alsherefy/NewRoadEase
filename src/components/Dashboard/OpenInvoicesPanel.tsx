import { FileText, AlertCircle, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFormatNumber } from '../../hooks/useFormatNumber';

interface Invoice {
  id: string;
  invoice_number: string;
  payment_status: string;
  total: number;
  paid_amount: number;
  created_at: string;
  customers: {
    id: string;
    name: string;
    phone: string;
  };
  vehicles: {
    id: string;
    car_make: string;
    car_model: string;
    plate_number: string;
  };
}

interface OpenInvoicesPanelProps {
  data: {
    unpaid: Invoice[];
    overdue: Invoice[];
    totalAmount: number;
    totalCount: number;
  };
  showAmounts?: boolean;
  onViewInvoice?: (invoiceId: string) => void;
  onViewAll?: () => void;
}

export default function OpenInvoicesPanel({ data, showAmounts = true, onViewInvoice, onViewAll }: OpenInvoicesPanelProps) {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatNumber();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unpaid':
        return 'bg-red-100 text-red-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'unpaid':
        return t('invoices.unpaid');
      case 'partial':
        return t('invoices.partial');
      default:
        return status;
    }
  };

  const isOverdue = (createdAt: string) => {
    const daysOld = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysOld > 7;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900">
            {t('dashboard.openInvoices')}
          </h3>
        </div>
        {showAmounts && (
          <div className="text-right">
            <p className="text-sm text-gray-600">{t('dashboard.totalDue')}</p>
            <p className="text-lg font-bold text-red-600">
              {formatCurrency(data.totalAmount)}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {data.unpaid.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            {t('dashboard.noOpenInvoices')}
          </p>
        ) : (
          <>
            {data.unpaid.slice(0, 5).map((invoice) => (
              <div
                key={invoice.id}
                onClick={() => onViewInvoice?.(invoice.id)}
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all duration-200 cursor-pointer hover:bg-blue-50"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">
                        {invoice.invoice_number}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          invoice.payment_status
                        )}`}
                      >
                        {getStatusLabel(invoice.payment_status)}
                      </span>
                      {isOverdue(invoice.created_at) && (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {invoice.customers.name}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
                {showAmounts && (
                  <p className="text-sm font-medium text-gray-900 mt-2">
                    {t('dashboard.due')}:{' '}
                    {formatCurrency(invoice.total - invoice.paid_amount)}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(invoice.created_at).toLocaleDateString('ar')}
                </p>
              </div>
            ))}
          </>
        )}
      </div>

      {data.totalCount > 5 && (
        <button
          onClick={onViewAll}
          className="w-full mt-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {t('dashboard.viewAll')}
        </button>
      )}
    </div>
  );
}
