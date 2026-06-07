import { useState, useEffect, useCallback } from 'react';

type Slot = {
  id: string;
  teacherId: string;
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

type Assignment = {
  id: string;
  groupId: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  title: string;
  dueDate: number; // Unix秒
  status: 'pending' | 'done';
  createdAt: number;
};

type GroupMember = {
  id: string;
  name: string;
  email: string;
  role: string | null;
};

type DialogState =
  | { type: 'none' }
  | { type: 'add'; date: Date; hour: number }
  | { type: 'delete'; slot: Slot };

type RejectForm = {
  requestId: string;
  date: string;
  hour: number;
};

type AssignmentForm = {
  studentId: string;
  title: string;
  dueDate: string;
};

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

export default function TeacherDashboard() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [pendingRequests, setPendingRequests] = useState<MeetingRequest[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectForm, setRejectForm] = useState<RejectForm | null>(null);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>({
    studentId: '',
    title: '',
    dueDate: '',
  });
  const [assignmentSubmitting, setAssignmentSubmitting] = useState(false);

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

  const fetchPendingRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/meeting-requests', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) return; // 未ログインは無視
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json() as MeetingRequest[];
      setPendingRequests(data.filter((r) => r.status === 'pending'));
    } catch (e) {
      console.error('リクエスト取得失敗:', e);
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch('/api/assignments', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) return;
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json() as Assignment[];
      setAssignments(data);
    } catch (e) {
      console.error('課題取得失敗:', e);
    }
  }, []);

  const fetchGroupMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/groups/members', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) return;
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json() as GroupMember[];
      setGroupMembers(data);
    } catch (e) {
      console.error('グループメンバー取得失敗:', e);
    }
  }, []);

  const handleApprove = async (requestId: string) => {
    try {
      const res = await fetch(`/api/meeting-requests/${requestId}/approve`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchPendingRequests();
    } catch (e) {
      alert(`承認に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleShowRejectForm = (requestId: string) => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setRejectForm({ requestId, date: `${yyyy}-${mm}-${dd}`, hour: 9 });
  };

  const handleRejectSubmit = async () => {
    if (!rejectForm) return;
    const { requestId, date, hour } = rejectForm;
    const [year, month, day] = date.split('-').map(Number);
    const altStart = new Date(year, month - 1, day, hour, 0, 0, 0);
    const altEnd = new Date(year, month - 1, day, hour + 1, 0, 0, 0);
    const altStartTime = Math.floor(altStart.getTime() / 1000);
    const altEndTime = Math.floor(altEnd.getTime() / 1000);

    try {
      const res = await fetch(`/api/meeting-requests/${requestId}/reject`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ altStartTime, altEndTime }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRejectForm(null);
      await fetchPendingRequests();
    } catch (e) {
      alert(`差し戻しに失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  useEffect(() => {
    fetchSlots();
    fetchPendingRequests();
    fetchAssignments();
    fetchGroupMembers();
  }, [fetchSlots, fetchPendingRequests, fetchAssignments, fetchGroupMembers]);

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

  const handleAssignmentSubmit = async () => {
    const { studentId, title, dueDate } = assignmentForm;
    if (!studentId || !title || !dueDate) {
      alert('すべての項目を入力してください');
      return;
    }
    const [year, month, day] = dueDate.split('-').map(Number);
    const dueDateUnix = Math.floor(new Date(year, month - 1, day, 23, 59, 59).getTime() / 1000);

    setAssignmentSubmitting(true);
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, title, dueDate: dueDateUnix }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShowAssignmentForm(false);
      setAssignmentForm({ studentId: '', title: '', dueDate: '' });
      await fetchAssignments();
    } catch (e) {
      alert(`課題の追加に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAssignmentSubmitting(false);
    }
  };

  const formatDueDate = (unixSec: number) => {
    const d = new Date(unixSec * 1000);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
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
          {pendingRequests.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">承認待ちのリクエストはありません</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-3 px-4 text-left text-gray-600 font-semibold">学生名</th>
                  <th className="py-3 px-4 text-left text-gray-600 font-semibold">希望日時</th>
                  <th className="py-3 px-4 text-center text-gray-600 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((req) => (
                  <tr key={req.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-gray-800 font-medium">{req.studentName}</td>
                    <td className="py-3 px-4 text-gray-600">{formatRequestDateTime(req)}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2 justify-center">
                          <button
                            type="button"
                            onClick={() => handleApprove(req.id)}
                            className="bg-green-600 text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
                          >
                            承認
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShowRejectForm(req.id)}
                            className="bg-red-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-red-600 transition-colors"
                          >
                            差し戻し
                          </button>
                        </div>
                        {rejectForm?.requestId === req.id && (
                          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                            <p className="text-xs font-semibold text-gray-600">代替日程を入力</p>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-gray-500">日付</label>
                              <input
                                type="date"
                                value={rejectForm.date}
                                onChange={(e) => setRejectForm({ ...rejectForm, date: e.target.value })}
                                className="border border-gray-300 rounded px-2 py-1 text-xs"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-gray-500">時間</label>
                              <select
                                value={rejectForm.hour}
                                onChange={(e) => setRejectForm({ ...rejectForm, hour: Number(e.target.value) })}
                                className="border border-gray-300 rounded px-2 py-1 text-xs"
                              >
                                {HOURS.map((h) => (
                                  <option key={h} value={h}>{h}:00–{h + 1}:00</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => setRejectForm(null)}
                                className="text-xs text-gray-500 border border-gray-300 px-3 py-1 rounded hover:bg-gray-100 transition-colors"
                              >
                                キャンセル
                              </button>
                              <button
                                type="button"
                                onClick={handleRejectSubmit}
                                className="text-xs text-white bg-red-500 px-3 py-1 rounded hover:bg-red-600 transition-colors font-semibold"
                              >
                                差し戻す
                              </button>
                            </div>
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

      {/* 学生課題一覧 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">学生課題一覧</h2>
          <button
            type="button"
            onClick={() => setShowAssignmentForm((v) => !v)}
            className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            課題を追加
          </button>
        </div>

        {showAssignmentForm && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">新しい課題を追加</p>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">対象学生</label>
              <select
                value={assignmentForm.studentId}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, studentId: e.target.value })}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="">-- 学生を選択 --</option>
                {groupMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">課題名</label>
              <input
                type="text"
                value={assignmentForm.title}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                placeholder="課題名を入力"
                className="border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">期限</label>
              <input
                type="date"
                value={assignmentForm.dueDate}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowAssignmentForm(false); setAssignmentForm({ studentId: '', title: '', dueDate: '' }); }}
                className="text-sm text-gray-500 border border-gray-300 px-4 py-1.5 rounded hover:bg-gray-100 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleAssignmentSubmit}
                disabled={assignmentSubmitting}
                className="text-sm text-white bg-blue-600 px-4 py-1.5 rounded hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50"
              >
                {assignmentSubmitting ? '追加中...' : '追加'}
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {assignments.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">課題はまだ追加されていません</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-3 px-4 text-left text-gray-600 font-semibold">学生名</th>
                  <th className="py-3 px-4 text-left text-gray-600 font-semibold">課題名</th>
                  <th className="py-3 px-4 text-left text-gray-600 font-semibold">期限</th>
                  <th className="py-3 px-4 text-center text-gray-600 font-semibold">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-gray-800 font-medium">{a.studentName}</td>
                    <td className="py-3 px-4 text-gray-600">{a.title}</td>
                    <td className="py-3 px-4 text-gray-600">{formatDueDate(a.dueDate)}</td>
                    <td className="py-3 px-4 text-center">
                      {a.status === 'done' ? (
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
          )}
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
