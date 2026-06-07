import { useEffect, useState } from 'react';

type User = {
  id: string;
  googleId: string;
  name: string;
  email: string;
  picture: string;
  role: 'teacher' | 'student' | null;
};

export default function HomeAuthGuard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) return null;
        return res.json<{ user: User | null }>();
      })
      .then((data) => {
        if (data && data.user) {
          setUser(data.user);
          // ロールに応じてリダイレクト
          if (data.user.role === 'teacher') {
            window.location.href = '/teacher';
          } else if (data.user.role === 'student') {
            window.location.href = '/student';
          } else {
            window.location.href = '/onboarding';
          }
        }
      })
      .catch(() => {
        // 未ログイン状態を無視
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  if (loading) return null;
  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      {user.picture && (
        <img
          src={user.picture}
          alt={user.name}
          className="w-8 h-8 rounded-full border border-gray-200"
        />
      )}
      <span className="text-sm font-medium text-gray-700">{user.name}</span>
      <button
        type="button"
        onClick={handleLogout}
        className="text-sm text-gray-500 hover:text-gray-700 underline"
      >
        ログアウト
      </button>
    </div>
  );
}
