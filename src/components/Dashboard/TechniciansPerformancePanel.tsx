import { Users, Award } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Technician {
  id: string;
  name: string;
  specialization: string;
  contract_type: string;
  is_active: boolean;
}

interface TechniciansPerformancePanelProps {
  data: {
    activeTechnicians: number;
    technicians: Technician[];
  };
  onViewTechnicians?: () => void;
}

export default function TechniciansPerformancePanel({ data, onViewTechnicians }: TechniciansPerformancePanelProps) {
  const { t } = useTranslation();

  const getSpecializationLabel = (spec: string) => {
    const labels: Record<string, string> = {
      electrician: t('technicians.specializations.electrician'),
      mechanic: t('technicians.specializations.mechanic'),
      bodywork: t('technicians.specializations.bodywork'),
      painting: t('technicians.painting'),
      ac: t('technicians.ac'),
    };
    return labels[spec] || spec;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900">
            {t('dashboard.techniciansPerformance')}
          </h3>
        </div>
        <span className="text-sm text-gray-600">
          {data.activeTechnicians} {t('dashboard.active')}
        </span>
      </div>

      <div className="space-y-3">
        {data.technicians.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            {t('dashboard.noTechnicians')}
          </p>
        ) : (
          <>
            {data.technicians.slice(0, 5).map((technician, index) => (
              <div
                key={technician.id}
                onClick={onViewTechnicians}
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all duration-200 cursor-pointer hover:bg-blue-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-lg font-semibold text-blue-600">
                        {technician.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{technician.name}</p>
                      <p className="text-sm text-gray-600">
                        {getSpecializationLabel(technician.specialization)}
                      </p>
                    </div>
                  </div>
                  {index < 3 && (
                    <Award className="w-5 h-5 text-yellow-500" />
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {data.technicians.length > 5 && (
        <button
          onClick={onViewTechnicians}
          className="w-full mt-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {t('dashboard.viewAll')}
        </button>
      )}
    </div>
  );
}
