import { useState } from 'react';

type Step = 'role' | 'teacher-create' | 'student-join' | 'teacher-done';

export default function Onboarding() {
  const [step, setStep] = useState<Step>('role');
  const [labName, setLabName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateLab = async () => {
    if (!labName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/groups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: labName.trim() }),
      });
      if (!res.ok) {
        setError('研究室の作成に失敗しました。');
        return;
      }
      const data = await res.json<{ joinCode: string }>();
      setGeneratedCode(data.joinCode);
      setStep('teacher-done');
    } catch {
      setError('通信エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinLab = async () => {
    if (!joinCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ joinCode: joinCode.trim() }),
      });
      if (res.status === 404) {
        setError('参加コードが正しくありません');
        return;
      }
      if (!res.ok) {
        setError('参加に失敗しました。');
        return;
      }
      window.location.href = '/student';
    } catch {
      setError('通信エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'role') {
    return (
      <div className="max-w-lg w-full mx-auto px-6 py-16 text-center">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">ロール選択</h1>
          <p className="text-base text-gray-500">あなたの役割を選んでください。</p>
        </div>
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setStep('teacher-create')}
            className="block bg-blue-600 text-white font-semibold px-8 py-4 rounded-lg shadow hover:bg-blue-700 transition-colors text-lg"
          >
            先生として始める
          </button>
          <button
            type="button"
            onClick={() => setStep('student-join')}
            className="block bg-green-600 text-white font-semibold px-8 py-4 rounded-lg shadow hover:bg-green-700 transition-colors text-lg"
          >
            学生として始める
          </button>
        </div>
      </div>
    );
  }

  if (step === 'teacher-create') {
    return (
      <div className="max-w-lg w-full mx-auto px-6 py-16 text-center">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">研究室を作成</h1>
          <p className="text-base text-gray-500">研究室名を入力してください。</p>
        </div>
        <div className="flex flex-col gap-4">
          <input
            type="text"
            value={labName}
            onChange={(e) => setLabName(e.target.value)}
            placeholder="例: 田中研究室"
            className="border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="button"
            onClick={handleCreateLab}
            disabled={loading || !labName.trim()}
            className="bg-blue-600 text-white font-semibold px-8 py-4 rounded-lg shadow hover:bg-blue-700 transition-colors text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '作成中...' : '作成'}
          </button>
          <button
            type="button"
            onClick={() => { setStep('role'); setError(''); }}
            className="text-gray-500 hover:text-gray-700 text-sm underline"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  if (step === 'student-join') {
    return (
      <div className="max-w-lg w-full mx-auto px-6 py-16 text-center">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">研究室に参加</h1>
          <p className="text-base text-gray-500">先生から受け取った参加コードを入力してください。</p>
        </div>
        <div className="flex flex-col gap-4">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="参加コード（例: A1B2C3D4）"
            className="border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 uppercase tracking-widest"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="button"
            onClick={handleJoinLab}
            disabled={loading || !joinCode.trim()}
            className="bg-green-600 text-white font-semibold px-8 py-4 rounded-lg shadow hover:bg-green-700 transition-colors text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '参加中...' : '参加'}
          </button>
          <button
            type="button"
            onClick={() => { setStep('role'); setError(''); }}
            className="text-gray-500 hover:text-gray-700 text-sm underline"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  // teacher-done
  return (
    <div className="max-w-lg w-full mx-auto px-6 py-16 text-center">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">研究室を作成しました</h1>
        <p className="text-base text-gray-500 mb-6">
          以下の参加コードを学生に共有してください。
        </p>
        <div className="bg-gray-100 rounded-xl px-8 py-6 mb-4 inline-block">
          <span className="text-4xl font-bold tracking-widest text-blue-700 font-mono">
            {generatedCode}
          </span>
        </div>
        <p className="text-sm text-gray-400">このコードで学生が研究室に参加できます</p>
      </div>
      <a
        href="/teacher"
        className="inline-block bg-blue-600 text-white font-semibold px-8 py-4 rounded-lg shadow hover:bg-blue-700 transition-colors text-lg"
      >
        ダッシュボードへ
      </a>
    </div>
  );
}
