import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  BarChart3,
  UserCircle,
  Package,
  LogOut,
  Shield,
  Users as UsersIcon,
  Settings as SettingsIcon,
  Receipt,
  Menu,
  X,
  Car,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PermissionKey } from '../types';
import { useConfirm } from '../hooks/useConfirm';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Navbar({ activeTab, setActiveTab }: NavbarProps) {
  const { user, signOut, hasPermission, isAdmin } = useAuth();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tabs: Array<{
    id: string;
    label: string;
    icon: any;
    permission?: PermissionKey;
  }> = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, permission: 'dashboard' },
    { id: 'customers', label: t('nav.customers'), icon: UserCircle, permission: 'customers' },
    { id: 'technicians', label: t('nav.technicians'), icon: Users, permission: 'technicians' },
    { id: 'work-orders', label: t('nav.work_orders'), icon: ClipboardList, permission: 'work_orders' },
    { id: 'invoices', label: t('nav.invoices'), icon: FileText, permission: 'invoices' },
    { id: 'inventory', label: t('nav.inventory'), icon: Package, permission: 'inventory' },
    { id: 'expenses', label: t('nav.expenses'), icon: Receipt, permission: 'expenses' },
    { id: 'reports', label: t('nav.reports'), icon: BarChart3, permission: 'reports' },
    { id: 'settings', label: t('nav.settings'), icon: SettingsIcon, permission: 'settings' },
  ];

  if (isAdmin()) {
    tabs.push(
      { id: 'users', label: t('nav.users'), icon: UsersIcon, permission: 'users' },
      { id: 'roles-management', label: t('nav.rolesManagement'), icon: Shield },
      { id: 'permissions-overview', label: t('nav.permissionsOverview'), icon: Shield },
      { id: 'audit-logs', label: t('nav.auditLogs'), icon: FileText }
    );
  }

  const visibleTabs = tabs.filter(
    (tab) => !tab.permission || hasPermission(tab.permission)
  );

  async function handleSignOut() {
    const confirmed = await confirm({
      title: t('auth.confirm_logout'),
      message: t('auth.confirm_logout_message'),
      confirmText: t('auth.logout'),
      cancelText: t('common.cancel'),
      isDangerous: false,
    });
    if (confirmed) {
      await signOut();
      setMobileMenuOpen(false);
    }
  }

  function handleTabClick(tabId: string) {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  }

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg no-print">
      <div className="container mx-auto px-3 sm:px-4">
        {/* Mobile/Tablet Header */}
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Car className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            <h1 className="text-white text-base sm:text-xl font-bold truncate max-w-[120px] sm:max-w-none">
              {t('app.name')}
            </h1>
          </div>

          {/* Desktop User Info */}
          <div className="hidden lg:flex items-center gap-3">
            <LanguageSwitcher />
            <div className="flex items-center gap-3 bg-blue-800 bg-opacity-50 px-4 py-2 rounded-lg">
              {user?.role === 'admin' ? (
                <Shield className="h-5 w-5 text-yellow-300" />
              ) : (
                <UserCircle className="h-5 w-5 text-white" />
              )}
              <div className="text-right">
                <p className="text-white font-medium text-sm">{user?.full_name}</p>
                <p className="text-blue-200 text-xs">
                  {user?.role === 'admin' ? t('roles.admin.name') : user?.role === 'customer_service' ? t('roles.customer_service.name') : t('roles.receptionist.name')}
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-sm font-medium">{t('auth.logout')}</span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <LanguageSwitcher />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-white hover:bg-blue-800 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <div className="hidden lg:flex space-x-1 space-x-reverse overflow-x-auto pb-2">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 space-x-reverse px-4 py-2 rounded-t-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-700 font-semibold'
                    : 'bg-blue-500 text-white hover:bg-blue-400'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Slide-out Menu */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Mobile Menu Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2 space-x-reverse text-white">
                <Car className="h-6 w-6" />
                <span className="font-bold text-lg">{t('app.name')}</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-white hover:bg-blue-800 rounded transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* User Info in Mobile Menu */}
            <div className="flex items-center gap-3 bg-blue-800 bg-opacity-50 px-3 py-2 rounded-lg">
              {user?.role === 'admin' ? (
                <Shield className="h-5 w-5 text-yellow-300 flex-shrink-0" />
              ) : (
                <UserCircle className="h-5 w-5 text-white flex-shrink-0" />
              )}
              <div>
                <p className="text-white font-medium text-sm">{user?.full_name}</p>
                <p className="text-blue-200 text-xs">
                  {user?.role === 'admin' ? t('roles.admin.name') : user?.role === 'customer_service' ? t('roles.customer_service.name') : t('roles.receptionist.name')}
                </p>
              </div>
            </div>
          </div>

          {/* Mobile Menu Items */}
          <div className="flex-1 overflow-y-auto">
            <nav className="py-2">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={`w-full flex items-center space-x-3 space-x-reverse px-4 py-3 transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600 font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="text-base">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Mobile Menu Footer */}
          <div className="border-t border-gray-200 p-4">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-lg transition-colors font-medium"
            >
              <LogOut className="h-5 w-5" />
              <span>{t('auth.logout')}</span>
            </button>
          </div>
        </div>
      </div>

      {ConfirmDialogComponent}
    </nav>
  );
}
