import { Wrench, Clock, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface WorkOrder {
  id: string;
  order_number: string;
  status: string;
  description: string;
  total_labor_cost: number;
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

interface OpenOrdersPanelProps {
  data: {
    inProgress: WorkOrder[];
    pending: WorkOrder[];
    totalCount: number;
  };
  onViewOrder?: (orderId: string) => void;
  onViewAll?: () => void;
}

export default function OpenOrdersPanel({ data, onViewOrder, onViewAll }: OpenOrdersPanelProps) {
  const { t } = useTranslation();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in_progress':
        return t('status.in_progress');
      case 'pending':
        return t('status.pending');
      default:
        return status;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900">
            {t('dashboard.openOrders')}
          </h3>
        </div>
        <span className="text-sm text-gray-600">
          {data.totalCount} {t('dashboard.total')}
        </span>
      </div>

      <div className="space-y-4">
        {data.inProgress.length === 0 && data.pending.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            {t('dashboard.noOpenOrders')}
          </p>
        ) : (
          <>
            {[...data.inProgress, ...data.pending].slice(0, 5).map((order) => (
              <div
                key={order.id}
                onClick={() => onViewOrder?.(order.id)}
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all duration-200 cursor-pointer hover:bg-blue-50"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">
                        {order.order_number}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {order.customers.name}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span>{new Date(order.created_at).toLocaleDateString('ar')}</span>
                </div>
                <p className="text-sm text-gray-700 mt-2 line-clamp-1">
                  {order.vehicles.car_make} {order.vehicles.car_model} -{' '}
                  {order.vehicles.plate_number}
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
