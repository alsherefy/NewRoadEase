import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, Save, Building2, Mail, Phone, MapPin, FileText, Receipt, Percent } from 'lucide-react';
import { settingsService, ServiceError } from '../services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { normalizeNumberInput } from '../utils/numberUtils';

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
  tax_type: 'inclusive' | 'exclusive';
}

export function Settings() {
  const { t } = useTranslation();
  const { hasPermission, isAdmin } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState<WorkshopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    email: '',
    tax_number: '',
    commercial_registration: '',
    tax_enabled: true,
    tax_rate: 15,
    tax_type: 'exclusive' as 'inclusive' | 'exclusive',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await settingsService.getWorkshopSettings();

      if (data) {
        setSettings(data);
        setFormData({
          name: data.name || '',
          phone: data.phone || '',
          address: data.address || '',
          email: data.email || '',
          tax_number: data.tax_number || '',
          commercial_registration: data.commercial_registration || '',
          tax_enabled: data.tax_enabled ?? true,
          tax_rate: data.tax_rate ?? 15,
          tax_type: data.tax_type || 'exclusive',
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isAdmin() && !hasPermission('settings', true)) {
      toast.error(t('settings.no_permission_error'));
      return;
    }

    setSaving(true);

    try {
      if (settings?.id) {
        await settingsService.updateWorkshopSettings(settings.id, {
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          email: formData.email,
          tax_number: formData.tax_number,
          commercial_registration: formData.commercial_registration,
          tax_enabled: formData.tax_enabled,
          tax_rate: formData.tax_rate,
          tax_type: formData.tax_type,
        });
      } else {
        await settingsService.createWorkshopSettings(formData);
      }

      toast.success(t('settings.success_updated'));
      await loadSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(t('settings.error_update'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-600">{t('common.loading')}</div>
      </div>
    );
  }

  const canEdit = isAdmin() || hasPermission('settings', true);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-blue-600" />
          <h2 className="text-3xl font-bold text-gray-800">{t('settings.title')}</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="h-6 w-6 text-blue-600" />
            <h3 className="text-xl font-bold text-gray-800">{t('settings.workshop_info')}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('settings.workshop_name')}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={!canEdit}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {t('settings.phone')}
                </div>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={!canEdit}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {t('settings.email')}
                </div>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!canEdit}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {t('settings.address')}
                </div>
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                disabled={!canEdit}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  {t('settings.tax_number')}
                </div>
              </label>
              <input
                type="text"
                value={formData.tax_number}
                onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                disabled={!canEdit}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {t('settings.commercial_registration')}
                </div>
              </label>
              <input
                type="text"
                value={formData.commercial_registration}
                onChange={(e) => setFormData({ ...formData, commercial_registration: e.target.value })}
                disabled={!canEdit}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-6">
            <Percent className="h-6 w-6 text-green-600" />
            <h3 className="text-xl font-bold text-gray-800">{t('settings.tax_settings')}</h3>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-800">{t('settings.enable_tax')}</p>
                <p className="text-sm text-gray-600">
                  {t('settings.enable_tax_description')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.tax_enabled}
                  onChange={(e) => setFormData({ ...formData, tax_enabled: e.target.checked })}
                  disabled={!canEdit}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"></div>
              </label>
            </div>

            {formData.tax_enabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    {t('settings.tax_type')}
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label
                      className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        formData.tax_type === 'exclusive'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 bg-white hover:border-gray-400'
                      } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="radio"
                        name="tax_type"
                        value="exclusive"
                        checked={formData.tax_type === 'exclusive'}
                        onChange={(e) => setFormData({ ...formData, tax_type: e.target.value as 'exclusive' })}
                        disabled={!canEdit}
                        className="sr-only"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              formData.tax_type === 'exclusive'
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-300'
                            }`}
                          >
                            {formData.tax_type === 'exclusive' && (
                              <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                            )}
                          </div>
                          <span className="font-semibold text-gray-800">{t('settings.tax_exclusive')}</span>
                        </div>
                        <p className="text-sm text-gray-600 mr-7">
                          {t('settings.tax_exclusive_example')}
                        </p>
                      </div>
                    </label>

                    <label
                      className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        formData.tax_type === 'inclusive'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 bg-white hover:border-gray-400'
                      } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="radio"
                        name="tax_type"
                        value="inclusive"
                        checked={formData.tax_type === 'inclusive'}
                        onChange={(e) => setFormData({ ...formData, tax_type: e.target.value as 'inclusive' })}
                        disabled={!canEdit}
                        className="sr-only"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              formData.tax_type === 'inclusive'
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-300'
                            }`}
                          >
                            {formData.tax_type === 'inclusive' && (
                              <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                            )}
                          </div>
                          <span className="font-semibold text-gray-800">{t('settings.tax_inclusive')}</span>
                        </div>
                        <p className="text-sm text-gray-600 mr-7">
                          {t('settings.tax_inclusive_example')}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.tax_percentage')}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={formData.tax_rate}
                      onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(normalizeNumberInput(e.target.value)) || 0 })}
                      disabled={!canEdit}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    />
                    <span className="text-gray-600 font-medium">%</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {t('settings.default_value')}: 15%
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-5 w-5" />
              {saving ? t('settings.saving') : t('settings.save_settings')}
            </button>
          </div>
        )}

        {!canEdit && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-center">
              {t('settings.no_permission_warning')}
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
