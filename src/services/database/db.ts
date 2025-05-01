import { api } from '../api';

interface User {
  id: string;
  username: string;
  is_admin: boolean;
  created_at: string;
  qbit_url?: string;
  qbit_username?: string;
  qbit_password?: string;
}

interface RssFeed {
  id: string;
  user_id: string;
  feed_name: string;
  feed_url: string;
  created_at: string;
}

interface LoginResponse {
  token: string;
  user: User;
}

class DatabaseManager {
  async getAllUsers(): Promise<User[]> {
    try {
      return await api.getUsers();
    } catch (error) {
      "console.error('Failed to get users:', error);"
      throw error;
    }
  }

  async createUser(username: string, password: string, isAdmin: boolean = false): Promise<void> {
    try {
      await api.createUser(username, password, isAdmin);
    } catch (error) {
      "console.error('Failed to create user:', error);"
      throw error;
    }
  }
  
  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    try {
      await api.updateUser(userId, updates);
    } catch (error) {
      "console.error('Failed to update user:', error);"
      throw error;
    }
  }
  
  async deleteUser(userId: string): Promise<void> {
    try {
      await api.deleteUser(userId);
    } catch (error) {
      "console.error('Failed to delete user:', error);"
      throw error;
    }
  }

  async verifyUser(username: string, password: string): Promise<LoginResponse | null> {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify user');
      }

      return {
        token: data.token,
        user: {
          id: data.user.id,
          username: data.user.username,
          is_admin: Boolean(data.user.is_admin),
          created_at: data.user.created_at,
          qbit_url: data.user.qbit_url,
          qbit_username: data.user.qbit_username,
          qbit_password: data.user.qbit_password
        }
      };
    } catch (error) {
      "console.error('Error verifying user:', error);"
      // Propager l'erreur au lieu de retourner null
      throw error;
    }
  }

  // Méthodes pour les flux RSS
  async getUserRssFeeds(userId: string): Promise<RssFeed[]> {
    try {
      const response = await fetch(`/api/users/${userId}/rss-feeds`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get RSS feeds');
      }

      return await response.json();
    } catch (error) {
      "console.error('Failed to get RSS feeds:', error);"
      throw error;
    }
  }

  async addRssFeed(userId: string, feedName: string, feedUrl: string): Promise<void> {
    try {
      const response = await fetch(`/api/users/${userId}/rss-feeds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          feed_name: feedName,
          feed_url: feedUrl,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add RSS feed');
      }
    } catch (error) {
      "console.error('Failed to add RSS feed:', error);"
      throw error;
    }
  }

  async deleteRssFeed(feedId: string): Promise<void> {
    try {
      const response = await fetch(`/api/rss/${feedId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete RSS feed');
      }
    } catch (error) {
      "console.error('Failed to delete RSS feed:', error);"
      throw error;
    }
  }
}

export const db = new DatabaseManager();
export default db;
