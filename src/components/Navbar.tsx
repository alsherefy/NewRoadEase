import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  BarChart3,
  UserCircle,
  Package,
  LogOut,
  Users as UsersIcon,
  Settings as SettingsIcon,
  Receipt,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PermissionKey } from '../types';
import { useConfirm } from '../hooks/useConfirm';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Navbar() {
  const { user, signOut, hasPermission, isAdmin, userRoles } = useAuth();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const getUserRole = () => {
    if (!userRoles || userRoles.length === 0) return 'receptionist';
    const role = userRoles[0]?.role?.key;
    return role || 'receptionist';
  };

  const userRole = getUserRole();

  const tabs: Array<{
    id: string;
    path: string;
    label: string;
    icon: any;
    permission?: PermissionKey;
  }> = [
    { id: 'dashboard', path: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, permission: 'dashboard' },
    { id: 'customers', path: '/customers', label: t('nav.customers'), icon: UserCircle, permission: 'customers' },
    { id: 'technicians', path: '/technicians', label: t('nav.technicians'), icon: Users, permission: 'technicians' },
    { id: 'work-orders', path: '/work-orders', label: t('nav.work_orders'), icon: ClipboardList, permission: 'work_orders' },
    { id: 'invoices', path: '/invoices', label: t('nav.invoices'), icon: FileText, permission: 'invoices' },
    { id: 'inventory', path: '/inventory', label: t('nav.inventory'), icon: Package, permission: 'inventory' },
    { id: 'expenses', path: '/expenses', label: t('nav.expenses'), icon: Receipt, permission: 'expenses' },
    { id: 'reports', path: '/reports', label: t('nav.reports'), icon: BarChart3, permission: 'reports' },
    { id: 'settings', path: '/settings', label: t('nav.settings'), icon: SettingsIcon, permission: 'settings' },
  ];

  if (isAdmin()) {
    tabs.push({ id: 'users', path: '/users', label: t('nav.users'), icon: UsersIcon, permission: 'users' });
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
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'customer_service':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'receptionist':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const isActive = (path: string) => {
    if (path === '/dashboard' && location.pathname === '/') return true;
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <nav className="bg-white border-b border-gray-200 shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700" />
                ) : (
                  <Menu className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700" />
                )}
              </button>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-1.5 sm:p-2 rounded-lg shadow-lg">
                  <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                    {t('app.title')}
                  </h1>
                  <p className="text-[10px] sm:text-xs text-gray-600 leading-none hidden sm:block">
                    {t('app.subtitle')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <LanguageSwitcher />

              <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-50 rounded-lg border border-gray-200">
                <UserCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                <div className="hidden sm:block">
                  <p className="text-xs sm:text-sm font-semibold text-gray-900 leading-tight">
                    {user?.full_name}
                  </p>
                  <span
                    className={`inline-block text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded border ${getRoleBadgeColor(
                      userRole
                    )}`}
                  >
                    {t(`roles.${userRole}`)}
                  </span>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                title={t('auth.logout')}
              >
                <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-1 pb-2 overflow-x-auto">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const active = isActive(tab.path);
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.path)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
                    active
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white">
            <div className="container mx-auto px-3 py-2 space-y-1">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                const active = isActive(tab.path);
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      navigate(tab.path);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all ${
                      active
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>
      {ConfirmDialogComponent}
    </>
  );
}
