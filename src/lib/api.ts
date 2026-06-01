/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { signInWithFirebaseToken } from './firebase';

const TOKEN_KEY = '112_auth_token';
const FIREBASE_TOKEN_KEY = '112_fb_token';

export const api = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(FIREBASE_TOKEN_KEY);
  },

  async request(endpoint: string, options: RequestInit = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'მოხდა შეცდომა სერვერთან კავშირისას');
    }

    return response.json();
  },

  async login(username: string, password: string) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data.token) {
      this.setToken(data.token);
    }
    if (data.firebaseToken) {
      localStorage.setItem(FIREBASE_TOKEN_KEY, data.firebaseToken);
      await signInWithFirebaseToken(data.firebaseToken);
    }
    return data;
  },

  async getMe() {
    return this.request('/api/auth/me');
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  // Refusals
  async getRefusals() {
    return this.request('/api/refusals');
  },

  async createRefusal(data: any) {
    return this.request('/api/refusals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateRefusal(id: string, data: any) {
    return this.request(`/api/refusals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteRefusal(id: string) {
    return this.request(`/api/refusals/${id}`, {
      method: 'DELETE',
    });
  },

  // Reasons
  async getReasons() {
    return this.request('/api/reasons');
  },

  async createReason(name: string) {
    return this.request('/api/reasons', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  async updateReason(id: string, data: { name?: string; isActive?: boolean }) {
    return this.request(`/api/reasons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteReason(id: string) {
    return this.request(`/api/reasons/${id}`, {
      method: 'DELETE',
    });
  },

  // Users
  async getUsers() {
    return this.request('/api/users');
  },

  async createUser(data: any) {
    return this.request('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateUser(id: string, data: any) {
    return this.request(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async resetUserPassword(id: string, data: { newPassword: string }) {
    return this.request(`/api/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteUser(id: string) {
    return this.request(`/api/users/${id}`, {
      method: 'DELETE',
    });
  },

  // Stats
  async getStats() {
    return this.request('/api/stats');
  },

  // Audit Logs
  async getAuditLogs() {
    return this.request('/api/audit-logs');
  }
};
