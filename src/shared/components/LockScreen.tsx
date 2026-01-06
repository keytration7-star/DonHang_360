import { useState, useEffect, useRef } from 'react';
import { Lock, X, KeyRound, HelpCircle } from 'lucide-react';
import { useAutoFocus } from '../../shared/hooks/useAutoFocus';
import { useTheme } from '../../shared/contexts/ThemeContext';

interface LockScreenProps {
  onUnlock: (password: string) => boolean;
  onResetPassword?: () => void;
}

const SECRET_CODE = 'vuducanh'; // Mã bí mật để reset mật khẩu

const LockScreen = ({ onUnlock, onResetPassword }: LockScreenProps) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [secretCode, setSecretCode] = useState('');
  const [resetError, setResetError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const secretCodeRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();

  // Tự động focus input khi component mount
  useAutoFocus(inputRef, true, 150);
  
  // Tự động focus input mã bí mật khi modal mở
  useAutoFocus(secretCodeRef, showResetModal, 150);

  const handleUnlock = () => {
    if (!password) {
      setError('Vui lòng nhập mật khẩu');
      return;
    }
    if (onUnlock(password)) {
      setPassword('');
      setError('');
    } else {
      setError('Mật khẩu không đúng!');
      setPassword('');
    }
  };

  const handleResetPassword = () => {
    if (!secretCode) {
      setResetError('Vui lòng nhập mã bí mật');
      return;
    }
    if (secretCode.toLowerCase() === SECRET_CODE.toLowerCase()) {
      // Xóa mật khẩu và mở khóa app
      localStorage.removeItem('app_password');
      localStorage.setItem('app_locked', 'false');
      if (onResetPassword) {
        onResetPassword();
      } else {
        // Reload app để áp dụng thay đổi
        window.location.reload();
      }
    } else {
      setResetError('Mã bí mật không đúng!');
      setSecretCode('');
      if (secretCodeRef.current) {
        secretCodeRef.current.focus();
      }
    }
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleUnlock();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [password]);

  return (
    <>
      <div className={`fixed inset-0 ${theme === 'dark' ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-gradient-to-br from-gray-100 to-gray-200'} flex items-center justify-center z-[9999]`}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <div className="mx-auto w-20 h-20 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mb-4">
              <Lock size={40} className="text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">Ứng dụng đã bị khóa</h2>
            <p className="text-gray-600 dark:text-gray-400">Vui lòng nhập mật khẩu để mở khóa</p>
          </div>

          <div className="space-y-4">
            <div>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleUnlock();
                  }
                }}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center text-lg"
                placeholder="Nhập mật khẩu"
                autoFocus
              />
              {error && (
                <p className="text-red-600 dark:text-red-400 text-sm mt-2 text-center">{error}</p>
              )}
            </div>

            <button
              onClick={handleUnlock}
              className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Mở khóa
            </button>

            <button
              onClick={() => setShowResetModal(true)}
              className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              <HelpCircle size={16} />
              Quên mật khẩu?
            </button>
          </div>
        </div>
      </div>

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <KeyRound size={24} className="text-primary-600 dark:text-primary-400" />
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">Đặt lại mật khẩu</h3>
              </div>
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setSecretCode('');
                  setResetError('');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nhập mã bí mật để đặt lại mật khẩu
                </label>
                <input
                  ref={secretCodeRef}
                  type="text"
                  value={secretCode}
                  onChange={(e) => {
                    setSecretCode(e.target.value);
                    setResetError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleResetPassword();
                    }
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center"
                  placeholder="Nhập mã bí mật"
                  autoFocus
                />
                {resetError && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-2 text-center">{resetError}</p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                  Nhập mã bí mật để xóa mật khẩu và mở khóa ứng dụng
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleResetPassword}
                  className="flex-1 bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Đặt lại mật khẩu
                </button>
                <button
                  onClick={() => {
                    setShowResetModal(false);
                    setSecretCode('');
                    setResetError('');
                  }}
                  className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LockScreen;
