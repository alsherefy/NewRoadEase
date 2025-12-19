import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { WorkOrder } from '../types';
import { Plus, Eye, Calendar, Car, User, DollarSign, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useTranslation } from 'react-i18next';
import { displayNumber } from '../utils/numberUtils';

interface WorkOrdersProps {
  onNewOrder: () => void;
  onViewOrder: (orderId: string) => void;
  onEditOrder?: (orderId: string) => void;
}

export function WorkOrders({ onNewOrder, onViewOrder, onEditOrder }: WorkOrdersProps) {
  const { t } = useTranslation();
  const { isCustomerServiceOrAdmin } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; orderId: string; orderNumber: string }>({
    isOpen: false,
    orderId: '',
    orderNumber: '',
  });

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders(resetPage = false) {
    try {
      const currentPage = resetPage ? 0 : page;
      const { data, error, count } = await supabase
        .from('work_orders')
        .select(`
          *,
          customer:customers(id, name, phone),
          vehicle:vehicles(id, car_make, car_model, plate_number)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      if (resetPage) {
        setOrders(data || []);
        setPage(0);
      } else {
        setOrders(prev => currentPage === 0 ? (data || []) : [...prev, ...(data || [])]);
      }

      setHasMore((data?.length || 0) === PAGE_SIZE && ((currentPage + 1) * PAGE_SIZE) < (count || 0));
    } catch (error) {
      console.error('Error loading work orders:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    setPage(prev => prev + 1);
    await loadOrders();
  }

  const handleDeleteClick = (id: string, orderNumber: string) => {
    if (!isCustomerServiceOrAdmin()) {
      toast.error(t('work_orders.error_no_permission_delete'));
      return;
    }

    setDeleteConfirm({
      isOpen: true,
      orderId: id,
      orderNumber: orderNumber,
    });
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('work_orders')
        .delete()
        .eq('id', deleteConfirm.orderId);

      if (error) throw error;

      toast.success(t('work_orders.success_deleted'));
      await loadOrders(true);
    } catch (error) {
      console.error('Error deleting work order:', error);
      toast.error(t('work_orders.error_delete'));
    }
  };

  const filteredOrders = filter === 'all'
    ? orders
    : orders.filter(order => order.status === filter);

  const getStatusBadge = (status: string) => {
    const styles = {
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {t(`status.${status}`)}
      </span>
    );
  };

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{t('work_orders.title')}</h2>
        <button
          onClick={onNewOrder}
          className="flex items-center justify-center space-x-2 space-x-reverse bg-blue-600 text-white px-4 py-3 sm:py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium min-h-[44px]"
        >
          <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
          <span>{t('work_orders.new_order')}</span>
        </button>
      </div>

      <div className="bg-white rounded-lg sm:rounded-xl shadow-md p-3">
        <div className="flex space-x-2 space-x-reverse overflow-x-auto">
          {[
            { value: 'all', label: t('common.all') },
            { value: 'in_progress', label: t('status.in_progress') },
            { value: 'completed', label: t('status.completed') },
            { value: 'cancelled', label: t('status.cancelled') },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setFilter(item.value)}
              className={`px-4 py-2.5 text-sm rounded-lg whitespace-nowrap transition-colors min-h-[44px] ${
                filter === item.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden lg:block bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">{t('work_orders.order_number')}</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">{t('work_orders.customer')}</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">{t('work_orders.vehicle')}</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">{t('common.date')}</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">{t('common.status')}</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">{t('common.cost')}</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    {t('work_orders.no_orders')}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{order.order_number}</div>
                    </td>
                    <td className="px-4 py-3">
                      {order.customer ? (
                        <div>
                          <div className="font-medium text-gray-900">{order.customer.name}</div>
                          <div className="text-sm text-gray-500">{order.customer.phone}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {order.vehicle ? (
                        <div>
                          <div className="text-gray-900">{order.vehicle.car_make} {order.vehicle.car_model}</div>
                          <div className="text-sm text-gray-500">{order.vehicle.plate_number}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(order.created_at).toLocaleDateString('en-US')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-green-600">
                        {displayNumber(order.total_labor_cost)} {t('common.sar')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-center">
                        <button
                          onClick={() => onViewOrder(order.id)}
                          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-2 rounded-lg transition-all"
                          title={t('common.view')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {isCustomerServiceOrAdmin() && onEditOrder && (
                          <button
                            onClick={() => onEditOrder(order.id)}
                            className="inline-flex items-center gap-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 px-3 py-2 rounded-lg transition-all"
                            title={t('common.edit')}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {isCustomerServiceOrAdmin() && (
                          <button
                            onClick={() => handleDeleteClick(order.id, order.order_number)}
                            className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-2 rounded-lg transition-all"
                            title={t('common.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card Layout */}
      <div className="lg:hidden space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <p className="text-gray-500">{t('work_orders.no_orders')}</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 space-x-reverse mb-2">
                      <span className="text-white font-bold text-lg">{order.order_number}</span>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse text-sm text-white">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(order.created_at).toLocaleDateString('en-US')}</span>
                    </div>
                  </div>
                  <div className="text-white text-right">
                    <div className="flex items-center space-x-1 space-x-reverse mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-lg font-bold">{displayNumber(order.total_labor_cost)}</span>
                    </div>
                    <span className="text-xs opacity-90">{t('common.sar')}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {order.customer && (
                  <div className="flex items-start space-x-2 space-x-reverse">
                    <User className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{order.customer.name}</p>
                      <p className="text-sm text-gray-600">{order.customer.phone}</p>
                    </div>
                  </div>
                )}

                {order.vehicle && (
                  <div className="flex items-start space-x-2 space-x-reverse">
                    <Car className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{order.vehicle.car_make} {order.vehicle.car_model}</p>
                      <p className="text-sm text-gray-600">{order.vehicle.plate_number}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => onViewOrder(order.id)}
                    className="flex-1 flex items-center justify-center space-x-2 space-x-reverse bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors min-h-[44px]"
                  >
                    <Eye className="h-5 w-5" />
                    <span className="font-medium">{t('common.view')}</span>
                  </button>
                  {isCustomerServiceOrAdmin() && onEditOrder && (
                    <button
                      onClick={() => onEditOrder(order.id)}
                      className="flex items-center justify-center bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 transition-colors min-h-[44px] min-w-[44px]"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                  )}
                  {isCustomerServiceOrAdmin() && (
                    <button
                      onClick={() => handleDeleteClick(order.id, order.order_number)}
                      className="flex items-center justify-center bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-700 transition-colors min-h-[44px] min-w-[44px]"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {hasMore && filteredOrders.length > 0 && (
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
        title={t('common.confirm_delete')}
        message={t('work_orders.confirm_delete_message', { orderNumber: deleteConfirm.orderNumber })}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm({ isOpen: false, orderId: '', orderNumber: '' })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isDangerous={true}
      />
    </div>
  );
}
