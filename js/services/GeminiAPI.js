/**
 * Сервис интеграции с локальным сервером и Gemini API
 */
export class GeminiAPI {
  static async parseCustomWeapon(weaponName, charContext) {
    try {
      const response = await fetch('/api/ai/weapon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: weaponName, character: charContext })
      });
      if (!response.ok) throw new Error('Ошибка сервера при запросе к AI');
      return await response.json();
    } catch (err) {
      console.warn("Локальный режим: Gemini недоступен, оружие не распознано", err);
      return null;
    }
  }
}
