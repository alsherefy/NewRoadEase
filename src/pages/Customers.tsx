import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Customer, Vehicle } from '../types';
import { Plus, Edit2, Trash2, Phone, Mail, Car, User, X, Search, ShieldAlert } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import { useTranslation } from 'react-i18next';
import { normalizeNumberInput } from '../utils/numberUtils';
import { useAuth } from '../contexts/AuthContext';

interface VehicleFormData {
  car_make: string;
  car_model: string;
  car_year: number;
  plate_number: string;
  notes: string;
}

export function Customers() {
  const { t } = useTranslation();
  const { hasPermission, isAdmin } = useAuth();
  const toast = useToast();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, Vehicle[]>>({});
  const [loading, setLoading] = useState(true);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 30;

  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
  });

  const [vehicleForm, setVehicleForm] = useState({
    customer_id: '',
    car_make: '',
    car_model: '',
    car_year: new Date().getFullYear(),
    plate_number: '',
    notes: '',
  });

  const [newCustomerVehicles, setNewCustomerVehicles] = useState<VehicleFormData[]>([]);
  const [currentVehicleForm, setCurrentVehicleForm] = useState<VehicleFormData>({
    car_make: '',
    car_model: '',
    car_year: new Date().getFullYear(),
    plate_number: '',
    notes: '',
  });

  useEffect(() => {
    loadCustomersAndVehicles();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function loadCustomersAndVehicles(resetPage = false) {
    try {
      const currentPage = resetPage ? 0 : page;
      const { data: customersData, error: customersError, count } = await supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      if (customersError) throw customersError;

      if (resetPage) {
        setCustomers(customersData || []);
        setPage(0);
      } else {
        setCustomers(prev => currentPage === 0 ? (customersData || []) : [...prev, ...(customersData || [])]);
      }

      setHasMore((customersData?.length || 0) === PAGE_SIZE && ((currentPage + 1) * PAGE_SIZE) < (count || 0));

      if (customersData && customersData.length > 0) {
        const customerIds = customersData.map(c => c.id);
        const { data: vehiclesData, error: vehiclesError } = await supabase
          .from('vehicles')
          .select('*')
          .in('customer_id', customerIds)
          .order('created_at', { ascending: false });

        if (vehiclesError) throw vehiclesError;

        const vehiclesByCustomer: Record<string, Vehicle[]> = { ...vehicles };
        (vehiclesData || []).forEach((vehicle) => {
          if (!vehiclesByCustomer[vehicle.customer_id]) {
            vehiclesByCustomer[vehicle.customer_id] = [];
          }
          if (!vehiclesByCustomer[vehicle.customer_id].find(v => v.id === vehicle.id)) {
            vehiclesByCustomer[vehicle.customer_id].push(vehicle);
          }
        });
        setVehicles(vehiclesByCustomer);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    setPage(prev => prev + 1);
    await loadCustomersAndVehicles();
  }

  function addVehicleToList() {
    if (!currentVehicleForm.car_make || !currentVehicleForm.car_model || !currentVehicleForm.plate_number) {
      toast.warning(t('customers.fill_required_fields'));
      return;
    }

    setNewCustomerVehicles([...newCustomerVehicles, currentVehicleForm]);
    setCurrentVehicleForm({
      car_make: '',
      car_model: '',
      car_year: new Date().getFullYear(),
      plate_number: '',
      notes: '',
    });
  }

  function removeVehicleFromList(index: number) {
    setNewCustomerVehicles(newCustomerVehicles.filter((_, i) => i !== index));
  }

  async function handleCustomerSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingCustomerId) {
        const { error } = await supabase
          .from('customers')
          .update(customerForm)
          .eq('id', editingCustomerId);
        if (error) throw error;
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert([customerForm])
          .select()
          .single();

        if (customerError) throw customerError;

        if (newCustomerVehicles.length > 0 && newCustomer) {
          const vehiclesToInsert = newCustomerVehicles.map(v => ({
            ...v,
            customer_id: newCustomer.id
          }));

          const { error: vehiclesError } = await supabase
            .from('vehicles')
            .insert(vehiclesToInsert);

          if (vehiclesError) throw vehiclesError;
        }
      }
      resetCustomerForm();
      await loadCustomersAndVehicles(true);
    } catch (error) {
      console.error('Error saving customer:', error);
      toast.error(t('customers.error_create'));
    }
  }

  async function handleVehicleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingVehicleId) {
        const { error } = await supabase
          .from('vehicles')
          .update(vehicleForm)
          .eq('id', editingVehicleId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('vehicles')
          .insert([vehicleForm]);
        if (error) throw error;
      }
      resetVehicleForm();
      await loadCustomersAndVehicles(true);
    } catch (error) {
      console.error('Error saving vehicle:', error);
      toast.error(t('customers.vehicle_error_create'));
    }
  }

  async function handleDeleteCustomer(id: string) {
    const confirmed = await confirm({
      title: t('common.confirm_delete'),
      message: t('customers.confirm_delete'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      isDangerous: true,
    });

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await loadCustomersAndVehicles(true);
      toast.success(t('customers.success_deleted'));
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error(t('customers.error_delete'));
    }
  }

  async function handleDeleteVehicle(id: string) {
    const confirmed = await confirm({
      title: t('common.confirm_delete'),
      message: t('customers.confirm_delete_vehicle'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      isDangerous: true,
    });

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await loadCustomersAndVehicles(true);
      toast.success(t('customers.vehicle_success_deleted'));
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      toast.error(t('customers.vehicle_error_delete'));
    }
  }

  function handleEditCustomer(customer: Customer) {
    setEditingCustomerId(customer.id);
    setCustomerForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
    });
    setShowCustomerForm(true);
  }

  function handleEditVehicle(vehicle: Vehicle) {
    setEditingVehicleId(vehicle.id);
    setVehicleForm({
      customer_id: vehicle.customer_id,
      car_make: vehicle.car_make,
      car_model: vehicle.car_model,
      car_year: vehicle.car_year,
      plate_number: vehicle.plate_number,
      notes: vehicle.notes || '',
    });
    setShowVehicleForm(true);
  }

  function handleAddVehicle(customerId: string) {
    setSelectedCustomerId(customerId);
    setVehicleForm({
      customer_id: customerId,
      car_make: '',
      car_model: '',
      car_year: new Date().getFullYear(),
      plate_number: '',
      notes: '',
    });
    setShowVehicleForm(true);
  }

  function resetCustomerForm() {
    setCustomerForm({ name: '', phone: '', email: '' });
    setEditingCustomerId(null);
    setShowCustomerForm(false);
    setNewCustomerVehicles([]);
    setCurrentVehicleForm({
      car_make: '',
      car_model: '',
      car_year: new Date().getFullYear(),
      plate_number: '',
      notes: '',
    });
  }

  function resetVehicleForm() {
    setVehicleForm({
      customer_id: '',
      car_make: '',
      car_model: '',
      car_year: new Date().getFullYear(),
      plate_number: '',
      notes: '',
    });
    setEditingVehicleId(null);
    setShowVehicleForm(false);
    setSelectedCustomerId('');
  }

  const filteredCustomers = customers.filter((customer) => {
    if (!debouncedSearchQuery.trim()) return true;

    const query = debouncedSearchQuery.toLowerCase();

    const matchesName = customer.name.toLowerCase().includes(query);
    const matchesPhone = customer.phone.toLowerCase().includes(query);

    const customerVehicles = vehicles[customer.id] || [];
    const matchesPlateNumber = customerVehicles.some(vehicle =>
      vehicle.plate_number.toLowerCase().includes(query)
    );

    return matchesName || matchesPhone || matchesPlateNumber;
  });

  if (!isAdmin() && !hasPermission('customers')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {t('customers.unauthorized')}
          </h2>
          <p className="text-gray-600">
            {t('customers.unauthorized_message')}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  const canEdit = isAdmin() || hasPermission('customers', true);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{t('customers.title')}</h2>
        {canEdit && (
          <button
            onClick={() => setShowCustomerForm(true)}
            className="flex items-center justify-center space-x-2 space-x-reverse bg-blue-600 text-white px-4 py-3 sm:py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-md text-sm font-medium min-h-[44px]"
          >
            <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
            <span>{t('customers.add_customer')}</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder={t('customers.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="mt-2 text-sm text-gray-600">
            {t('common.results')}: {filteredCustomers.length} {t('nav.customers')}
          </p>
        )}
      </div>

      {showCustomerForm && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            {editingCustomerId ? t('customers.edit_customer') : t('customers.add_customer')}
          </h3>
          <form onSubmit={handleCustomerSubmit} className="space-y-6">
            <div>
              <h4 className="text-lg font-semibold text-gray-700 mb-3">{t('customers.customer_info')}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('customers.name')}</label>
                  <input
                    type="text"
                    required
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('customers.phone')}</label>
                  <input
                    type="tel"
                    required
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('customers.email')} ({t('common.optional')})</label>
                  <input
                    type="email"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {!editingCustomerId && (
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-700">{t('vehicles.title')} ({t('common.optional')})</h4>
                  <span className="text-sm text-gray-500">{t('customers.can_add_multiple_vehicles')}</span>
                </div>

                {newCustomerVehicles.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {newCustomerVehicles.map((vehicle, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-3 space-x-reverse">
                          <Car className="h-5 w-5 text-gray-600" />
                          <div>
                            <p className="font-medium text-gray-800">
                              {vehicle.car_make} {vehicle.car_model} - {vehicle.car_year}
                            </p>
                            <p className="text-sm text-gray-600">{t('vehicles.plate')}: {vehicle.plate_number}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeVehicleFromList(index)}
                          className="text-red-600 hover:bg-red-50 p-2 rounded transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.make')}</label>
                      <input
                        type="text"
                        value={currentVehicleForm.car_make}
                        onChange={(e) => setCurrentVehicleForm({ ...currentVehicleForm, car_make: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder={t('vehicles.make_example')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.model')}</label>
                      <input
                        type="text"
                        value={currentVehicleForm.car_model}
                        onChange={(e) => setCurrentVehicleForm({ ...currentVehicleForm, car_model: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder={t('vehicles.model_example')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.year')}</label>
                      <input
                        type="text"
                        value={currentVehicleForm.car_year}
                        onChange={(e) => {
                          setCurrentVehicleForm({ ...currentVehicleForm, car_year: parseInt(normalizeNumberInput(e.target.value)) || 0 });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.plate_number')}</label>
                      <input
                        type="text"
                        value={currentVehicleForm.plate_number}
                        onChange={(e) => setCurrentVehicleForm({ ...currentVehicleForm, plate_number: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder={t('vehicles.plate_example')}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.notes')} ({t('common.optional')})</label>
                    <input
                      type="text"
                      value={currentVehicleForm.notes}
                      onChange={(e) => setCurrentVehicleForm({ ...currentVehicleForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder={t('vehicles.notes_placeholder')}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addVehicleToList}
                    className="w-full flex items-center justify-center space-x-2 space-x-reverse bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="h-5 w-5" />
                    <span>{t('vehicles.add_to_list')}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex space-x-3 space-x-reverse pt-4 border-t">
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                {editingCustomerId ? t('common.save_changes') : t('customers.save_customer_and_vehicles')}
              </button>
              <button
                type="button"
                onClick={resetCustomerForm}
                className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors font-medium"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {showVehicleForm && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            {editingVehicleId ? t('customers.edit_vehicle') : t('customers.add_vehicle')}
          </h3>
          <form onSubmit={handleVehicleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.make')}</label>
                <input
                  type="text"
                  required
                  value={vehicleForm.car_make}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, car_make: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={t('vehicles.make_example')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.model')}</label>
                <input
                  type="text"
                  required
                  value={vehicleForm.car_model}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, car_model: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={t('vehicles.model_example')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.year')}</label>
                <input
                  type="text"
                  required
                  value={vehicleForm.car_year}
                  onChange={(e) => {
                    setVehicleForm({ ...vehicleForm, car_year: parseInt(normalizeNumberInput(e.target.value)) || 0 });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.plate_number')}</label>
                <input
                  type="text"
                  required
                  value={vehicleForm.plate_number}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, plate_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={t('vehicles.plate_example')}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.notes')} ({t('common.optional')})</label>
                <textarea
                  value={vehicleForm.notes}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder={t('vehicles.notes_placeholder')}
                />
              </div>
            </div>
            <div className="flex space-x-3 space-x-reverse">
              <button
                type="submit"
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                {editingVehicleId ? t('common.save_changes') : t('customers.add_vehicle')}
              </button>
              <button
                type="button"
                onClick={resetVehicleForm}
                className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3 sm:space-y-3">
        {filteredCustomers.map((customer) => (
          <div key={customer.id} className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Desktop/Tablet Layout */}
            <div className="hidden lg:flex items-center">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 min-w-[280px] flex items-center justify-between">
                <div className="flex items-center space-x-3 space-x-reverse">
                  <div className="bg-white rounded-full p-2">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="text-white">
                    <h3 className="text-base font-bold">{customer.name}</h3>
                    <div className="flex flex-col space-y-0.5 mt-1 text-xs">
                      <div className="flex items-center space-x-1 space-x-reverse">
                        <Phone className="h-3 w-3" />
                        <span>{customer.phone}</span>
                      </div>
                      {customer.email && (
                        <div className="flex items-center space-x-1 space-x-reverse">
                          <Mail className="h-3 w-3" />
                          <span className="text-xs">{customer.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col space-y-1">
                  <button
                    onClick={() => handleEditCustomer(customer)}
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-1 rounded transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteCustomer(customer.id)}
                    className="bg-red-500 bg-opacity-80 hover:bg-opacity-100 text-white p-1 rounded transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="flex-1 p-3 flex items-center space-x-3 space-x-reverse overflow-x-auto">
                <div className="flex items-center space-x-2 space-x-reverse text-xs font-semibold text-gray-700 whitespace-nowrap">
                  <Car className="h-4 w-4" />
                  <span>{t('customers.customer_vehicles')} ({vehicles[customer.id]?.length || 0})</span>
                </div>

                {vehicles[customer.id] && vehicles[customer.id].length > 0 ? (
                  <div className="flex space-x-3 space-x-reverse">
                    {vehicles[customer.id].map((vehicle) => (
                      <div
                        key={vehicle.id}
                        className="border border-gray-300 rounded-lg p-2 hover:shadow-md transition-shadow bg-gray-50 min-w-[180px]"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1">
                            <h5 className="font-bold text-gray-800 text-xs">
                              {vehicle.car_make} {vehicle.car_model}
                            </h5>
                            <p className="text-xs text-gray-600">{vehicle.car_year}</p>
                            <p className="text-xs font-medium text-blue-600">
                              {vehicle.plate_number}
                            </p>
                          </div>
                          <div className="flex space-x-1 space-x-reverse">
                            <button
                              onClick={() => handleEditVehicle(vehicle)}
                              className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteVehicle(vehicle.id)}
                              className="text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {vehicle.notes && (
                          <p className="text-xs text-gray-500 mt-1 p-1 bg-white rounded border border-gray-200 truncate">
                            {vehicle.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-gray-500">{t('customers.no_vehicles')}</span>
                )}

                <button
                  onClick={() => handleAddVehicle(customer.id)}
                  className="flex items-center space-x-1 space-x-reverse bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 transition-colors text-xs whitespace-nowrap ml-auto min-h-[36px]"
                >
                  <Plus className="h-3 w-3" />
                  <span>{t('common.add')}</span>
                </button>
              </div>
            </div>

            {/* Mobile Layout */}
            <div className="lg:hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3 space-x-reverse flex-1">
                    <div className="bg-white rounded-full p-2 flex-shrink-0">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="text-white flex-1 min-w-0">
                      <h3 className="text-base font-bold truncate">{customer.name}</h3>
                      <div className="flex flex-col space-y-1 mt-1 text-sm">
                        <div className="flex items-center space-x-1 space-x-reverse">
                          <Phone className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{customer.phone}</span>
                        </div>
                        {customer.email && (
                          <div className="flex items-center space-x-1 space-x-reverse">
                            <Mail className="h-4 w-4 flex-shrink-0" />
                            <span className="text-sm truncate">{customer.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2 space-x-reverse ml-2">
                    <button
                      onClick={() => handleEditCustomer(customer)}
                      className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(customer.id)}
                      className="bg-red-500 bg-opacity-80 hover:bg-opacity-100 text-white p-2 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2 space-x-reverse text-sm font-semibold text-gray-700">
                    <Car className="h-5 w-5" />
                    <span>{t('customers.customer_vehicles')} ({vehicles[customer.id]?.length || 0})</span>
                  </div>
                  <button
                    onClick={() => handleAddVehicle(customer.id)}
                    className="flex items-center space-x-1 space-x-reverse bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm whitespace-nowrap min-h-[44px]"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('common.add')}</span>
                  </button>
                </div>

                {vehicles[customer.id] && vehicles[customer.id].length > 0 ? (
                  <div className="space-y-2">
                    {vehicles[customer.id].map((vehicle) => (
                      <div
                        key={vehicle.id}
                        className="border-2 border-gray-200 rounded-lg p-3 bg-gray-50"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h5 className="font-bold text-gray-800 text-sm truncate">
                              {vehicle.car_make} {vehicle.car_model}
                            </h5>
                            <p className="text-sm text-gray-600">{vehicle.car_year}</p>
                            <p className="text-sm font-medium text-blue-600 truncate">
                              {vehicle.plate_number}
                            </p>
                          </div>
                          <div className="flex space-x-1 space-x-reverse ml-2">
                            <button
                              onClick={() => handleEditVehicle(vehicle)}
                              className="text-blue-600 hover:bg-blue-50 p-2 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                            >
                              <Edit2 className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteVehicle(vehicle.id)}
                              className="text-red-600 hover:bg-red-50 p-2 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                        {vehicle.notes && (
                          <p className="text-sm text-gray-600 mt-2 p-2 bg-white rounded border border-gray-200">
                            {vehicle.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">{t('customers.no_vehicles')}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredCustomers.length === 0 && customers.length > 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <p className="text-gray-500 text-lg">{t('common.no_results_found')}</p>
        </div>
      )}

      {customers.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <p className="text-gray-500 text-lg">{t('customers.no_customers')}</p>
        </div>
      )}

      {hasMore && filteredCustomers.length > 0 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={loadMore}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md font-medium min-h-[44px]"
          >
            {t('common.load_more')}
          </button>
        </div>
      )}

      {ConfirmDialogComponent}
    </div>
  );
}
