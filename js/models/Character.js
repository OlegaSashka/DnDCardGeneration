/**
 * Модель данных одного персонажа D&D 5e
 */
export class Character {
  constructor(data = {}) {
    this.id = data.id || `char_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.name = data.name || "";
    this.race = data.race || "";
    this.class = data.class || "";
    this.meta = data.meta || "";
    this.level = data.level || "1";
    this.maxBudgetPoints = data.maxBudgetPoints || "75";
    this.avatar = data.avatar || "";
    this.description = data.description || "";

    this.ac = data.ac || "10";
    this.acSub = data.acSub || "Без доспеха";
    this.hpMax = data.hpMax || data.hp || "10";
    this.hpCur = data.hpCur || "";
    this.hpBonus = data.hpBonus || "";
    this.speed = data.speed || "30 фт";
    this.speedSub = data.speedSub || "9м";
    this.init = data.init || "+0";
    this.initSub = data.initSub || "d20+0";
    this.extraTitle = data.extraTitle || "Вдохновение";
    this.extraVal = data.extraVal || "□";
    this.extraSub = data.extraSub || "Переброс d20";

    this.abilities = data.abilities || [
      { name: "СИЛА", mod: "+0", score: "10" },
      { name: "ЛОВКОСТЬ", mod: "+0", score: "10" },
      { name: "ТЕЛОСЛОЖ.", mod: "+0", score: "10" },
      { name: "ИНТЕЛЛЕКТ", mod: "+0", score: "10" },
      { name: "МУДРОСТЬ", mod: "+0", score: "10" },
      { name: "ХАРИЗМА", mod: "+0", score: "10" }
    ];

    this.attacks = data.attacks || [
      { name: "Оружие", hit: "d20 + 2", dmg: "1d6 + 0" }
    ];

    this.deathSuccess = data.deathSuccess || 0;
    this.deathFail = data.deathFail || 0;
    this.inventory = data.inventory || "Стандартный походный набор, 10 gp.";
    this.features = data.features || [
      "<b>Черта/Способность:</b> Описание способности."
    ];
  }

  static calcMod(score) {
    const num = parseInt(score, 10);
    if (isNaN(num)) return "+0";
    const mod = Math.floor((num - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  changeAbilityScore(idx, delta) {
    let cur = parseInt(this.abilities[idx].score, 10) || 10;
    cur = Math.max(1, Math.min(30, cur + delta));
    this.abilities[idx].score = cur.toString();
    this.abilities[idx].mod = Character.calcMod(cur);
  }

  get spentPoints() {
    return this.abilities.reduce((sum, ab) => sum + (parseInt(ab.score, 10) || 0), 0);
  }

  get remainingPoints() {
    const max = parseInt(this.maxBudgetPoints, 10) || 75;
    return max - this.spentPoints;
  }

  get tabTitle() {
    const name = (this.name || "").replace(/<[^>]*>/g, '').split('(')[0].trim();
    const sub = [this.race, this.class].map(s => (s || "").replace(/<[^>]*>/g, '').trim()).filter(Boolean).join(' • ');
    if (name && sub) return `${name} (${sub})`;
    if (name) return name;
    if (sub) return sub;
    return "Новый герой";
  }

  toJSON() {
    return { ...this };
  }
}