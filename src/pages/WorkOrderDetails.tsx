import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { settingsService, workOrdersService, ServiceError } from '../services';
import { supabase } from '../lib/supabase';
import { WorkOrder, WorkOrderService, TechnicianAssignment } from '../types';
import { ArrowRight, User, Car, Calendar, DollarSign, FileText, Printer, Receipt } from 'lucide-react';
import { WorkOrderSpareParts } from '../components/WorkOrderSpareParts';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { displayNumber } from '../utils/numberUtils';

interface WorkOrderDetailsProps {
  orderId: string;
  onBack: () => void;
  onViewInvoice?: (invoiceId: string) => void;
}

interface ServiceWithAssignments extends WorkOrderService {
  assignments: TechnicianAssignment[];
}

interface WorkshopSettings {
  id: string;
  name: string;
  phone: string;
  address: string;
  email: string;
  tax_number: string;
  commercial_registration: string;
  tax_enabled: boolean;
  tax_rate: number;
  tax_type: string;
}

export function WorkOrderDetails({ orderId, onBack, onViewInvoice }: WorkOrderDetailsProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [services, setServices] = useState<ServiceWithAssignments[]>([]);
  const [workshopSettings, setWorkshopSettings] = useState<WorkshopSettings | null>(null);
  const [invoice, setInvoice] = useState<{ id: string; invoice_number: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrderDetails();
    loadWorkshopSettings();
    loadInvoice();
  }, [orderId]);

  async function loadOrderDetails() {
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('work_orders')
        .select(`
          *,
          customer:customers(*),
          vehicle:vehicles(*)
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;
      setOrder(orderData);

      const { data: servicesData, error: servicesError } = await supabase
        .from('work_order_services')
        .select('*')
        .eq('work_order_id', orderId);

      if (servicesError) throw servicesError;

      const servicesWithAssignments = await Promise.all(
        (servicesData || []).map(async (service) => {
          const { data: assignments } = await supabase
            .from('technician_assignments')
            .select(`
              *,
              technician:technicians(*)
            `)
            .eq('service_id', service.id);

          return {
            ...service,
            assignments: assignments || [],
          };
        })
      );

      setServices(servicesWithAssignments);
    } catch (error) {
      console.error('Error loading order details:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadWorkshopSettings() {
    try {
      const data = await settingsService.getWorkshopSettings();
      if (data) {
        setWorkshopSettings(data);
      }
    } catch (error) {
      console.error('Error loading workshop settings:', error);
    }
  }

  async function loadInvoice() {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number')
        .eq('work_order_id', orderId)
        .maybeSingle();

      if (error) throw error;
      setInvoice(data);
    } catch (error) {
      console.error('Error loading invoice:', error);
    }
  }

  async function updateStatus(newStatus: string) {
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', orderId);

      if (error) throw error;

      if (newStatus === 'completed') {
        await createInvoiceForWorkOrder();
      }

      loadOrderDetails();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(t('common.error.update'));
    }
  }

  async function createInvoiceForWorkOrder() {
    try {
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('work_order_id', orderId)
        .maybeSingle();

      if (existingInvoice) {
        toast.warning(t('work_orders.invoice_already_exists'));
        return;
      }

      if (!order) return;

      const { data: workOrderParts } = await supabase
        .from('work_order_spare_parts')
        .select(`
          *,
          spare_part:spare_parts(
            name,
            part_number
          )
        `)
        .eq('work_order_id', orderId);

      const partsTotal = (workOrderParts || []).reduce((sum, part) => sum + Number(part.total), 0);

      const { data: invoiceNumber } = await supabase
        .rpc('generate_invoice_number');

      if (!invoiceNumber) throw new Error('Failed to generate invoice number');

      const baseAmount = Number(order.total_labor_cost) + partsTotal;

      const taxEnabled = workshopSettings?.tax_enabled ?? false;
      const taxRate = workshopSettings?.tax_rate ?? 0;
      const taxType = workshopSettings?.tax_type ?? 'exclusive';

      let subtotal, taxAmount, total;

      if (taxEnabled && taxRate > 0) {
        if (taxType === 'inclusive') {
          total = baseAmount;
          taxAmount = (baseAmount * taxRate) / (100 + taxRate);
          subtotal = baseAmount - taxAmount;
        } else {
          subtotal = baseAmount;
          taxAmount = (baseAmount * taxRate) / 100;
          total = baseAmount + taxAmount;
        }
      } else {
        subtotal = baseAmount;
        taxAmount = 0;
        total = baseAmount;
      }

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          work_order_id: orderId,
          customer_id: order.customer_id,
          vehicle_id: order.vehicle_id,
          organization_id: order.organization_id,
          subtotal: subtotal,
          tax_rate: taxEnabled ? taxRate : 0,
          tax_amount: taxAmount,
          tax_type: taxType,
          total: total,
          paid_amount: 0,
          payment_status: 'unpaid',
          payment_method: 'cash',
          notes: `${t('work_orders.auto_invoice_for')} ${order.order_number}`
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Re-fetch services to ensure we have the latest data
      const { data: servicesData, error: servicesError } = await supabase
        .from('work_order_services')
        .select('*')
        .eq('work_order_id', orderId);

      if (servicesError) throw servicesError;

      const serviceItems = (servicesData || []).map(service => ({
        invoice_id: invoice.id,
        item_type: 'service',
        service_type: service.service_type,
        description: service.description,
        quantity: 1,
        unit_price: Number(service.labor_cost) || 0,
        total: Number(service.labor_cost) || 0
      }));

      const partItems = (workOrderParts || []).map((part: any) => ({
        invoice_id: invoice.id,
        item_type: 'part',
        description: part.spare_part?.name || t('work_orders.spare_part'),
        quantity: Number(part.quantity),
        unit_price: Number(part.unit_price),
        total: Number(part.total),
        spare_part_id: part.spare_part_id
      }));

      const allItems = [...serviceItems, ...partItems];

      console.log('Creating invoice items:', {
        serviceItemsCount: serviceItems.length,
        partItemsCount: partItems.length,
        totalItems: allItems.length,
        serviceItems,
        partItems
      });

      if (allItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(allItems);

        if (itemsError) {
          console.error('Error inserting invoice items:', itemsError);
          throw itemsError;
        }

        console.log('Successfully inserted', allItems.length, 'invoice items');
      } else {
        console.warn('No items to insert into invoice');
      }

      toast.success(`${t('work_orders.invoice_created')} ${invoiceNumber}`);
      loadInvoice();
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error(t('work_orders.invoice_create_error'));
    }
  }

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  if (!order) {
    return <div className="text-center py-8">{t('work_orders.not_found')}</div>;
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-4 py-2 rounded-full text-sm font-medium ${styles[status as keyof typeof styles]}`}>
        {t(`status.${status}`)}
      </span>
    );
  };

  const handlePrint = async () => {
    if (!order) {
      toast.error(t('work_orders.cannot_print'));
      return;
    }

    const { data: workOrderParts } = await supabase
      .from('work_order_spare_parts')
      .select(`
        *,
        spare_part:spare_parts(*)
      `)
      .eq('work_order_id', orderId);

    const workshopName = workshopSettings?.name || t('work_orders.workshop_name');
    const workshopPhone = workshopSettings?.phone || '';
    const workshopAddress = workshopSettings?.address || '';
    const workshopEmail = workshopSettings?.email || '';

    const orderDate = order.created_at ? new Date(order.created_at).toLocaleDateString('en-US') : '';

    const customerName = order.customer?.name || '';
    const customerPhone = order.customer?.phone || '';

    const carMake = order.vehicle?.car_make || '';
    const carModel = order.vehicle?.car_model || '';
    const carYear = order.vehicle?.car_year || '';
    const plateNumber = order.vehicle?.plate_number || '';

    const servicesHtml = services.map((service, index) => {
      const techniciansList = service.assignments.length > 0
        ? `<div class="technicians-list">
             <strong>${t('work_orders.assigned_technicians')}:</strong>
             ${service.assignments.map(assignment =>
               `<div class="technician-item">${assignment.technician?.name || ''} - ${assignment.technician?.specialization || ''}</div>`
             ).join('')}
           </div>`
        : '';

      return `<div class="service-item">
                <div class="service-header">
                  <div class="service-title">${index + 1}. ${service.service_type || ''}</div>
                  <div class="service-price">${displayNumber(service.labor_cost || 0)} ${t('common.currency')}</div>
                </div>
                <div class="service-description">
                  <strong>${t('common.description')}:</strong> ${service.description || t('common.none')}
                </div>
                ${techniciansList}
              </div>`;
    }).join('');

    const partsHtml = (workOrderParts && workOrderParts.length > 0)
      ? `<div class="section">
           <h2>${t('work_orders.spare_parts_used')}</h2>
           ${workOrderParts.map((part, index) => `
             <div class="part-item">
               <div class="part-header">
                 <span class="part-number">${index + 1}.</span>
                 <span class="part-name">${part.spare_part?.name || t('work_orders.spare_part')}</span>
                 <span class="part-details">
                   (${t('common.quantity')}: ${part.quantity} × ${displayNumber(part.unit_price)} ${t('common.currency')})
                 </span>
                 <span class="part-total">${displayNumber(part.total)} ${t('common.currency')}</span>
               </div>
             </div>
           `).join('')}
         </div>`
      : '';

    const laborTotal = services.reduce((sum, service) => sum + Number(service.labor_cost || 0), 0);
    const partsTotal = (workOrderParts || []).reduce((sum, part) => sum + Number(part.total), 0);
    const grandTotal = laborTotal + partsTotal;

    const printContent = `<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="utf-8">
  <title>${t('work_orders.work_order')}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 15px;
      direction: rtl;
      font-size: 13px;
    }
    .workshop-header {
      text-align: center;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 2px solid #333;
    }
    .workshop-name {
      font-size: 24px;
      font-weight: bold;
      color: #333;
      margin: 0 0 6px 0;
    }
    .workshop-info {
      font-size: 11px;
      color: #666;
      margin: 3px 0;
    }
    .header {
      text-align: center;
      padding: 8px 0;
      margin-bottom: 12px;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      color: #444;
    }
    .order-info {
      text-align: center;
      margin: 5px 0;
      font-size: 13px;
    }
    .section {
      margin: 10px 0;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 5px;
      background-color: #fff;
    }
    .section h2 {
      margin-top: 0;
      margin-bottom: 8px;
      color: #333;
      font-size: 15px;
      border-bottom: 1px solid #eee;
      padding-bottom: 5px;
    }
    .customer-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      padding: 8px;
      background-color: #f9f9f9;
      border-radius: 4px;
    }
    .customer-info-item {
      display: flex;
      gap: 5px;
    }
    .info-label {
      font-weight: bold;
      color: #555;
    }
    .vehicle-info {
      display: flex;
      justify-content: space-around;
      padding: 8px;
      background-color: #f5f5f5;
      border-radius: 4px;
    }
    .vehicle-info-item {
      display: flex;
      gap: 5px;
    }
    .service-item {
      margin: 8px 0;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background-color: #fafafa;
    }
    .service-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .service-title {
      font-size: 14px;
      font-weight: bold;
      color: #333;
    }
    .service-price {
      font-size: 14px;
      font-weight: bold;
      color: #16a34a;
    }
    .service-description {
      color: #666;
      margin: 5px 0;
      line-height: 1.4;
      font-size: 12px;
    }
    .technicians-list {
      margin-top: 6px;
      padding: 6px;
      background-color: #fff;
      border: 1px solid #eee;
      border-radius: 3px;
      font-size: 11px;
    }
    .technician-item {
      padding: 5px;
      margin: 3px 0;
      background-color: #f5f5f5;
      border-radius: 3px;
    }
    .part-item {
      margin: 8px 0;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background-color: #fafafa;
    }
    .part-header {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: 13px;
    }
    .part-number {
      font-weight: bold;
      color: #555;
    }
    .part-name {
      font-weight: bold;
      color: #333;
      flex: 1;
    }
    .part-details {
      color: #666;
      font-size: 12px;
    }
    .part-total {
      font-weight: bold;
      color: #16a34a;
    }
    .summary {
      margin: 15px 0;
      padding: 12px;
      border: 2px solid #333;
      border-radius: 5px;
      background-color: #f9f9f9;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 14px;
    }
    .summary-row.total {
      border-top: 2px solid #333;
      margin-top: 8px;
      padding-top: 8px;
      font-size: 16px;
      font-weight: bold;
    }
    .footer {
      margin-top: 15px;
      padding-top: 10px;
      border-top: 1px solid #333;
      text-align: center;
      font-size: 10px;
      color: #666;
    }
    @media print {
      body { padding: 10px; font-size: 12px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="workshop-header">
    <div class="workshop-name">${workshopName}</div>
    ${workshopPhone ? `<div class="workshop-info">${t('common.phone')}: ${workshopPhone}</div>` : ''}
    ${workshopAddress ? `<div class="workshop-info">${t('common.address')}: ${workshopAddress}</div>` : ''}
    ${workshopEmail ? `<div class="workshop-info">${t('common.email')}: ${workshopEmail}</div>` : ''}
  </div>

  <div class="header">
    <h1>${t('work_orders.work_order')}</h1>
    <div class="order-info">${t('common.date')}: ${orderDate}</div>
  </div>

  <div class="section">
    <h2>${t('work_orders.customer_vehicle_info')}</h2>
    <div class="customer-info">
      <div class="customer-info-item">
        <span class="info-label">${t('customers.name')}:</span>
        <span>${customerName}</span>
      </div>
      <div class="customer-info-item">
        <span class="info-label">${t('common.phone')}:</span>
        <span>${customerPhone}</span>
      </div>
    </div>
    <div class="vehicle-info">
      <div class="vehicle-info-item">
        <span class="info-label">${t('vehicles.type')}:</span>
        <span>${carMake} ${carModel}</span>
      </div>
      <div class="vehicle-info-item">
        <span class="info-label">${t('vehicles.year')}:</span>
        <span>${carYear}</span>
      </div>
      <div class="vehicle-info-item">
        <span class="info-label">${t('vehicles.plate_number')}:</span>
        <span>${plateNumber}</span>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>${t('work_orders.requested_services')}</h2>
    ${servicesHtml}
  </div>

  ${partsHtml}

  <div class="summary">
    <div class="summary-row">
      <span>${t('work_orders.total_labor')}:</span>
      <span>${displayNumber(laborTotal)} ${t('common.currency')}</span>
    </div>
    <div class="summary-row">
      <span>${t('work_orders.total_parts')}:</span>
      <span>${displayNumber(partsTotal)} ${t('common.currency')}</span>
    </div>
    <div class="summary-row total">
      <span>${t('common.grand_total')}:</span>
      <span>${displayNumber(grandTotal)} ${t('common.currency')}</span>
    </div>
  </div>

  <div class="footer">
    <p>${t('common.printed_by')}: ${user?.full_name || t('common.user')}</p>
    <p>${t('common.date')}: ${new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}</p>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        setTimeout(() => {
          printWindow.close();
        }, 100);
      }, 250);
    } else {
      toast.error(t('common.print_error'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 space-x-reverse">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 space-x-reverse text-gray-600 hover:text-gray-800"
          >
            <ArrowRight className="h-5 w-5" />
            <span>{t('common.back')}</span>
          </button>
          <h2 className="text-3xl font-bold text-gray-800">{t('work_orders.order_number')} {order.order_number}</h2>
        </div>
        <div className="flex items-center space-x-3 space-x-reverse">
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 space-x-reverse bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-md"
          >
            <Printer className="h-5 w-5" />
            <span>{t('common.print')}</span>
          </button>
          {getStatusBadge(order.status)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {order.customer && order.vehicle && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">{t('work_orders.customer_vehicle_info')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3 space-x-reverse">
                  <User className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">{t('customers.name')}</p>
                    <p className="font-medium text-gray-800">{order.customer.name}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 space-x-reverse">
                  <FileText className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">{t('common.phone')}</p>
                    <p className="font-medium text-gray-800">{order.customer.phone}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 space-x-reverse">
                  <Car className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">{t('vehicles.vehicle')}</p>
                    <p className="font-medium text-gray-800">
                      {order.vehicle.car_make} {order.vehicle.car_model} - {order.vehicle.car_year}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 space-x-reverse">
                  <FileText className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">{t('vehicles.plate_number')}</p>
                    <p className="font-medium text-gray-800">{order.vehicle.plate_number}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">{t('work_orders.requested_services')}</h3>
            <div className="space-y-4">
              {services.map((service, index) => (
                <div key={service.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-gray-800 text-lg">
                        {index + 1}. {service.service_type}
                      </h4>
                      <p className="text-gray-600 mt-1">{service.description}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-gray-600">{t('work_orders.labor_cost')}</p>
                      <p className="text-lg font-bold text-green-600">
                        {displayNumber(service.labor_cost)} {t('common.currency')}
                      </p>
                    </div>
                  </div>

                  {service.assignments.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-2">{t('work_orders.assigned_technicians')}:</p>
                      <div className="space-y-2">
                        {service.assignments.map((assignment) => (
                          <div
                            key={assignment.id}
                            className="flex items-center bg-gray-50 rounded-lg p-3"
                          >
                            <div className="flex items-center space-x-3 space-x-reverse">
                              <div className="bg-blue-100 rounded-full p-2">
                                <User className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-800">
                                  {assignment.technician?.name}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {assignment.technician?.specialization}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <WorkOrderSpareParts
            workOrderId={orderId}
            isCompleted={order.status === 'completed'}
            onUpdate={loadOrderDetails}
          />
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">{t('work_orders.order_info')}</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-3 space-x-reverse">
                <Calendar className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-600">{t('common.created_date')}</p>
                  <p className="font-medium text-gray-800">
                    {new Date(order.created_at).toLocaleDateString('en-US')}
                  </p>
                </div>
              </div>

              {order.completed_at && (
                <div className="flex items-center space-x-3 space-x-reverse">
                  <Calendar className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">{t('common.completed_date')}</p>
                    <p className="font-medium text-gray-800">
                      {new Date(order.completed_at).toLocaleDateString('en-US')}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-3 space-x-reverse">
                <DollarSign className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-600">{t('work_orders.total_labor')}</p>
                  <p className="text-2xl font-bold text-green-600">
                    {displayNumber(order.total_labor_cost)} {t('common.currency')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {invoice && (
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2 space-x-reverse text-white">
                  <Receipt className="h-6 w-6" />
                  <h3 className="text-xl font-bold">{t('invoices.invoice')}</h3>
                </div>
                <span className="bg-white text-green-600 px-3 py-1 rounded-full text-sm font-bold">
                  {invoice.invoice_number}
                </span>
              </div>
              {onViewInvoice && (
                <button
                  onClick={() => onViewInvoice(invoice.id)}
                  className="w-full bg-white text-green-600 px-4 py-3 rounded-lg hover:bg-green-50 transition-colors font-medium shadow-sm"
                >
                  {t('invoices.view_invoice')}
                </button>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">{t('work_orders.change_status')}</h3>
            <div className="space-y-2">
              {[
                { value: 'pending', label: t('status.pending'), color: 'bg-yellow-600' },
                { value: 'in_progress', label: t('status.in_progress'), color: 'bg-blue-600' },
                { value: 'completed', label: t('status.completed'), color: 'bg-green-600' },
                { value: 'cancelled', label: t('status.cancelled'), color: 'bg-red-600' },
              ].map((status) => (
                <button
                  key={status.value}
                  onClick={() => updateStatus(status.value)}
                  disabled={order.status === status.value}
                  className={`w-full text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed ${status.color}`}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
