// Импортируем только нужную для этого файла модель Character:
import { Character } from '../models/Character.js';

/**
 * Сервис работы с хранилищем (Python API и localStorage)
 */
export class CharacterAPI {
  static async loadAll() {
    try {
      const res = await fetch('/api/characters');
      if (res.ok) {
        const raw = await res.json();
        if (Array.isArray(raw) && raw.length > 0) {
          return raw.map(item => new Character(item));
        }
      }
    } catch (e) {
      console.warn("Python-сервер не запущен (работаем через память браузера)");
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(characters),
        keepalive: true
      });
    } catch (e) {}
  }

  static async saveSingle(character) {
    const fileName = `${character.id}.json`;
    return await fetch('/api/save-character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: fileName, data: character })
    });
  }

  static async deleteCharacter(charId) {
    try {
      await fetch('/api/delete-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: charId })
      });
    } catch(e) {}
  }
}