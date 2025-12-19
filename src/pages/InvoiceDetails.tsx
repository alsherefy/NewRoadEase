import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Printer, CheckCircle, XCircle, Clock, Edit, CreditCard, Banknote } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { formatToFixed, toEnglishDigits, normalizeNumberInput } from '../utils/numberUtils';

interface InvoiceDetailsProps {
  invoiceId: string;
  onBack: () => void;
}

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
  tax_type: 'inclusive' | 'exclusive';
  tax_amount: number;
  total: number;
  paid_amount: number;
  payment_status: 'paid' | 'partial' | 'unpaid';
  payment_method: string;
  card_type?: 'mada' | 'visa';
  notes: string;
  created_at: string;
}

interface InvoiceItem {
  id: string;
  item_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Customer {
  name: string;
  phone: string;
  email: string;
}

interface Vehicle {
  car_make: string;
  car_model: string;
  car_year: number;
  plate_number: string;
}

interface WorkshopSettings {
  name: string;
  phone: string;
  address: string;
  email: string;
  tax_number: string;
  commercial_registration: string;
  tax_enabled: boolean;
}

export function InvoiceDetails({ invoiceId, onBack }: InvoiceDetailsProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [workshop, setWorkshop] = useState<WorkshopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPayment, setEditingPayment] = useState(false);
  const [newPaidAmount, setNewPaidAmount] = useState(0);
  const [newPaymentMethod, setNewPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [newCardType, setNewCardType] = useState<'mada' | 'visa'>('mada');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInvoiceDetails();
    fetchWorkshopSettings();
  }, [invoiceId]);

  const fetchInvoiceDetails = async () => {
    try {
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (invoiceError) throw invoiceError;
      setInvoice(invoiceData);
      setNewPaidAmount(Number(invoiceData.paid_amount));

      const { data: itemsData } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId);

      setItems(itemsData || []);

      const { data: customerData } = await supabase
        .from('customers')
        .select('name, phone, email')
        .eq('id', invoiceData.customer_id)
        .single();

      setCustomer(customerData);

      if (invoiceData.vehicle_id) {
        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('car_make, car_model, car_year, plate_number')
          .eq('id', invoiceData.vehicle_id)
          .single();

        setVehicle(vehicleData);
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkshopSettings = async () => {
    const { data } = await supabase
      .from('workshop_settings')
      .select('*')
      .maybeSingle();

    setWorkshop(data);
  };

  const handlePrint = () => {
    window.print();
  };

  const updatePayment = async () => {
    if (!invoice) return;

    const total = Number(invoice.total);
    let paymentStatus: 'paid' | 'partial' | 'unpaid' = 'unpaid';

    if (newPaidAmount >= total) {
      paymentStatus = 'paid';
    } else if (newPaidAmount > 0) {
      paymentStatus = 'partial';
    }

    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          paid_amount: newPaidAmount,
          payment_status: paymentStatus,
          payment_method: newPaymentMethod,
          card_type: newPaymentMethod === 'card' ? newCardType : null
        })
        .eq('id', invoiceId);

      if (error) throw error;

      toast.success(t('invoices.success_updated'));
      setEditingPayment(false);
      fetchInvoiceDetails();
    } catch (error) {
      console.error('Error updating payment:', error);
      toast.error(t('invoices.error_update'));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-300 print:border-emerald-400">
            <CheckCircle className="h-3.5 w-3.5" />
            {t('status.paid')}
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-300 print:border-amber-400">
            <Clock className="h-3.5 w-3.5" />
            {t('status.partially_paid')}
          </span>
        );
      case 'unpaid':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-300 print:border-rose-400">
            <XCircle className="h-3.5 w-3.5" />
            {t('status.unpaid')}
          </span>
        );
      default:
        return null;
    }
  };

  const getPaymentMethodLabel = (method: string, cardType?: string) => {
    if (method === 'cash') {
      return (
        <span className="inline-flex items-center gap-1 text-gray-700">
          <Banknote className="h-4 w-4" />
          {t('common.cash')}
        </span>
      );
    }
    if (method === 'card') {
      const label = cardType === 'mada' ? t('common.mada') : cardType === 'visa' ? t('common.visa') : t('common.card');
      return (
        <span className="inline-flex items-center gap-1 text-gray-700">
          <CreditCard className="h-4 w-4" />
          {label}
        </span>
      );
    }
    return method;
  };

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

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-xl text-gray-600">{t('invoices.no_invoices')}</p>
        <button
          onClick={onBack}
          className="mt-4 text-blue-600 hover:text-blue-800 font-medium"
        >
          {t('common.back')}
        </button>
      </div>
    );
  }

  const isTaxInvoice = Number(invoice.tax_rate) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowRight className="h-5 w-5" />
            <span className="font-medium">{t('common.back')}</span>
          </button>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{t('invoices.invoice_details')}</h2>
            <p className="text-gray-500 mt-1">{isTaxInvoice ? t('invoices.tax_invoice') : t('invoices.invoice')}</p>
          </div>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
        >
          <Printer className="h-5 w-5" />
          <span className="font-semibold">{t('common.print')}</span>
        </button>
      </div>

      <div ref={printRef} className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 print:shadow-none print:border print:rounded-none" dir="rtl">
        <div className="p-8 print:p-6">
          <div className={`border-b-4 pb-6 mb-6 print:pb-4 print:mb-4 ${isTaxInvoice ? 'border-blue-600' : 'border-gray-300'}`}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 mb-2 print:text-xl">{workshop?.name || t('settings.workshop_name')}</h1>
                {workshop?.address && <p className="text-sm text-gray-600 mb-1">{workshop.address}</p>}
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  {workshop?.phone && <p>{t('customers.phone')}: <span className="font-medium">{workshop.phone}</span></p>}
                  {workshop?.email && <p>{t('customers.email')}: <span className="font-medium">{workshop.email}</span></p>}
                </div>
                {isTaxInvoice && (
                  <div className="mt-3 space-y-1 text-sm">
                    {workshop?.tax_number && (
                      <p className="text-blue-700 font-semibold">{t('settings.tax_number')}: {workshop.tax_number}</p>
                    )}
                    {workshop?.commercial_registration && (
                      <p className="text-gray-600">{t('settings.commercial_registration')}: <span className="font-medium">{workshop.commercial_registration}</span></p>
                    )}
                  </div>
                )}
              </div>

              <div className="text-left">
                <div className="space-y-2 text-sm">
                  <p className="text-gray-600">{t('invoices.invoice_number')}</p>
                  <p className="text-2xl font-bold text-gray-900 print:text-xl">{invoice.invoice_number}</p>
                  <p className="text-xs text-gray-500 mt-3">
                    {t('common.date')}: {new Date(invoice.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                  <div className="mt-2">{getStatusBadge(invoice.payment_status)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6 print:gap-4 print:mb-4">
            <div className="bg-gray-50 p-4 rounded-xl print:p-3">
              <h3 className="text-sm font-bold text-gray-900 mb-3 print:mb-2">{t('customers.title')}</h3>
              {customer && (
                <div className="space-y-1.5 text-sm">
                  <p className="font-bold text-gray-900">{customer.name}</p>
                  <p className="text-gray-700">{t('customers.phone')}: <span className="font-medium">{customer.phone}</span></p>
                  {customer.email && <p className="text-gray-700">{t('customers.email')}: <span className="font-medium">{customer.email}</span></p>}
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded-xl print:p-3">
              <h3 className="text-sm font-bold text-gray-900 mb-3 print:mb-2">{t('vehicles.vehicle_info')}</h3>
              {vehicle ? (
                <div className="space-y-1.5 text-sm">
                  <p className="font-bold text-gray-900">{vehicle.car_make} {vehicle.car_model}</p>
                  <p className="text-gray-700">{t('vehicles.year')}: <span className="font-medium">{vehicle.car_year}</span></p>
                  <p className="text-gray-700">{t('vehicles.plate_number')}: <span className="font-medium">{vehicle.plate_number}</span></p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">{t('customers.no_vehicles')}</p>
              )}
            </div>
          </div>

          <div className="mb-6 print:mb-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3 print:mb-2 print:text-base">{t('invoices.invoice_details')}</h3>
            <div className="overflow-hidden border border-gray-200 rounded-xl">
              <table className="w-full">
                <thead>
                  <tr className={`text-white text-sm ${isTaxInvoice ? 'bg-blue-600' : 'bg-gray-700'}`}>
                    <th className="text-right py-3 px-4 font-bold print:py-2">{t('services.description')}</th>
                    <th className="text-center py-3 px-4 font-bold print:py-2">{t('common.type')}</th>
                    <th className="text-center py-3 px-4 font-bold print:py-2">{t('invoices.quantity')}</th>
                    <th className="text-center py-3 px-4 font-bold print:py-2">{t('invoices.price')}</th>
                    <th className="text-left py-3 px-4 font-bold print:py-2">{t('common.total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item, index) => (
                    <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="py-3 px-4 text-gray-900 font-medium text-sm print:py-2">{item.description}</td>
                      <td className="text-center py-3 px-4 text-gray-700 text-sm print:py-2">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          item.item_type === 'service'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {item.item_type === 'service' ? t('services.service_type') : t('work_orders.spare_parts')}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4 text-gray-700 text-sm print:py-2">{formatToFixed(Number(item.quantity))}</td>
                      <td className="text-center py-3 px-4 text-gray-700 text-sm print:py-2">{formatToFixed(Number(item.unit_price))}</td>
                      <td className="text-left py-3 px-4 text-gray-900 font-semibold text-sm print:py-2">
                        {formatToFixed(Number(item.total))} {t('common.sar')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end mb-6 print:mb-4">
            <div className="w-96 space-y-2 print:w-80">
              <div className="flex justify-between items-center py-2 px-4 bg-gray-100 rounded-lg">
                <span className="text-sm font-semibold text-gray-700">{t('invoices.subtotal')}:</span>
                <span className="font-bold text-gray-900">
                  {formatToFixed(Number(invoice.subtotal) + Number(invoice.discount_amount))} {t('common.sar')}
                </span>
              </div>

              {Number(invoice.discount_percentage) > 0 && (
                <div className="flex justify-between items-center py-2 px-4 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-sm font-semibold text-red-700">{t('invoices.discount')} ({toEnglishDigits(Number(invoice.discount_percentage))}%):</span>
                  <span className="font-bold text-red-700">- {formatToFixed(Number(invoice.discount_amount))} {t('common.sar')}</span>
                </div>
              )}

              {isTaxInvoice && (
                <>
                  {invoice.tax_type === 'inclusive' ? (
                    <div className="space-y-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-center gap-2 mb-2 pb-2 border-b border-blue-200">
                        <span className="text-xs font-bold text-blue-900 uppercase">{t('invoices.tax_inclusive')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-blue-700">{t('invoices.grand_total')}:</span>
                        <span className="font-semibold text-blue-900">{formatToFixed(Number(invoice.total))} {t('common.sar')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-blue-700">{t('invoices.subtotal')}:</span>
                        <span className="font-semibold text-blue-900">{formatToFixed(Number(invoice.subtotal))} {t('common.sar')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-blue-700">{t('invoices.tax')} ({toEnglishDigits(Number(invoice.tax_rate))}%):</span>
                        <span className="font-semibold text-blue-900">{formatToFixed(Number(invoice.tax_amount))} {t('common.sar')}</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      {Number(invoice.discount_percentage) > 0 && (
                        <div className="flex justify-between items-center py-2 px-4 bg-gray-100 rounded-lg">
                          <span className="text-sm font-semibold text-gray-700">{t('invoices.subtotal')}:</span>
                          <span className="font-bold text-gray-900">{formatToFixed(Number(invoice.subtotal))} {t('common.sar')}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-2 px-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <span className="text-sm font-semibold text-blue-700">{t('invoices.tax')} ({toEnglishDigits(Number(invoice.tax_rate))}%):</span>
                        <span className="font-bold text-blue-700">{formatToFixed(Number(invoice.tax_amount))} {t('common.sar')}</span>
                      </div>
                    </>
                  )}
                </>
              )}

              <div className={`flex justify-between items-center py-4 px-4 rounded-xl ${
                isTaxInvoice ? 'bg-gradient-to-r from-blue-600 to-blue-700' : 'bg-gradient-to-r from-gray-700 to-gray-800'
              } text-white print:py-3`}>
                <span className="text-lg font-bold print:text-base">{t('invoices.grand_total')}:</span>
                <span className="text-2xl font-bold print:text-xl">{formatToFixed(Number(invoice.total))} {t('common.sar')}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="py-2 px-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs text-green-700 font-medium mb-1">{t('invoices.amount_paid')}</p>
                  <p className="text-lg font-bold text-green-900 print:text-base">{formatToFixed(Number(invoice.paid_amount))} {t('common.sar')}</p>
                </div>
                <div className={`py-2 px-4 rounded-lg border ${
                  Number(invoice.total) - Number(invoice.paid_amount) > 0
                    ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <p className={`text-xs font-medium mb-1 ${
                    Number(invoice.total) - Number(invoice.paid_amount) > 0
                      ? 'text-red-700'
                      : 'text-gray-700'
                  }`}>{t('invoices.remaining_amount')}</p>
                  <p className={`text-lg font-bold print:text-base ${
                    Number(invoice.total) - Number(invoice.paid_amount) > 0
                      ? 'text-red-900'
                      : 'text-gray-900'
                  }`}>
                    {formatToFixed(Number(invoice.total) - Number(invoice.paid_amount))} {t('common.sar')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t-2 border-gray-200 pt-4 mb-4 print:pt-3 print:mb-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-2">{t('common.payment_method')}</h3>
                <div className="text-sm font-medium">{getPaymentMethodLabel(invoice.payment_method, invoice.card_type)}</div>
              </div>
              {invoice.notes && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2">{t('common.notes')}</h3>
                  <p className="text-sm text-gray-700">{invoice.notes}</p>
                </div>
              )}
            </div>
          </div>

          {isTaxInvoice && (
            <div className="border-t-2 border-blue-200 pt-4 mb-4 print:pt-3 print:mb-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-900 font-semibold text-center">
                  {t('invoices.tax_invoice_disclaimer')}
                </p>
              </div>
            </div>
          )}

          <div className="text-center border-t-2 border-gray-200 pt-4 print:pt-3">
            <p className="text-gray-600 font-medium mb-2 print:text-sm">{t('invoices.thank_you')}</p>
            <p className="text-xs text-gray-400">
              {t('common.date')}: {new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })} • {user?.full_name || t('common.user')}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100 no-print">
        <h3 className="text-xl font-bold text-gray-900 mb-4">{t('invoices.payment_management')}</h3>

        {editingPayment ? (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                {t('common.payment_method')}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNewPaymentMethod('cash')}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all ${
                    newPaymentMethod === 'cash'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <Banknote className="h-5 w-5" />
                  <span className="font-semibold">{t('common.cash')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewPaymentMethod('card')}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all ${
                    newPaymentMethod === 'card'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <CreditCard className="h-5 w-5" />
                  <span className="font-semibold">{t('common.card')}</span>
                </button>
              </div>
            </div>

            {newPaymentMethod === 'card' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  {t('common.card_type')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewCardType('mada')}
                    className={`py-3 px-4 rounded-xl border-2 transition-all font-semibold ${
                      newCardType === 'mada'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    {t('common.mada')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCardType('visa')}
                    className={`py-3 px-4 rounded-xl border-2 transition-all font-semibold ${
                      newCardType === 'visa'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    {t('common.visa')}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('invoices.amount_paid')}
              </label>
              <input
                type="text"
                value={newPaidAmount}
                onChange={(e) => setNewPaidAmount(Number(normalizeNumberInput(e.target.value)))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-lg font-semibold"
              />
              <p className="text-sm text-gray-500 mt-2">
                {t('invoices.grand_total')}: {formatToFixed(Number(invoice.total))} {t('common.sar')}
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={updatePayment}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all font-semibold shadow-lg"
              >
                {t('common.save')}
              </button>
              <button
                onClick={() => {
                  setEditingPayment(false);
                  setNewPaidAmount(Number(invoice.paid_amount));
                  setNewPaymentMethod(invoice.payment_method || 'cash');
                  setNewCardType(invoice.card_type || 'mada');
                }}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setEditingPayment(true);
              setNewPaidAmount(Number(invoice.paid_amount));
              setNewPaymentMethod(invoice.payment_method || 'cash');
              setNewCardType(invoice.card_type || 'mada');
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg font-semibold"
          >
            <Edit className="h-5 w-5" />
            {t('invoices.update_payment_status')}
          </button>
        )}
      </div>

      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .no-print, .no-print * {
              display: none !important;
            }
            #root, #root * {
              visibility: visible;
            }
            @page {
              size: A4;
              margin: 0.5cm;
            }
            body {
              background: white;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }

            /* تقليل المسافات للطباعة */
            .space-y-6 {
              gap: 0.5rem !important;
            }

            /* منع تقسيم العناصر عبر الصفحات */
            table, .bg-white {
              page-break-inside: avoid !important;
            }

            /* تقليل حجم الخطوط */
            h1 {
              font-size: 1.25rem !important;
            }
            h2 {
              font-size: 1.1rem !important;
            }
            h3 {
              font-size: 0.9rem !important;
            }
            p, td, th, span {
              font-size: 0.75rem !important;
              line-height: 1.3 !important;
            }

            /* تقليل المساحات الداخلية */
            .p-8 {
              padding: 1rem !important;
            }
            .p-6 {
              padding: 0.75rem !important;
            }
            .p-4 {
              padding: 0.5rem !important;
            }
            .p-3 {
              padding: 0.4rem !important;
            }
            .py-4 {
              padding-top: 0.5rem !important;
              padding-bottom: 0.5rem !important;
            }
            .py-3 {
              padding-top: 0.4rem !important;
              padding-bottom: 0.4rem !important;
            }
            .py-2 {
              padding-top: 0.3rem !important;
              padding-bottom: 0.3rem !important;
            }
            .px-4 {
              padding-left: 0.5rem !important;
              padding-right: 0.5rem !important;
            }
            .px-6 {
              padding-left: 0.75rem !important;
              padding-right: 0.75rem !important;
            }

            /* تقليل المسافات بين الأقسام */
            .mb-6 {
              margin-bottom: 0.5rem !important;
            }
            .mb-4 {
              margin-bottom: 0.4rem !important;
            }
            .mb-3 {
              margin-bottom: 0.3rem !important;
            }
            .mb-2 {
              margin-bottom: 0.2rem !important;
            }
            .mt-4 {
              margin-top: 0.4rem !important;
            }
            .mt-3 {
              margin-top: 0.3rem !important;
            }
            .mt-2 {
              margin-top: 0.2rem !important;
            }

            /* تقليل الفجوات */
            .gap-6 {
              gap: 0.5rem !important;
            }
            .gap-4 {
              gap: 0.4rem !important;
            }
            .gap-3 {
              gap: 0.3rem !important;
            }
            .gap-2 {
              gap: 0.2rem !important;
            }

            /* ضبط الجدول */
            table {
              font-size: 0.7rem !important;
            }
            table th {
              padding: 0.3rem 0.5rem !important;
            }
            table td {
              padding: 0.3rem 0.5rem !important;
            }

            /* ضبط الحدود */
            .border-b-4 {
              border-bottom-width: 2px !important;
            }
            .border-t-2 {
              border-top-width: 1px !important;
            }

            /* ضبط عرض العناصر */
            .w-96 {
              width: 20rem !important;
            }

            /* إخفاء العناصر غير الضرورية عند الطباعة */
            .rounded-2xl {
              border-radius: 0.5rem !important;
            }
            .rounded-xl {
              border-radius: 0.4rem !important;
            }

            /* ضبط الأيقونات */
            svg {
              width: 0.75rem !important;
              height: 0.75rem !important;
            }
          }
        `}
      </style>
    </div>
  );
}
