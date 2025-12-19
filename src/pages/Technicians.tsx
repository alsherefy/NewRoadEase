import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Technician } from '../types';
import { Users, DollarSign, Trophy, BarChart3 } from 'lucide-react';
import { TechniciansList } from '../components/TechniciansList';
import { SalariesManagement } from '../components/SalariesManagement';
import { EvaluationManagement } from '../components/EvaluationManagement';
import { TechnicianReports } from '../components/TechnicianReports';
import { useTranslation } from 'react-i18next';

type TabType = 'technicians' | 'salaries' | 'evaluation' | 'reports';

export function Technicians() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('technicians');
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTechnicians();
  }, []);

  async function loadTechnicians() {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTechnicians(data || []);
    } catch (error) {
      console.error('Error loading technicians:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-800">{t('technicians.title')}</h2>
      </div>

      <div className="bg-white rounded-xl shadow-md">
        <div className="border-b border-gray-200">
          <div className="flex space-x-1 space-x-reverse">
            <button
              onClick={() => setActiveTab('technicians')}
              className={`flex items-center space-x-2 space-x-reverse px-6 py-4 font-medium transition-colors ${
                activeTab === 'technicians'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Users className="h-5 w-5" />
              <span>{t('technicians.tab_technicians')}</span>
            </button>
            <button
              onClick={() => setActiveTab('salaries')}
              className={`flex items-center space-x-2 space-x-reverse px-6 py-4 font-medium transition-colors ${
                activeTab === 'salaries'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <DollarSign className="h-5 w-5" />
              <span>{t('technicians.tab_salaries')}</span>
            </button>
            <button
              onClick={() => setActiveTab('evaluation')}
              className={`flex items-center space-x-2 space-x-reverse px-6 py-4 font-medium transition-colors ${
                activeTab === 'evaluation'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Trophy className="h-5 w-5" />
              <span>{t('technicians.tab_evaluation')}</span>
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center space-x-2 space-x-reverse px-6 py-4 font-medium transition-colors ${
                activeTab === 'reports'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <BarChart3 className="h-5 w-5" />
              <span>{t('technicians.tab_reports')}</span>
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'technicians' && (
            <TechniciansList technicians={technicians} onUpdate={loadTechnicians} />
          )}
          {activeTab === 'salaries' && (
            <SalariesManagement technicians={technicians} />
          )}
          {activeTab === 'evaluation' && (
            <EvaluationManagement technicians={technicians} />
          )}
          {activeTab === 'reports' && (
            <TechnicianReports technicians={technicians} />
          )}
        </div>
      </div>
    </div>
  );
}
