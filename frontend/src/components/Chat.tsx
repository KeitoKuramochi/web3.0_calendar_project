import { useState, useRef, useEffect } from 'react';

type MessageRole = 'user' | 'model';

interface Message {
  id: number;
  role: MessageRole;
  text: string;
  timestamp: Date;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // マウント時に過去の会話履歴を取得
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/chat/history', {
          credentials: 'include',
        });
        if (!res.ok) return;
        const history = await res.json<
          { id: string; role: 'user' | 'assistant'; content: string; createdAt: number }[]
        >();
        const loaded: Message[] = history.map((h, i) => ({
          id: i,
          role: h.role === 'assistant' ? 'model' : 'user',
          text: h.content,
          timestamp: new Date(h.createdAt * 1000),
        }));
        setMessages(loaded);
      } catch {
        // 履歴取得失敗は無視して空状態で開始
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  async function handleSend() {
    const text = inputText.trim();
    if (!text || isLoading || sessionEnded) return;

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      text,
      timestamp: new Date(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.text,
          })),
        }),
      });

      const data = await res.json<{ reply?: string; error?: string }>();
      const replyText = data.reply ?? '返答を取得できませんでした';

      const botMessage: Message = {
        id: Date.now() + 1,
        role: 'model',
        text: replyText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch {
      const errorMessage: Message = {
        id: Date.now() + 1,
        role: 'model',
        text: '通信エラーが発生しました。再度お試しください。',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEndSession() {
    if (isEnding || sessionEnded) return;
    setIsEnding(true);
    try {
      await fetch('/api/chat/end-session', {
        method: 'POST',
        credentials: 'include',
      });
      setSessionEnded(true);
      const notice: Message = {
        id: Date.now() + 2,
        role: 'model',
        text: '会話履歴を保存しました。次回の会話でも内容を参照できます。',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, notice]);
    } catch {
      // 失敗しても画面を壊さない
    } finally {
      setIsEnding(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      void handleSend();
    }
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3 shadow-sm">
        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
          AI
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm leading-tight">AIボット</p>
          <p className="text-xs text-gray-400 leading-tight">研究室アシスタント</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleEndSession()}
            disabled={isEnding || sessionEnded}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sessionEnded ? '保存済み' : isEnding ? '保存中...' : '会話を終了する'}
          </button>
          <a
            href="/student"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← ダッシュボードへ
          </a>
        </div>
      </header>

      {/* メッセージ一覧 */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-gray-400 text-sm mt-12">
            <p className="text-2xl mb-2">💬</p>
            <p>AIボットにメッセージを送ってみましょう</p>
          </div>
        )}

        {messages.map((msg) =>
          msg.role === 'user' ? (
            /* 自分のメッセージ（右寄せ） */
            <div key={msg.id} className="flex justify-end items-end gap-2">
              <span className="text-xs text-gray-400 mb-1">{formatTime(msg.timestamp)}</span>
              <div className="max-w-xs lg:max-w-md">
                <div className="bg-blue-600 text-white px-4 py-2.5 rounded-2xl rounded-br-sm shadow-sm text-sm leading-relaxed">
                  {msg.text}
                </div>
              </div>
            </div>
          ) : (
            /* AIボットのメッセージ（左寄せ） */
            <div key={msg.id} className="flex items-end gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mb-0.5">
                AI
              </div>
              <div className="max-w-xs lg:max-w-md">
                <p className="text-xs text-gray-500 mb-1 ml-1">AIボット</p>
                <div className="bg-white text-gray-800 px-4 py-2.5 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100 text-sm leading-relaxed">
                  {msg.text}
                </div>
              </div>
              <span className="text-xs text-gray-400 mb-1">{formatTime(msg.timestamp)}</span>
            </div>
          )
        )}

        {/* ローディングインジケーター（送信中） */}
        {isLoading && (
          <div className="flex items-end gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mb-0.5">
              AI
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1 ml-1">AIボットが入力中...</p>
              <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100 flex gap-1 items-center">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* 入力エリア */}
      <footer className="bg-white border-t border-gray-200 px-4 py-3 flex gap-3 items-center shadow-sm">
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sessionEnded}
          placeholder={sessionEnded ? '会話が終了しました' : 'メッセージを入力...'}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!inputText.trim() || isLoading || sessionEnded}
          className="bg-blue-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm shadow hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          送信
        </button>
      </footer>
    </div>
  );
}
