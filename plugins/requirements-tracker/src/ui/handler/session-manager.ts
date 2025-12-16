import type { ChatSession } from '../chat/types';

interface SessionData extends ChatSession {
  expiresAt: Date;
}

class SessionManager {
  private sessions: Map<string, SessionData> = new Map();
  private readonly defaultTTL: number = 60 * 60 * 1000; // 1 hour in milliseconds

  createSession(sessionId: string): ChatSession {
    const now = new Date();
    const session: SessionData = {
      id: sessionId,
      createdAt: now,
      lastMessageAt: now,
      messageCount: 0,
      expiresAt: new Date(now.getTime() + this.defaultTTL),
    };

    this.sessions.set(sessionId, session);
    return this.toPublicSession(session);
  }

  getSession(sessionId: string): ChatSession | null {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    // Check if session has expired
    if (new Date() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    return this.toPublicSession(session);
  }

  updateSession(sessionId: string, updates: Partial<SessionData>): ChatSession | null {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    const updatedSession = {
      ...session,
      ...updates,
      expiresAt: new Date(Date.now() + this.defaultTTL), // Extend TTL on update
    };

    this.sessions.set(sessionId, updatedSession);
    return this.toPublicSession(updatedSession);
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  cleanupExpiredSessions(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [id, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  getAllSessions(): ChatSession[] {
    this.cleanupExpiredSessions();
    return Array.from(this.sessions.values()).map(this.toPublicSession);
  }

  private toPublicSession(session: SessionData): ChatSession {
    const { expiresAt, ...publicSession } = session;
    return publicSession;
  }
}

// Singleton instance
export const sessionManager = new SessionManager();

// Run cleanup every 5 minutes
setInterval(() => {
  sessionManager.cleanupExpiredSessions();
}, 5 * 60 * 1000);
