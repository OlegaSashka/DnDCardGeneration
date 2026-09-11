import { Character } from '../models/Character.js';

export class CharacterAPI {
  static getToken() {
    return localStorage.getItem("dnd_auth_token") || "";
  }

  static getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) {
      headers['X-Auth-Token'] = token;
    }
    return headers;
  }

  static async checkAuth() {
    try {
      const res = await fetch('/api/auth/me', { headers: this.getHeaders() });
      if (res.ok) return await res.json();
    } catch (e) {}
    return { authenticated: false };
  }

  static async login(username, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem("dnd_auth_token", data.token);
      localStorage.setItem("dnd_auth_user", data.username);
      localStorage.setItem("dnd_auth_role", data.role);
    }
    return data;
  }

  static async register(username, password, role = "player") {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem("dnd_auth_token", data.token);
      localStorage.setItem("dnd_auth_user", data.username);
      localStorage.setItem("dnd_auth_role", data.role);
    }
    return data;
  }

  static logout() {
    localStorage.removeItem("dnd_auth_token");
    localStorage.removeItem("dnd_auth_user");
    localStorage.removeItem("dnd_auth_role");
  }

  static async loadAll() {
    try {
      const res = await fetch('/api/characters', { headers: this.getHeaders() });
      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent('dnd:require-auth'));
      } else if (res.ok) {
        const raw = await res.json();
        if (Array.isArray(raw) && raw.length > 0) {
          return raw.map(item => new Character(item));
        }
      }
    } catch (e) {
      console.warn("Сервер недоступен — читаем из localStorage");
    }

    const fallback = localStorage.getItem("dnd_party_current_campaign");
    if (fallback) {
      try {
        const raw = JSON.parse(fallback);
        if (Array.isArray(raw) && raw.length > 0) {
          return raw.map(item => new Character(item));
        }
      } catch(e) {}
    }
    return [];
  }

  static async saveAll(characters) {
    localStorage.setItem("dnd_party_current_campaign", JSON.stringify(characters));
    try {
      await fetch('/api/save-all', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(characters),
        keepalive: true
      });
    } catch (e) {}
  }

  static async saveSingle(character) {
    return await fetch('/api/save-character', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ data: character })
    });
  }

  static async deleteCharacter(charId) {
    try {
      await fetch('/api/delete-character', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ id: charId })
      });
    } catch(e) {}
  }
}
