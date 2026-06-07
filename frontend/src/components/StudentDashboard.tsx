import { useState, useEffect, useCallback } from 'react';

type TeacherSlot = {
  id: string;
  teacherId: string;
  teacherName: string;
  startTime: number; // Unix秒
  endTime: number;   // Unix秒
  createdAt: number;
};

type MeetingRequest = {
  id: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  slotId: string;
  startTime: number | null;
  endTime: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'waiting_student';
  alternativeStartTime: number | null;
  alternativeEndTime: number | null;
  createdAt: number;
};

type DialogState =
  | { type: 'none' }
  | { type: 'request'; slot: TeacherSlot }
  | { type: 'confirm'; slot: TeacherSlot };

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

// スロットが指定した日・時間に該当するか
function slotMatchesDayAndHour(slot: TeacherSlot, date: Date, hour: number): boolean {
  const start = new Date(slot.startTime * 1000);
  return (
    start.getFullYear() === date.getFullYear() &&
    start.getMonth() === date.getMonth() &&
    start.getDate() === date.getDate() &&
    start.getHours() === hour
  );
}

function statusLabel(status: MeetingRequest['status']): string {
  if (status === 'pending') return '承認待ち';
  if (status === 'approved') return '確定済み';
  if (status === 'waiting_student') return '選択待ち';
  return '差し戻し済み';
}

function statusBadgeClass(status: MeetingRequest['status']): string {
  if (status === 'pending') return 'bg-yellow-100 text-yellow-700';
  if (status === 'approved') return 'bg-green-100 text-green-700';
  if (status === 'waiting_student') return 'bg-blue-100 text-blue-700';
  return 'bg-red-100 text-red-700';
}

const HOURS = Array.from({ length: 9 }, (_, i) => i + 9); // 9〜17時

// ダミー課題一覧（TASK-013以降で実装）
const ASSIGNMENTS = [
  { title: '研究計画書 第2稿', deadline: '2026-06-15', status: '未完了' },
  { title: '文献調査レポート', deadline: '2026-06-10', status: '完了' },
  { title: '実験データまとめ', deadline: '2026-06-20', status: '未完了' },
];

export default function StudentDashboard() {
  const [teacherSlots, setTeacherSlots] = useState<TeacherSlot[]>([]);
  const [requests, setRequests] = useState<MeetingRequest[]>([]);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const weekDates = getWeekDates();

  const fetchTeacherSlots = useCallback(async () => {
    try {
      const res = await fetch('/api/teacher/slots', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) {
          setError('ログインが必要です');
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json() as TeacherSlot[];
      setTeacherSlots(data);
    } catch (e) {
      setError(`空き枠の取得に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/meeting-requests', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) return; // 未ログインは無視
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json() as MeetingRequest[];
      setRequests(data);
    } catch (e) {
      // リクエスト取得失敗は非致命的
      console.error('リクエスト取得失敗:', e);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchTeacherSlots(), fetchRequests()]);
      setLoading(false);
    };
    init();
  }, [fetchTeacherSlots, fetchRequests]);

  const handleSlotClick = (slot: TeacherSlot) => {
    setDialog({ type: 'request', slot });
  };

  const handleRequestClick = () => {
    if (dialog.type !== 'request') return;
    setDialog({ type: 'confirm', slot: dialog.slot });
  };

  const handleSubmit = async () => {
    if (dialog.type !== 'confirm') return;
    const { slot } = dialog;

    setSubmitting(true);
    try {
      const res = await fetch('/api/meeting-requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: slot.id, teacherId: slot.teacherId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDialog({ type: 'none' });
      await fetchRequests();
    } catch (e) {
      alert(`送信に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectAlt = async (requestId: string) => {
    try {
      const res = await fetch(`/api/meeting-requests/${requestId}/select-alt`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchRequests();
    } catch (e) {
      alert(`選択に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const formatAltDateTime = (req: MeetingRequest) => {
    if (!req.alternativeStartTime || !req.alternativeEndTime) return '代替日時不明';
    const start = new Date(req.alternativeStartTime * 1000);
    const end = new Date(req.alternativeEndTime * 1000);
    const labels = ['月', '火', '水', '木', '金', '土', '日'];
    const dayLabel = labels[start.getDay() === 0 ? 6 : start.getDay() - 1];
    return `${start.getMonth() + 1}/${start.getDate()}（${dayLabel}） ${start.getHours()}:00–${end.getHours()}:00`;
  };

  const formatSlotDateTime = (slot: TeacherSlot) => {
    const start = new Date(slot.startTime * 1000);
    const end = new Date(slot.endTime * 1000);
    const labels = ['月', '火', '水', '木', '金', '土', '日'];
    const dayLabel = labels[start.getDay() === 0 ? 6 : start.getDay() - 1];
    return `${start.getMonth() + 1}/${start.getDate()}（${dayLabel}） ${start.getHours()}:00–${end.getHours()}:00`;
  };

  const formatRequestDateTime = (req: MeetingRequest) => {
    if (!req.startTime || !req.endTime) return '日時不明';
    const start = new Date(req.startTime * 1000);
    const end = new Date(req.endTime * 1000);
    const labels = ['月', '火', '水', '木', '金', '土', '日'];
    const dayLabel = labels[start.getDay() === 0 ? 6 : start.getDay() - 1];
    return `${start.getMonth() + 1}/${start.getDate()}（${dayLabel}） ${start.getHours()}:00–${end.getHours()}:00`;
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">

      {/* 先生の空き枠カレンダー */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4">先生の空き枠カレンダー（今週）</h2>
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
                        const slot = teacherSlots.find((s) => slotMatchesDayAndHour(s, d.date, hour));
                        return (
                          <td
                            key={d.dateStr}
                            className={`py-1 px-1 text-center border-r border-gray-100 last:border-r-0 h-10 ${slot ? 'cursor-pointer hover:bg-green-50 transition-colors' : ''}`}
                            onClick={() => slot && handleSlotClick(slot)}
                            title={slot ? 'クリックしてリクエスト' : undefined}
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
            {teacherSlots.length === 0 && (
              <p className="mt-2 text-xs text-gray-400">先生の空き枠がまだ登録されていません。</p>
            )}
            {teacherSlots.length > 0 && (
              <p className="mt-2 text-xs text-gray-400">
                空き枠をクリックして面談リクエストを送ることができます。
              </p>
            )}
          </>
        )}
      </section>

      {/* 自分の面談リクエスト一覧 */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4">面談リクエスト一覧</h2>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {requests.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">面談リクエストはありません</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-3 px-4 text-left text-gray-600 font-semibold">先生名</th>
                  <th className="py-3 px-4 text-left text-gray-600 font-semibold">日時</th>
                  <th className="py-3 px-4 text-center text-gray-600 font-semibold">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-gray-800 font-medium">{req.teacherName}</td>
                    <td className="py-3 px-4 text-gray-600">{formatRequestDateTime(req)}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${statusBadgeClass(req.status)}`}>
                          {statusLabel(req.status)}
                        </span>
                        {req.status === 'waiting_student' && (
                          <div className="text-left w-full max-w-xs">
                            <p className="text-xs text-gray-500 mb-1">代替案: {formatAltDateTime(req)}</p>
                            <button
                              type="button"
                              onClick={() => handleSelectAlt(req.id)}
                              className="text-xs text-white bg-blue-600 px-3 py-1 rounded hover:bg-blue-700 transition-colors font-semibold"
                            >
                              この日程で再リクエスト
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* 自分の課題 */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4">自分の課題</h2>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-3 px-4 text-left text-gray-600 font-semibold">課題名</th>
                <th className="py-3 px-4 text-left text-gray-600 font-semibold">期限</th>
                <th className="py-3 px-4 text-center text-gray-600 font-semibold">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {ASSIGNMENTS.map((a, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 text-gray-800 font-medium">{a.title}</td>
                  <td className="py-3 px-4 text-gray-600">{a.deadline}</td>
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

      {/* チャット導線 */}
      <section className="text-center pb-4">
        <a
          href="/chat"
          className="inline-block bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg shadow hover:bg-blue-700 transition-colors"
        >
          相談する（チャットへ）
        </a>
      </section>

      {/* リクエストボタン表示ダイアログ */}
      {dialog.type === 'request' && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 max-w-full">
            <h3 className="text-base font-bold text-gray-800 mb-3">先生の空き枠</h3>
            <p className="text-sm text-gray-600 mb-2">
              <span className="font-medium">{formatSlotDateTime(dialog.slot)}</span>
            </p>
            <p className="text-sm text-gray-500 mb-4">
              担当: {dialog.slot.teacherName}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDialog({ type: 'none' })}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={handleRequestClick}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                この枠でリクエストする
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 送信確認ダイアログ */}
      {dialog.type === 'confirm' && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 max-w-full">
            <h3 className="text-base font-bold text-gray-800 mb-3">面談リクエストの確認</h3>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">{formatSlotDateTime(dialog.slot)}</span>
            </p>
            <p className="text-sm text-gray-500 mb-4">
              担当: {dialog.slot.teacherName}
            </p>
            <p className="text-sm text-gray-700 mb-4">
              この時間帯で面談リクエストを送信しますか？
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDialog({ type: 'none' })}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={submitting}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50"
              >
                {submitting ? '送信中...' : '送信'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
