import { Package, AlertTriangle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SparePart {
  id: string;
  part_number: string;
  name: string;
  category: string;
  quantity: number;
  minimum_quantity: number;
  unit_price: number;
}

interface InventoryAlertsPanelProps {
  data: {
    outOfStock: SparePart[];
    lowStock: SparePart[];
    totalLowStockItems: number;
  };
  onViewInventory?: () => void;
}

export default function InventoryAlertsPanel({ data, onViewInventory }: InventoryAlertsPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900">
            {t('dashboard.inventoryAlerts')}
          </h3>
        </div>
        <span className="text-sm text-gray-600">
          {data.totalLowStockItems} {t('dashboard.items')}
        </span>
      </div>

      <div className="space-y-4">
        {data.outOfStock.length === 0 && data.lowStock.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            {t('dashboard.noInventoryAlerts')}
          </p>
        ) : (
          <>
            {data.outOfStock.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-red-600 mb-3 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  {t('dashboard.outOfStock')}
                </h4>
                <div className="space-y-2">
                  {data.outOfStock.slice(0, 3).map((part) => (
                    <div
                      key={part.id}
                      onClick={onViewInventory}
                      className="p-3 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:bg-red-100 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{part.name}</p>
                          <p className="text-sm text-gray-600">{part.part_number}</p>
                        </div>
                        <span className="text-xs font-medium text-red-600 bg-white px-2 py-1 rounded">
                          {t('dashboard.stockOut')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.lowStock.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-yellow-600 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {t('dashboard.lowStock')}
                </h4>
                <div className="space-y-2">
                  {data.lowStock.slice(0, 3).map((part) => (
                    <div
                      key={part.id}
                      onClick={onViewInventory}
                      className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg cursor-pointer hover:bg-yellow-100 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{part.name}</p>
                          <p className="text-sm text-gray-600">{part.part_number}</p>
                        </div>
                        <span className="text-xs font-medium text-yellow-600 bg-white px-2 py-1 rounded">
                          {part.quantity} / {part.minimum_quantity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {data.totalLowStockItems > 6 && (
        <button
          onClick={onViewInventory}
          className="w-full mt-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {t('dashboard.viewAll')}
        </button>
      )}
    </div>
  );
}
