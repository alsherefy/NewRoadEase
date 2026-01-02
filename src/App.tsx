import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import UserPermissions from './pages/UserPermissions';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { Loader } from 'lucide-react';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

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
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
              <Navbar />
              <main className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/technicians" element={<Technicians />} />
                  <Route path="/work-orders" element={<WorkOrders />} />
                  <Route path="/work-orders/new" element={<NewWorkOrder />} />
                  <Route path="/work-orders/:orderId" element={<WorkOrderDetails />} />
                  <Route path="/work-orders/:orderId/edit" element={<NewWorkOrder />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/invoices/new" element={<NewInvoice />} />
                  <Route path="/invoices/:invoiceId" element={<InvoiceDetails />} />
                  <Route path="/invoices/:invoiceId/edit" element={<NewInvoice />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/expenses" element={<Expenses />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/users/:userId/permissions" element={<UserPermissions />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
