import { useState, useEffect, useCallback } from 'react';

type Slot = {
  id: string;
  teacherId: string;
  startTime: number; // Unix秒
  endTime: number;   // Unix秒
  createdAt: number;
};

type DialogState =
  | { type: 'none' }
  | { type: 'add'; date: Date; hour: number }
  | { type: 'delete'; slot: Slot };

// 今週の月曜〜日曜を取得（ローカル日付基準）
function getWeekDates(): { label: string; dateStr: string; date: Date }[] {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=日, 1=月, ..., 6=土
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);

  const labels = ['月', '火', '水', '木', '金', '土', '日'];
  return labels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      label,
      dateStr: `${d.getMonth() + 1}/${d.getDate()}`,
      date: d,
    };
  });
}

// 日付と時間からUnix秒を作る
function toUnixSec(date: Date, hour: number): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

// スロットが指定した日・時間に該当するか
function slotMatchesDayAndHour(slot: Slot, date: Date, hour: number): boolean {
  const start = new Date(slot.startTime * 1000);
  return (
    start.getFullYear() === date.getFullYear() &&
    start.getMonth() === date.getMonth() &&
    start.getDate() === date.getDate() &&
    start.getHours() === hour
  );
}

const HOURS = Array.from({ length: 9 }, (_, i) => i + 9); // 9〜17時

// ダミー承認待ちリスト（TASK-011以降で実装）
const PENDING_REQUESTS = [
  { id: 1, student: '田中 花子', datetime: '承認待ち（TASK-011実装後）' },
  { id: 2, student: '鈴木 太郎', datetime: '承認待ち（TASK-011実装後）' },
];

// ダミー学生課題一覧（TASK-013以降で実装）
const ASSIGNMENTS = [
  { student: '田中 花子', title: '研究計画書 第1稿', status: '未完了' },
  { student: '鈴木 太郎', title: '文献調査レポート', status: '完了' },
  { student: '佐藤 次郎', title: '実験データまとめ', status: '未完了' },
];

export default function TeacherDashboard() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekDates = getWeekDates();

  const fetchSlots = useCallback(async () => {
    try {
      const res = await fetch('/api/slots', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) {
          setError('ログインが必要です');
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json() as Slot[];
      setSlots(data);
    } catch (e) {
      setError(`空き枠の取得に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleCellClick = (date: Date, hour: number) => {
    // 既存スロットがあるかチェック
    const existing = slots.find((s) => slotMatchesDayAndHour(s, date, hour));
    if (existing) {
      setDialog({ type: 'delete', slot: existing });
    } else {
      setDialog({ type: 'add', date, hour });
    }
  };

  const handleAddSlot = async () => {
    if (dialog.type !== 'add') return;

    const startTime = toUnixSec(dialog.date, dialog.hour);
    const endTime = toUnixSec(dialog.date, dialog.hour + 1);

    try {
      const res = await fetch('/api/slots', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime, endTime }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDialog({ type: 'none' });
      await fetchSlots();
    } catch (e) {
      alert(`追加に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleDeleteSlot = async () => {
    if (dialog.type !== 'delete') return;

    const slotId = dialog.slot.id;

    try {
      const res = await fetch(`/api/slots/${slotId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDialog({ type: 'none' });
      await fetchSlots();
    } catch (e) {
      alert(`削除に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const formatDateTime = (date: Date, hour: number) => {
    const labels = ['月', '火', '水', '木', '金', '土', '日'];
    const dayLabel = labels[date.getDay() === 0 ? 6 : date.getDay() - 1];
    return `${date.getMonth() + 1}/${date.getDate()}（${dayLabel}） ${hour}:00–${hour + 1}:00`;
  };

  const formatSlotDateTime = (slot: Slot) => {
    const start = new Date(slot.startTime * 1000);
    return formatDateTime(start, start.getHours());
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">

      {/* 週ビューカレンダー */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4">今週の空き枠カレンダー</h2>
        {loading && <p className="text-sm text-gray-400">読み込み中...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <>
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="w-16 py-3 px-2 text-center text-gray-500 font-medium border-r border-gray-200">
                      時刻
                    </th>
                    {weekDates.map((d) => (
                      <th
                        key={d.dateStr}
                        className="py-3 px-2 text-center text-gray-700 font-semibold border-r border-gray-200 last:border-r-0"
                      >
                        <span className="block">{d.label}</span>
                        <span className="block text-xs text-gray-400 font-normal">{d.dateStr}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HOURS.map((hour) => (
                    <tr key={hour} className="border-t border-gray-100">
                      <td className="py-2 px-2 text-center text-gray-400 text-xs border-r border-gray-200">
                        {hour}:00
                      </td>
                      {weekDates.map((d) => {
                        const slot = slots.find((s) => slotMatchesDayAndHour(s, d.date, hour));
                        return (
                          <td
                            key={d.dateStr}
                            className="py-1 px-1 text-center border-r border-gray-100 last:border-r-0 h-10 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => handleCellClick(d.date, hour)}
                            title={slot ? 'クリックして削除' : 'クリックして追加'}
                          >
                            {slot ? (
                              <span className="inline-block w-full rounded bg-green-100 text-green-800 text-xs font-medium px-1 py-1 leading-tight">
                                空き
                              </span>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              空きセルをクリックして空き枠を追加、緑のセルをクリックして削除できます。
            </p>
          </>
        )}
      </section>

      {/* 承認待ちリスト */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4">承認待ちリスト</h2>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-3 px-4 text-left text-gray-600 font-semibold">学生名</th>
                <th className="py-3 px-4 text-left text-gray-600 font-semibold">希望日時</th>
                <th className="py-3 px-4 text-center text-gray-600 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {PENDING_REQUESTS.map((req) => (
                <tr key={req.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 text-gray-800 font-medium">{req.student}</td>
                  <td className="py-3 px-4 text-gray-600">{req.datetime}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex gap-2 justify-center">
                      <button
                        type="button"
                        className="bg-green-600 text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        承認
                      </button>
                      <button
                        type="button"
                        className="bg-red-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-red-600 transition-colors"
                      >
                        差し戻し
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 学生課題一覧 */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4">学生課題一覧</h2>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-3 px-4 text-left text-gray-600 font-semibold">学生名</th>
                <th className="py-3 px-4 text-left text-gray-600 font-semibold">課題名</th>
                <th className="py-3 px-4 text-center text-gray-600 font-semibold">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {ASSIGNMENTS.map((a, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 text-gray-800 font-medium">{a.student}</td>
                  <td className="py-3 px-4 text-gray-600">{a.title}</td>
                  <td className="py-3 px-4 text-center">
                    {a.status === '完了' ? (
                      <span className="inline-block bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                        完了
                      </span>
                    ) : (
                      <span className="inline-block bg-yellow-100 text-yellow-700 text-xs font-semibold px-3 py-1 rounded-full">
                        未完了
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 追加ダイアログ */}
      {dialog.type === 'add' && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 max-w-full">
            <h3 className="text-base font-bold text-gray-800 mb-3">空き枠を追加</h3>
            <p className="text-sm text-gray-600 mb-4">
              <span className="font-medium">{formatDateTime(dialog.date, dialog.hour)}</span>
              <br />
              この時間帯を空き枠として追加しますか？
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDialog({ type: 'none' })}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleAddSlot}
                className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors font-semibold"
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除ダイアログ */}
      {dialog.type === 'delete' && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 max-w-full">
            <h3 className="text-base font-bold text-gray-800 mb-3">空き枠を削除</h3>
            <p className="text-sm text-gray-600 mb-4">
              <span className="font-medium">{formatSlotDateTime(dialog.slot)}</span>
              <br />
              この空き枠を削除しますか？
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDialog({ type: 'none' })}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDeleteSlot}
                className="px-4 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors font-semibold"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
