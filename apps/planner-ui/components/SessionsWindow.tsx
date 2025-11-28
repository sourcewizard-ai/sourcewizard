import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import DraggableWindow from './DraggableWindow';

interface Session {
  id: string;
  integration: string;
  repository_url: string;
  branch: string;
  status: string;
  created_at: string;
  conversation_history: {
    plans?: any[];
  };
}

interface SessionsWindowProps {
  onClose: () => void;
  onSessionSelect: (session: Session) => void;
  zIndex: number;
}

export default function SessionsWindow({ onClose, onSessionSelect, zIndex }: SessionsWindowProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('sandbox_sessions')
        .select('id, integration, repository_url, branch, status, created_at, conversation_history')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching sessions:', error);
        return;
      }

      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <DraggableWindow
      title="My Plans"
      onClose={onClose}
      zIndex={zIndex}
      initialWidth={600}
      initialHeight={500}
    >
      <div className="p-4 overflow-y-auto flex-1 min-h-0">
        {isLoading ? (
          <div className="text-center py-8">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            No previous sessions found
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSessionSelect(session)}
                className="border-2 border-black p-3 hover:bg-gray-100 cursor-pointer transition-colors"
              >
                <div className="font-bold text-sm mb-1">{session.integration}</div>
                <div className="text-xs text-gray-600 space-y-1">
                  {session.repository_url && (
                    <div>Repository: {session.repository_url}</div>
                  )}
                  {session.branch && (
                    <div>Branch: {session.branch}</div>
                  )}
                  <div>
                    Created: {new Date(session.created_at).toLocaleString()}
                  </div>
                  {session.conversation_history?.plans && (
                    <div className="text-blue-600 font-semibold">
                      {session.conversation_history.plans.length} plan(s)
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DraggableWindow>
  );
}
