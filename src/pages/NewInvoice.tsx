import { useState, useEffect } from 'react';
import { ArrowRight, Plus, Trash2, Save, Receipt, Percent, CreditCard, Banknote } from 'lucide-react';
import { customersService, vehiclesService, workOrdersService, settingsService, invoicesService, ServiceError } from '../services';
import { apiClient } from '../services/apiClient';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import { normalizeNumberInput, formatToFixed, toEnglishDigits } from '../utils/numberUtils';

interface NewInvoiceProps {
  invoiceId?: string;
  onBack: () => void;
  onSuccess: () => void;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface Vehicle {
  id: string;
  customer_id: string;
  car_make: string;
  car_model: string;
  car_year: number;
  plate_number: string;
}

interface WorkOrder {
  id: string;
  order_number: string;
  customer_id: string;
  vehicle_id: string;
  description: string;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface SparePart {
  id: string;
  name: string;
  part_number: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export function NewInvoice({ invoiceId, onBack, onSuccess }: NewInvoiceProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxType, setTaxType] = useState<'inclusive' | 'exclusive'>('exclusive');
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [cardType, setCardType] = useState<'mada' | 'visa'>('mada');
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, unit_price: 0, total: 0 }
  ]);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCustomers();
    fetchWorkOrders();
    fetchWorkshopSettings();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchVehicles(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  useEffect(() => {
    if (selectedWorkOrderId) {
      const workOrder = workOrders.find(wo => wo.id === selectedWorkOrderId);
      if (workOrder) {
        setSelectedCustomerId(workOrder.customer_id);
        setSelectedVehicleId(workOrder.vehicle_id);
      }
    }
  }, [selectedWorkOrderId, workOrders]);

  useEffect(() => {
    if (invoiceId) {
      loadInvoice();
    }
  }, [invoiceId]);

  const fetchCustomers = async () => {
    try {
      const data = await customersService.getAllCustomers({ orderBy: 'name', orderDirection: 'asc' });
      setCustomers(data as Customer[]);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchVehicles = async (customerId: string) => {
    try {
      const data = await vehiclesService.getVehiclesByCustomer(customerId);
      setVehicles(data as Vehicle[]);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  const fetchWorkOrders = async () => {
    try {
      const data = await workOrdersService.getAllWorkOrders();
      setWorkOrders(data as WorkOrder[]);
    } catch (error) {
      console.error('Error fetching work orders:', error);
    }
  };

  const fetchWorkshopSettings = async () => {
    try {
      const data = await settingsService.getWorkshopSettings();

      if (data) {
        const isTaxEnabled = data.tax_enabled === true;
        setTaxEnabled(isTaxEnabled);

        if (isTaxEnabled) {
          setTaxRate(Number(data.tax_rate) || 15);
        } else {
          setTaxRate(0);
        }
        setTaxType(data.tax_type || 'exclusive');
      } else {
        setTaxEnabled(false);
        setTaxRate(0);
        setTaxType('exclusive');
      }
    } catch (error) {
      console.error('Error fetching workshop settings:', error);
      setTaxEnabled(false);
      setTaxRate(0);
      setTaxType('exclusive');
    }
  };

  const loadInvoice = async () => {
    if (!invoiceId) return;

    try {
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

      setSelectedCustomerId(invoice.customer_id);
      setSelectedVehicleId(invoice.vehicle_id || '');
      setSelectedWorkOrderId(invoice.work_order_id || '');
      setDiscountPercentage(invoice.discount_percentage || 0);
      setPaymentMethod(invoice.payment_method);
      setCardType(invoice.card_type || 'mada');
      setPaidAmount(invoice.paid_amount || 0);
      setNotes(invoice.notes || '');

      const invoiceTaxRate = Number(invoice.tax_rate) || 0;
      const invoiceTaxEnabled = invoiceTaxRate > 0;
      setTaxEnabled(invoiceTaxEnabled);
      setTaxRate(invoiceTaxRate);
      setTaxType(invoice.tax_type || 'exclusive');

      if (invoice.customer_id) {
        await fetchVehicles(invoice.customer_id);
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId);

      if (itemsError) throw itemsError;

      if (itemsData && itemsData.length > 0) {
        setItems(itemsData.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
        })));
      }

      if (invoice.work_order_id) {
        const { data: sparePartsData } = await supabase
          .from('work_order_spare_parts')
          .select(`
            id,
            quantity,
            unit_price,
            total,
            spare_part_id,
            spare_parts (
              name,
              part_number
            )
          `)
          .eq('work_order_id', invoice.work_order_id);

        if (sparePartsData && sparePartsData.length > 0) {
          const formattedSpareParts = sparePartsData.map((item: any) => ({
            id: item.id,
            name: item.spare_parts?.name || '',
            part_number: item.spare_parts?.part_number || '',
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            total: Number(item.total)
          }));
          setSpareParts(formattedSpareParts);
        }
      }
    } catch (error) {
      console.error('Error loading invoice:', error);
      toast.error(t('invoices.error_update'));
    }
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total = newItems[index].quantity * newItems[index].unit_price;
    }

    setItems(newItems);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  const calculateDiscount = () => {
    const subtotal = calculateSubtotal();
    return (subtotal * discountPercentage) / 100;
  };

  const calculateSubtotalAfterDiscount = () => {
    return calculateSubtotal() - calculateDiscount();
  };

  const calculateTax = () => {
    if (!taxEnabled) {
      return 0;
    }
    const subtotalAfterDiscount = calculateSubtotalAfterDiscount();
    const calculatedTax = taxType === 'inclusive'
      ? (subtotalAfterDiscount * taxRate) / (100 + taxRate)
      : (subtotalAfterDiscount * taxRate) / 100;

    return calculatedTax;
  };

  const calculateTotal = () => {
    if (!taxEnabled) {
      return calculateSubtotalAfterDiscount();
    }
    if (taxType === 'inclusive') {
      return calculateSubtotalAfterDiscount();
    }
    return calculateSubtotalAfterDiscount() + calculateTax();
  };

  const calculateBaseAmount = () => {
    if (!taxEnabled) {
      return calculateSubtotalAfterDiscount();
    }
    if (taxType === 'inclusive') {
      return calculateSubtotalAfterDiscount() - calculateTax();
    }
    return calculateSubtotalAfterDiscount();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomerId) {
      toast.warning(t('validation.fill_all_required'));
      return;
    }

    if (items.some(item => !item.description || item.unit_price <= 0)) {
      toast.warning(t('validation.fill_all_required'));
      return;
    }

    setLoading(true);

    try {
      const baseAmount = calculateBaseAmount();
      const discountAmount = calculateDiscount();
      const taxAmount = taxEnabled ? calculateTax() : 0;
      const total = calculateTotal();

      let paymentStatus: 'paid' | 'partial' | 'unpaid' = 'unpaid';
      if (paidAmount >= total) {
        paymentStatus = 'paid';
      } else if (paidAmount > 0) {
        paymentStatus = 'partial';
      }

      if (invoiceId) {
        const invoiceData = {
          work_order_id: selectedWorkOrderId || null,
          customer_id: selectedCustomerId,
          vehicle_id: selectedVehicleId || null,
          subtotal: baseAmount,
          discount_percentage: discountPercentage,
          discount_amount: discountAmount,
          tax_rate: taxEnabled ? Number(taxRate) : 0,
          tax_type: taxEnabled ? taxType : 'exclusive',
          tax_amount: taxEnabled ? Number(taxAmount) : 0,
          total,
          paid_amount: paidAmount,
          payment_status: paymentStatus,
          payment_method: paymentMethod,
          card_type: paymentMethod === 'card' ? cardType : null,
          notes,
          items: items.map(item => ({
            item_type: 'service',
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total
          }))
        };

        await invoicesService.updateInvoice(invoiceId, invoiceData);
        toast.success(t('invoices.success_updated'));
      } else {
        const invoiceData = {
          work_order_id: selectedWorkOrderId || null,
          customer_id: selectedCustomerId,
          vehicle_id: selectedVehicleId || null,
          subtotal: baseAmount,
          discount_percentage: discountPercentage,
          discount_amount: discountAmount,
          tax_rate: taxEnabled ? Number(taxRate) : 0,
          tax_type: taxEnabled ? taxType : 'exclusive',
          tax_amount: taxEnabled ? Number(taxAmount) : 0,
          total,
          paid_amount: paidAmount,
          payment_status: paymentStatus,
          payment_method: paymentMethod,
          card_type: paymentMethod === 'card' ? cardType : null,
          notes,
          items: items.map(item => ({
            item_type: 'service',
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total
          }))
        };

        await invoicesService.createInvoice(invoiceData);
        toast.success(t('invoices.success_created'));
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error(t('invoices.error_create'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowRight className="h-5 w-5" />
          <span className="font-medium">{t('common.back')}</span>
        </button>
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            {invoiceId ? t('invoices.edit_invoice') : t('invoices.new_invoice')}
          </h2>
          <p className="text-gray-500 mt-1">
            {invoiceId ? t('invoices.edit_invoice_desc') : t('invoices.new_invoice_desc')}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Receipt className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">{t('invoices.invoice_info')}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('work_orders.title')} <span className="text-gray-400 font-normal">({t('common.optional')})</span>
              </label>
              <select
                value={selectedWorkOrderId}
                onChange={(e) => setSelectedWorkOrderId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">{t('work_orders.no_work_order')}</option>
                {workOrders.map(wo => (
                  <option key={wo.id} value={wo.id}>
                    {wo.order_number} - {wo.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('customers.title')} <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                required
                disabled={!!selectedWorkOrderId}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">{t('work_orders.select_customer')}</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} - {customer.phone}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('vehicles.title')} <span className="text-gray-400 font-normal">({t('common.optional')})</span>
              </label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                disabled={!!selectedWorkOrderId || !selectedCustomerId}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">{t('work_orders.select_vehicle')}</option>
                {vehicles.map(vehicle => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.car_make} {vehicle.car_model} {vehicle.car_year} - {vehicle.plate_number}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-gray-400" />
                  {t('invoices.discount_percentage')} (%)
                </div>
              </label>
              <input
                type="text"
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(Number(normalizeNumberInput(e.target.value)))}
                placeholder="0"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {taxEnabled && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-900">{t('invoices.tax_enabled')}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-blue-700">{t('invoices.tax_rate')}: <span className="font-bold">{toEnglishDigits(taxRate)}%</span></span>
                  <span className="text-sm text-blue-700">{t('invoices.tax_type')}: <span className="font-bold">{taxType === 'inclusive' ? t('invoices.tax_inclusive') : t('invoices.tax_exclusive')}</span></span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">{t('invoices.items')}</h3>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
            >
              <Plus className="h-4 w-4" />
              {t('invoices.add_item')}
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border-2 border-gray-100 rounded-xl hover:border-gray-200 transition-all">
                <div className="md:col-span-5">
                  <label className="block text-xs font-semibold text-gray-600 mb-2">{t('services.description')}</label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    placeholder={t('invoices.item_description_placeholder')}
                    required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-2">{t('invoices.quantity')}</label>
                  <input
                    type="text"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', Number(normalizeNumberInput(e.target.value)))}
                    required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-2">{t('invoices.price')}</label>
                  <input
                    type="text"
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, 'unit_price', Number(normalizeNumberInput(e.target.value)))}
                    required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                <div className="md:col-span-2 flex items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600 mb-2">{t('common.total')}</label>
                    <input
                      type="text"
                      value={formatToFixed(item.total)}
                      readOnly
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 font-semibold text-gray-700"
                    />
                  </div>
                </div>

                <div className="md:col-span-1 flex items-end justify-center">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-all border border-red-200 hover:border-red-300"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t-2 border-gray-100 pt-6">
            <div className="max-w-md mr-auto space-y-3">
              <div className="flex justify-between items-center py-2 px-4 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700">{t('invoices.subtotal')}:</span>
                <span className="font-bold text-gray-900 text-lg">{formatToFixed(calculateSubtotal())} {t('common.currency')}</span>
              </div>

              {discountPercentage > 0 && (
                <div className="flex justify-between items-center py-2 px-4 bg-red-50 rounded-lg border border-red-100">
                  <span className="font-medium text-red-700">{t('invoices.discount')} ({toEnglishDigits(discountPercentage)}%):</span>
                  <span className="font-bold text-red-700 text-lg">- {formatToFixed(calculateDiscount())} {t('common.currency')}</span>
                </div>
              )}

              {taxEnabled && (
                <>
                  {taxType === 'inclusive' ? (
                    <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-blue-700">{t('invoices.total_with_tax')}:</span>
                        <span className="font-semibold text-blue-900">{formatToFixed(calculateSubtotalAfterDiscount())} {t('common.currency')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-blue-700">{t('invoices.base_amount')}:</span>
                        <span className="font-semibold text-blue-900">{formatToFixed(calculateBaseAmount())} {t('common.currency')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-blue-700">{t('invoices.tax')} ({toEnglishDigits(taxRate)}%):</span>
                        <span className="font-semibold text-blue-900">{formatToFixed(calculateTax())} {t('common.currency')}</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      {discountPercentage > 0 && (
                        <div className="flex justify-between items-center py-2 px-4 bg-gray-50 rounded-lg">
                          <span className="font-medium text-gray-700">{t('invoices.subtotal_after_discount')}:</span>
                          <span className="font-semibold text-gray-900">{formatToFixed(calculateSubtotalAfterDiscount())} {t('common.currency')}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-2 px-4 bg-blue-50 rounded-lg border border-blue-100">
                        <span className="font-medium text-blue-700">{t('invoices.tax')} ({toEnglishDigits(taxRate)}%):</span>
                        <span className="font-bold text-blue-700 text-lg">{formatToFixed(calculateTax())} {t('common.currency')}</span>
                      </div>
                    </>
                  )}
                </>
              )}

              <div className="flex justify-between items-center py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl text-white shadow-lg">
                <span className="font-bold text-lg">{t('invoices.grand_total')}:</span>
                <span className="font-bold text-2xl">{formatToFixed(calculateTotal())} {t('common.currency')}</span>
              </div>
            </div>
          </div>
        </div>

        {spareParts.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-green-50 rounded-lg">
                <Receipt className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">{t('work_orders.spare_parts')}</h3>
              <span className="text-sm text-gray-500">({t('work_orders.from_work_order')})</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-green-50 border-b-2 border-green-200">
                    <th className="text-right py-3 px-4 text-sm font-bold text-green-900">{t('inventory.part_name')}</th>
                    <th className="text-center py-3 px-4 text-sm font-bold text-green-900">{t('inventory.part_number')}</th>
                    <th className="text-center py-3 px-4 text-sm font-bold text-green-900">{t('invoices.quantity')}</th>
                    <th className="text-center py-3 px-4 text-sm font-bold text-green-900">{t('invoices.price')}</th>
                    <th className="text-left py-3 px-4 text-sm font-bold text-green-900">{t('common.total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {spareParts.map((part, index) => (
                    <tr key={part.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="py-3 px-4 text-gray-900 font-medium text-sm">{part.name}</td>
                      <td className="text-center py-3 px-4">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-mono">
                          {part.part_number}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4 text-gray-700 text-sm">{formatToFixed(part.quantity)}</td>
                      <td className="text-center py-3 px-4 text-gray-700 text-sm">{formatToFixed(part.unit_price)}</td>
                      <td className="text-left py-3 px-4 text-gray-900 font-semibold text-sm">
                        {formatToFixed(part.total)} {t('common.currency')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-4 bg-green-50 border border-green-100 rounded-xl">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-green-900">{t('work_orders.spare_parts_total')}:</span>
                <span className="font-bold text-green-900 text-lg">
                  {formatToFixed(spareParts.reduce((sum, part) => sum + part.total, 0))} {t('common.currency')}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <h3 className="text-xl font-bold text-gray-900 mb-6">{t('invoices.payment_info')}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                {t('invoices.payment_method')}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all ${
                    paymentMethod === 'cash'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <Banknote className="h-5 w-5" />
                  <span className="font-semibold">{t('common.cash')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all ${
                    paymentMethod === 'card'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <CreditCard className="h-5 w-5" />
                  <span className="font-semibold">{t('common.card')}</span>
                </button>
              </div>
            </div>

            {paymentMethod === 'card' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  {t('invoices.card_type')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCardType('mada')}
                    className={`py-3 px-4 rounded-xl border-2 transition-all font-semibold ${
                      cardType === 'mada'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    {t('common.mada')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardType('visa')}
                    className={`py-3 px-4 rounded-xl border-2 transition-all font-semibold ${
                      cardType === 'visa'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    {t('common.visa')}
                  </button>
                </div>
              </div>
            )}

            <div className={paymentMethod === 'card' ? 'md:col-span-2' : 'md:col-span-1'}>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('invoices.amount_paid')}
              </label>
              <input
                type="text"
                value={paidAmount}
                onChange={(e) => setPaidAmount(Number(normalizeNumberInput(e.target.value)))}
                placeholder="0.00"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-lg font-semibold"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('common.notes')} <span className="text-gray-400 font-normal">({t('common.optional')})</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder={t('invoices.notes_placeholder')}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg hover:shadow-xl font-semibold text-lg"
          >
            <Save className="h-5 w-5" />
            {loading ? t('common.saving') : t('common.save')}
          </button>
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
