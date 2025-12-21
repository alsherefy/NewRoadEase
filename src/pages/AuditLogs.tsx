import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Search, Filter, Calendar, User, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_email?: string;
}

export default function AuditLogs() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedResource, setSelectedResource] = useState<string>('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const logsPerPage = 20;

  useEffect(() => {
    loadLogs();
  }, [currentPage, selectedAction, selectedResource]);

  const loadLogs = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('rbac_audit_logs')
        .select('*, users!inner(email)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * logsPerPage, currentPage * logsPerPage - 1);

      if (selectedAction !== 'all') {
        query = query.eq('action', selectedAction);
      }

      if (selectedResource !== 'all') {
        query = query.eq('resource_type', selectedResource);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      const logsWithEmail = (data || []).map(log => ({
        ...log,
        user_email: log.users?.email || 'Unknown'
      }));

      setLogs(logsWithEmail);
      setTotalLogs(count || 0);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      showToast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const actions = Array.from(new Set(logs.map(log => log.action))).sort();
  const resources = Array.from(new Set(logs.map(log => log.resource_type))).sort();

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resource_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resource_id?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const getActionColor = (action: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      create: { bg: 'bg-green-100', text: 'text-green-800' },
      update: { bg: 'bg-blue-100', text: 'text-blue-800' },
      delete: { bg: 'bg-red-100', text: 'text-red-800' },
      grant: { bg: 'bg-purple-100', text: 'text-purple-800' },
      revoke: { bg: 'bg-orange-100', text: 'text-orange-800' },
      login: { bg: 'bg-gray-100', text: 'text-gray-800' },
    };
    return colors[action.toLowerCase()] || { bg: 'bg-gray-100', text: 'text-gray-800' };
  };

  const getActionIcon = (action: string) => {
    return action.charAt(0).toUpperCase();
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleExpanded = (logId: string) => {
    setExpandedLog(expandedLog === logId ? null : logId);
  };

  const totalPages = Math.ceil(totalLogs / logsPerPage);

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
            <FileText className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('admin.audit.title')}</h1>
            <p className="text-gray-600 mt-1">{t('admin.audit.subtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('admin.audit.totalLogs')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{totalLogs}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('admin.audit.currentPage')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{currentPage}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('admin.audit.actions')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{actions.length}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <Activity className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('admin.audit.resources')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{resources.length}</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <Filter className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder={t('admin.audit.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="all">{t('admin.audit.allActions')}</option>
            {actions.map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>

          <select
            value={selectedResource}
            onChange={(e) => {
              setSelectedResource(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="all">{t('admin.audit.allResources')}</option>
            {resources.map(resource => (
              <option key={resource} value={resource}>{resource}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t('admin.audit.noLogs')}
              </h3>
              <p className="text-gray-600">{t('admin.audit.noLogsDescription')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredLogs.map((log) => {
                const actionColors = getActionColor(log.action);
                const isExpanded = expandedLog === log.id;

                return (
                  <div key={log.id} className="hover:bg-gray-50 transition-colors">
                    <div
                      className="px-6 py-4 cursor-pointer"
                      onClick={() => toggleExpanded(log.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className={`${actionColors.bg} p-2 rounded-lg`}>
                            <span className={`${actionColors.text} font-bold text-sm`}>
                              {getActionIcon(log.action)}
                            </span>
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <span className={`px-3 py-1 text-xs font-medium ${actionColors.bg} ${actionColors.text} rounded-full`}>
                                {log.action}
                              </span>
                              <span className="text-sm text-gray-900 font-medium">
                                {log.resource_type}
                              </span>
                              {log.resource_id && (
                                <code className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                  {log.resource_id.substring(0, 8)}
                                </code>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                {log.user_email}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {formatDate(log.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-600" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-600" />
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-6 pb-4 border-t border-gray-100 bg-gray-50">
                        <div className="pt-4 space-y-3">
                          {log.ip_address && (
                            <div>
                              <span className="text-xs font-medium text-gray-600">
                                {t('admin.audit.ipAddress')}:
                              </span>
                              <code className="ml-2 text-xs text-gray-900 bg-white px-2 py-1 rounded border border-gray-200">
                                {log.ip_address}
                              </code>
                            </div>
                          )}

                          {log.old_values && Object.keys(log.old_values).length > 0 && (
                            <div>
                              <span className="text-xs font-medium text-gray-600 block mb-2">
                                {t('admin.audit.oldValues')}:
                              </span>
                              <pre className="text-xs bg-white p-3 rounded border border-gray-200 overflow-x-auto">
                                {JSON.stringify(log.old_values, null, 2)}
                              </pre>
                            </div>
                          )}

                          {log.new_values && Object.keys(log.new_values).length > 0 && (
                            <div>
                              <span className="text-xs font-medium text-gray-600 block mb-2">
                                {t('admin.audit.newValues')}:
                              </span>
                              <pre className="text-xs bg-white p-3 rounded border border-gray-200 overflow-x-auto">
                                {JSON.stringify(log.new_values, null, 2)}
                              </pre>
                            </div>
                          )}

                          {log.user_agent && (
                            <div>
                              <span className="text-xs font-medium text-gray-600">
                                {t('admin.audit.userAgent')}:
                              </span>
                              <p className="ml-2 text-xs text-gray-700 bg-white px-2 py-1 rounded border border-gray-200 mt-1">
                                {log.user_agent}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {t('admin.audit.showing')} {(currentPage - 1) * logsPerPage + 1} - {Math.min(currentPage * logsPerPage, totalLogs)} {t('admin.audit.of')} {totalLogs}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('admin.audit.previous')}
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        currentPage === pageNum
                          ? 'bg-orange-600 text-white'
                          : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('admin.audit.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
