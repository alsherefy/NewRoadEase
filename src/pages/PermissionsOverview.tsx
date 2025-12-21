import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Search, Shield, Grid, List } from 'lucide-react';
import { permissionsService } from '../services/permissionsService';
import { translatePermission, translatePermissionDescription } from '../utils/translationHelpers';
import type { Permission } from '../types';
import { useToast } from '../contexts/ToastContext';

type ViewMode = 'grid' | 'list';

export default function PermissionsOverview() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const data = await permissionsService.getAllPermissions();
      setPermissions(data);
    } catch (error) {
      showToast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const categories = Array.from(new Set(permissions.map(p => p.category))).sort();

  const filteredPermissions = permissions.filter(permission => {
    const matchesSearch =
      permission.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      translatePermission(permission.key, t).toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || permission.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const groupedPermissions = filteredPermissions.reduce((acc, permission) => {
    const category = permission.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      general: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
      operations: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
      financial: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
      management: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
      system: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    };
    return colors[category] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
  };

  const getResourceIcon = (resource: string) => {
    return resource.charAt(0).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-3 rounded-xl shadow-lg">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('admin.permissions.title')}</h1>
            <p className="text-gray-600 mt-1">{t('admin.permissions.subtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('admin.permissions.totalPermissions')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{permissions.length}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('admin.permissions.categories')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{categories.length}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Grid className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('admin.permissions.resources')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {new Set(permissions.map(p => p.resource)).size}
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('admin.permissions.filtered')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{filteredPermissions.length}</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <Search className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex-1 flex gap-4 flex-col md:flex-row w-full md:w-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={t('admin.permissions.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="all">{t('admin.permissions.allCategories')}</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {t(`permissions.categories.${category}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-orange-100 text-orange-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-orange-100 text-orange-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedPermissions).map(([category, perms]) => {
          const colors = getCategoryColor(category);
          return (
            <div key={category} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className={`${colors.bg} border-b ${colors.border} px-6 py-4`}>
                <h2 className={`text-lg font-semibold ${colors.text} uppercase tracking-wide`}>
                  {t(`permissions.categories.${category}`)}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {perms.length} {t('admin.permissions.permissionsInCategory')}
                </p>
              </div>

              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                  {perms
                    .sort((a, b) => a.display_order - b.display_order)
                    .map((permission) => (
                      <div
                        key={permission.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-orange-300 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`${colors.bg} p-2 rounded-lg flex-shrink-0`}>
                            <span className={`${colors.text} font-bold text-sm`}>
                              {getResourceIcon(permission.resource)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 text-sm mb-1">
                              {translatePermission(permission.key, t)}
                            </h3>
                            <p className="text-xs text-gray-500 mb-2 font-mono bg-gray-50 px-2 py-1 rounded">
                              {permission.key}
                            </p>
                            <div className="flex gap-2 text-xs">
                              <span className={`px-2 py-1 ${colors.bg} ${colors.text} rounded-full`}>
                                {permission.resource}
                              </span>
                              <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                                {permission.action}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {perms
                    .sort((a, b) => a.display_order - b.display_order)
                    .map((permission) => (
                      <div
                        key={permission.id}
                        className="px-6 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <div className={`${colors.bg} p-2 rounded-lg`}>
                              <span className={`${colors.text} font-bold text-sm`}>
                                {getResourceIcon(permission.resource)}
                              </span>
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900">
                                {translatePermission(permission.key, t)}
                              </h3>
                              <p className="text-sm text-gray-500 mt-1">
                                {translatePermissionDescription(permission.key, t)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <code className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded font-mono">
                              {permission.key}
                            </code>
                            <div className="flex gap-2">
                              <span className={`px-3 py-1 text-xs ${colors.bg} ${colors.text} rounded-full`}>
                                {permission.resource}
                              </span>
                              <span className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                                {permission.action}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredPermissions.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
          <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('admin.permissions.noResults')}
          </h3>
          <p className="text-gray-600">
            {t('admin.permissions.tryDifferentSearch')}
          </p>
        </div>
      )}
    </div>
  );
}
