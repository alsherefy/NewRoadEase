import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { Customers } from './pages/Customers';
import { Technicians } from './pages/Technicians';
import { WorkOrders } from './pages/WorkOrders';
import { NewWorkOrder } from './pages/NewWorkOrder';
import { WorkOrderDetails } from './pages/WorkOrderDetails';
import { Invoices } from './pages/Invoices';
import { NewInvoice } from './pages/NewInvoice';
import { InvoiceDetails } from './pages/InvoiceDetails';
import { Reports } from './pages/Reports';
import { Inventory } from './pages/Inventory';
import { Expenses } from './pages/Expenses';
import { Users } from './pages/Users';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { Loader } from 'lucide-react';

type ViewType =
  | 'dashboard'
  | 'customers'
  | 'technicians'
  | 'work-orders'
  | 'new-work-order'
  | 'work-order-details'
  | 'invoices'
  | 'new-invoice'
  | 'invoice-details'
  | 'inventory'
  | 'expenses'
  | 'reports'
  | 'users'
  | 'settings';

function AppContent() {
  const { user, loading, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<ViewType>('dashboard');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');

  const getDefaultAllowedTab = (): ViewType => {
    const tabPermissions: Array<{ tab: ViewType; permission: string }> = [
      { tab: 'dashboard', permission: 'dashboard' },
      { tab: 'customers', permission: 'customers' },
      { tab: 'work-orders', permission: 'work_orders' },
      { tab: 'invoices', permission: 'invoices' },
      { tab: 'inventory', permission: 'inventory' },
      { tab: 'expenses', permission: 'expenses' },
      { tab: 'reports', permission: 'reports' },
      { tab: 'technicians', permission: 'technicians' },
      { tab: 'settings', permission: 'settings' },
      { tab: 'users', permission: 'users' },
    ];

    for (const { tab, permission } of tabPermissions) {
      if (hasPermission(permission as any)) {
        return tab;
      }
    }

    return 'dashboard';
  };

  useEffect(() => {
    if (user && !loading) {
      const currentTabPermission = getTabPermission(activeTab);
      if (currentTabPermission && !hasPermission(currentTabPermission as any)) {
        const defaultTab = getDefaultAllowedTab();
        setActiveTab(defaultTab);
      }
    }
  }, [user, loading]);

  const getTabPermission = (tab: ViewType): string | null => {
    const permissionMap: Record<ViewType, string | null> = {
      'dashboard': 'dashboard',
      'customers': 'customers',
      'work-orders': 'work_orders',
      'new-work-order': 'work_orders',
      'work-order-details': 'work_orders',
      'invoices': 'invoices',
      'new-invoice': 'invoices',
      'invoice-details': 'invoices',
      'inventory': 'inventory',
      'expenses': 'expenses',
      'reports': 'reports',
      'technicians': 'technicians',
      'settings': 'settings',
      'users': 'users',
    };
    return permissionMap[tab] || null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="text-center">
          <Loader className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'customers':
        return <Customers />;
      case 'technicians':
        return <Technicians />;
      case 'work-orders':
        return (
          <WorkOrders
            onNewOrder={() => {
              setSelectedOrderId('');
              setActiveTab('new-work-order');
            }}
            onViewOrder={(orderId) => {
              setSelectedOrderId(orderId);
              setActiveTab('work-order-details');
            }}
            onEditOrder={(orderId) => {
              setSelectedOrderId(orderId);
              setActiveTab('new-work-order');
            }}
          />
        );
      case 'new-work-order':
        return (
          <NewWorkOrder
            orderId={selectedOrderId}
            onBack={() => {
              setSelectedOrderId('');
              setActiveTab('work-orders');
            }}
            onSuccess={() => {
              setSelectedOrderId('');
              setActiveTab('work-orders');
            }}
          />
        );
      case 'work-order-details':
        return (
          <WorkOrderDetails
            orderId={selectedOrderId}
            onBack={() => setActiveTab('work-orders')}
            onViewInvoice={(invoiceId) => {
              setSelectedInvoiceId(invoiceId);
              setActiveTab('invoice-details');
            }}
          />
        );
      case 'invoices':
        return (
          <Invoices
            onNewInvoice={() => {
              setSelectedInvoiceId('');
              setActiveTab('new-invoice');
            }}
            onViewInvoice={(invoiceId) => {
              setSelectedInvoiceId(invoiceId);
              setActiveTab('invoice-details');
            }}
            onEditInvoice={(invoiceId) => {
              setSelectedInvoiceId(invoiceId);
              setActiveTab('new-invoice');
            }}
          />
        );
      case 'new-invoice':
        return (
          <NewInvoice
            invoiceId={selectedInvoiceId}
            onBack={() => {
              setSelectedInvoiceId('');
              setActiveTab('invoices');
            }}
            onSuccess={() => {
              setSelectedInvoiceId('');
              setActiveTab('invoices');
            }}
          />
        );
      case 'invoice-details':
        return (
          <InvoiceDetails
            invoiceId={selectedInvoiceId}
            onBack={() => setActiveTab('invoices')}
          />
        );
      case 'inventory':
        return <Inventory />;
      case 'expenses':
        return <Expenses />;
      case 'reports':
        return <Reports />;
      case 'users':
        return <Users />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Navbar activeTab={activeTab} setActiveTab={(tab) => setActiveTab(tab as ViewType)} />
      <main className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        {renderContent()}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
