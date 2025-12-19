import { useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, AlertCircle, Loader } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function Login() {
  const { signIn } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await signIn(email, password);

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError(t('auth.error_invalid_credentials'));
        } else if (error.message.includes('Email not confirmed')) {
          setError(t('auth.error_email_not_confirmed'));
        } else {
          setError(t('auth.error_login_failed'));
        }
      }
    } catch (err) {
      setError(t('auth.error_unexpected'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-full p-4 inline-block mb-4">
              <LogIn className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {t('app.name')}
            </h1>
            <p className="text-gray-600">{t('auth.sign_in_to_continue')}</p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:bg-gray-100"
                placeholder="example@domain.com"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:bg-gray-100"
                placeholder="••••••••"
                dir="ltr"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  {t('auth.logging_in')}
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  {t('auth.login')}
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600">
              {t('auth.contact_admin')}
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>{t('app.tagline')}</p>
          <p className="mt-1">{t('app.copyright')}</p>
        </div>
      </div>
    </div>
  );
}
