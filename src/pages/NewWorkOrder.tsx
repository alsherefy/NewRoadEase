import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { customersService, vehiclesService, techniciansService, ServiceError } from '../services';
import { supabase } from '../lib/supabase';
import { Customer, Vehicle, Technician } from '../types';
import { Plus, Trash2, ArrowRight, Save } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { displayNumber, normalizeNumberInput } from '../utils/numberUtils';

interface Service {
  service_type: string;
  description: string;
  labor_cost: number;
  technicians: Array<{
    technician_id: string;
    share_amount: number;
  }>;
}

interface NewWorkOrderProps {
  orderId?: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function NewWorkOrder({ orderId, onBack, onSuccess }: NewWorkOrderProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [services, setServices] = useState<Service[]>([{
    service_type: '',
    description: '',
    labor_cost: 0,
    technicians: [],
  }]);

  const serviceTypes = [
    t('services.mechanics'),
    t('services.electricity'),
    'فحص كمبيوتر',
    'صيانة دورية',
    t('services.bodywork'),
    'دهان',
    t('services.ac'),
    'فرامل',
    t('services.other'),
  ];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (orderId) {
      loadWorkOrder();
    }
  }, [orderId]);

  useEffect(() => {
    if (selectedCustomerId) {
      setSelectedVehicleId('');
      loadVehicles(selectedCustomerId);
    } else {
      setVehicles([]);
      setSelectedVehicleId('');
    }
  }, [selectedCustomerId]);

  async function loadData() {
    try {
      const [customersData, techniciansData] = await Promise.all([
        customersService.getAllCustomers(),
        techniciansService.getActiveTechnicians(),
      ]);
      setCustomers(customersData);
      setTechnicians(techniciansData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  async function loadVehicles(customerId: string) {
    try {
      const data = await vehiclesService.getVehiclesByCustomer(customerId);
      setVehicles(data);
      if (data && data.length === 1) {
        setSelectedVehicleId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  }

  async function loadWorkOrder() {
    if (!orderId) return;

    try {
      const { data: workOrder, error: orderError } = await supabase
        .from('work_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      setSelectedCustomerId(workOrder.customer_id);
      setSelectedVehicleId(workOrder.vehicle_id);

      await loadVehicles(workOrder.customer_id);

      const { data: servicesData, error: servicesError } = await supabase
        .from('work_order_services')
        .select('*')
        .eq('work_order_id', orderId);

      if (servicesError) throw servicesError;

      const loadedServices: Service[] = [];

      for (const service of servicesData || []) {
        const { data: assignments } = await supabase
          .from('technician_assignments')
          .select('*')
          .eq('service_id', service.id);

        loadedServices.push({
          service_type: service.service_type,
          description: service.description,
          labor_cost: service.labor_cost,
          technicians: (assignments || []).map(a => ({
            technician_id: a.technician_id,
            share_amount: a.share_amount,
          })),
        });
      }

      if (loadedServices.length > 0) {
        setServices(loadedServices);
      }
    } catch (error) {
      console.error('Error loading work order:', error);
      toast.error(t('work_orders.error_update'));
    }
  }

  function addService() {
    setServices([...services, {
      service_type: '',
      description: '',
      labor_cost: 0,
      technicians: [],
    }]);
  }

  function removeService(index: number) {
    setServices(services.filter((_, i) => i !== index));
  }

  function updateService(index: number, field: keyof Service, value: any) {
    const updated = [...services];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'labor_cost' && updated[index].technicians.length > 0) {
      const techCount = updated[index].technicians.length;
      const sharePerTech = value / techCount;
      updated[index].technicians = updated[index].technicians.map(tech => ({
        ...tech,
        share_amount: sharePerTech
      }));
    }

    setServices(updated);
  }

  function redistributeShares(serviceIndex: number, updatedTechnicians: Array<{ technician_id: string; share_amount: number }>) {
    const service = services[serviceIndex];
    const techCount = updatedTechnicians.length;

    if (techCount === 0) return updatedTechnicians;

    const sharePerTech = service.labor_cost / techCount;
    return updatedTechnicians.map(tech => ({
      ...tech,
      share_amount: sharePerTech
    }));
  }

  function addTechnicianToService(serviceIndex: number, technicianId: string) {
    const updated = [...services];
    const existingIndex = updated[serviceIndex].technicians.findIndex(
      t => t.technician_id === technicianId
    );

    if (existingIndex < 0) {
      updated[serviceIndex].technicians.push({ technician_id: technicianId, share_amount: 0 });
      updated[serviceIndex].technicians = redistributeShares(serviceIndex, updated[serviceIndex].technicians);
    }
    setServices(updated);
  }

  function removeTechnicianFromService(serviceIndex: number, technicianId: string) {
    const updated = [...services];
    updated[serviceIndex].technicians = updated[serviceIndex].technicians.filter(
      t => t.technician_id !== technicianId
    );
    updated[serviceIndex].technicians = redistributeShares(serviceIndex, updated[serviceIndex].technicians);
    setServices(updated);
  }

  function updateTechnicianShare(serviceIndex: number, technicianId: string, shareAmount: number) {
    const updated = [...services];
    const techIndex = updated[serviceIndex].technicians.findIndex(
      t => t.technician_id === technicianId
    );
    if (techIndex >= 0) {
      updated[serviceIndex].technicians[techIndex].share_amount = shareAmount;
    }
    setServices(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedCustomerId) {
      toast.error(t('validation.fill_all_required'));
      return;
    }

    if (!selectedVehicleId) {
      toast.error(t('validation.fill_all_required'));
      return;
    }

    if (services.some(s => !s.service_type || !s.description || s.labor_cost <= 0)) {
      toast.error(t('validation.fill_all_required'));
      return;
    }

    if (services.some(s => s.technicians.length === 0)) {
      toast.error(t('validation.fill_all_required'));
      return;
    }

    try {
      const totalLaborCost = services.reduce((sum, s) => sum + s.labor_cost, 0);

      if (orderId) {
        const { error: orderError } = await supabase
          .from('work_orders')
          .update({
            customer_id: selectedCustomerId,
            vehicle_id: selectedVehicleId,
            total_labor_cost: totalLaborCost,
          })
          .eq('id', orderId);

        if (orderError) throw orderError;

        const { data: existingServices } = await supabase
          .from('work_order_services')
          .select('id')
          .eq('work_order_id', orderId);

        if (existingServices) {
          for (const service of existingServices) {
            await supabase
              .from('technician_assignments')
              .delete()
              .eq('service_id', service.id);
          }
        }

        await supabase
          .from('work_order_services')
          .delete()
          .eq('work_order_id', orderId);

        for (const service of services) {
          const { data: serviceData, error: serviceError } = await supabase
            .from('work_order_services')
            .insert([{
              work_order_id: orderId,
              service_type: service.service_type,
              description: service.description,
              labor_cost: service.labor_cost,
            }])
            .select()
            .single();

          if (serviceError) throw serviceError;

          const assignments = service.technicians.map(t => ({
            service_id: serviceData.id,
            technician_id: t.technician_id,
            share_amount: t.share_amount,
          }));

          const { error: assignmentError } = await supabase
            .from('technician_assignments')
            .insert(assignments);

          if (assignmentError) throw assignmentError;
        }

        toast.success(t('work_orders.success_updated'));
      } else {
        const orderNumber = `WO-${Date.now()}`;

        const { data: workOrder, error: orderError } = await supabase
          .from('work_orders')
          .insert([{
            customer_id: selectedCustomerId,
            vehicle_id: selectedVehicleId,
            order_number: orderNumber,
            status: 'in_progress',
            total_labor_cost: totalLaborCost,
            organization_id: user?.organization_id,
          }])
          .select()
          .single();

        if (orderError) throw orderError;

        for (const service of services) {
          const { data: serviceData, error: serviceError } = await supabase
            .from('work_order_services')
            .insert([{
              work_order_id: workOrder.id,
              service_type: service.service_type,
              description: service.description,
              labor_cost: service.labor_cost,
            }])
            .select()
            .single();

          if (serviceError) throw serviceError;

          const assignments = service.technicians.map(t => ({
            service_id: serviceData.id,
            technician_id: t.technician_id,
            share_amount: t.share_amount,
          }));

          const { error: assignmentError } = await supabase
            .from('technician_assignments')
            .insert(assignments);

          if (assignmentError) throw assignmentError;
        }

        toast.success(t('work_orders.success_created'));
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving work order:', error);
      toast.error(t('work_orders.error_create'));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 space-x-reverse">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 space-x-reverse text-gray-600 hover:text-gray-800"
        >
          <ArrowRight className="h-5 w-5" />
          <span>{t('common.back')}</span>
        </button>
        <h2 className="text-3xl font-bold text-gray-800">
          {orderId ? t('work_orders.edit_order') : t('work_orders.new_order')}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">{t('work_orders.choose_customer_vehicle')}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('work_orders.customer')}</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">{t('work_orders.select_customer')}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} - {customer.phone}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('work_orders.vehicle')}</label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
                disabled={!selectedCustomerId}
              >
                <option value="">{t('work_orders.select_vehicle')}</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.car_make} {vehicle.car_model} - {vehicle.plate_number} ({vehicle.car_year})
                  </option>
                ))}
              </select>
              {selectedCustomerId && vehicles.length === 0 && (
                <p className="text-sm text-red-600 mt-1">
                  {t('customers.no_vehicles')}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-800">{t('work_orders.services')}</h3>
            <button
              type="button"
              onClick={addService}
              className="flex items-center space-x-2 space-x-reverse bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              <Plus className="h-4 w-4" />
              <span>{t('work_orders.add_service')}</span>
            </button>
          </div>

          {services.map((service, index) => (
            <div key={index} className="bg-white rounded-xl shadow-md p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-gray-800">{t('services.service_type')} {index + 1}</h4>
                {services.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeService(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('services.service_type')}</label>
                  <select
                    value={service.service_type}
                    onChange={(e) => updateService(index, 'service_type', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">{t('work_orders.select_customer')}</option>
                    {serviceTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('services.cost')}</label>
                  <input
                    type="text"
                    value={service.labor_cost}
                    onChange={(e) => updateService(index, 'labor_cost', parseFloat(normalizeNumberInput(e.target.value)) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('services.description')}</label>
                <textarea
                  value={service.description}
                  onChange={(e) => updateService(index, 'description', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg h-24"
                  placeholder={t('services.description')}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('services.assign_technicians')}</label>
                <div className="space-y-2">
                  {technicians.map((tech) => {
                    const assignment = service.technicians.find(t => t.technician_id === tech.id);
                    return (
                      <div key={tech.id} className="flex items-center space-x-3 space-x-reverse">
                        <input
                          type="checkbox"
                          checked={!!assignment}
                          onChange={(e) => {
                            if (e.target.checked) {
                              addTechnicianToService(index, tech.id);
                            } else {
                              removeTechnicianFromService(index, tech.id);
                            }
                          }}
                          className="w-5 h-5"
                        />
                        <span className="flex-1 text-gray-700">{tech.name} ({tech.specialization})</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="text-xl font-bold text-gray-800 mb-4">
            {t('work_orders.total_labor_cost')}: {displayNumber(services.reduce((sum, s) => sum + s.labor_cost, 0))} {t('common.sar')}
          </div>
          <button
            type="submit"
            className="flex items-center space-x-2 space-x-reverse bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors text-lg font-medium"
          >
            <Save className="h-5 w-5" />
            <span>{t('common.save')}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
