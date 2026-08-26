/**
 * Модель данных одного персонажа D&D 5e с автоматическим расчетом параметров
 */
export class Character {
  // Официальная таблица стоимости характеристик в Point Buy
  static POINT_BUY_COSTS = {
    8: 0,
    9: 1,
    10: 2,
    11: 3,
    12: 4,
    13: 5,
    14: 7,
    15: 9
  };

  constructor(data = {}) {
    this.id = data.id || `char_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.name = data.name || "";
    this.race = data.race || "Человек";
    this.class = data.class || "";
    this.meta = data.meta || "";
    this.level = data.level || "1";
    this.avatar = data.avatar || "";
    this.description = data.description || "";

    this.fontSizes = data.fontSizes || {
      attacks: 7.5,
      inventory: 7.5,
      features: 7.5,
      description: 8.0
    };

    // Режим начисления очков: 'point_buy' (27 очков) или 'free_sum' (72 очка)
    this.budgetMode = data.budgetMode || "point_buy";
    this.maxBudgetPoints = data.maxBudgetPoints || (this.budgetMode === "point_buy" ? "27" : "72");

    // Поля HP
    this.hpCur = data.hpCur || "";
    this.hpBonus = data.hpBonus || "";
    this.hpMaxExtra = data.hpMaxExtra !== undefined ? parseInt(data.hpMaxExtra, 10) : 0;
    this.baseHpDice = data.baseHpDice !== undefined ? parseInt(data.baseHpDice, 10) : 8;

    // КД и броня
    this.armorBonus = data.armorBonus !== undefined ? parseInt(data.armorBonus, 10) : 0;
    this.acSub = data.acSub || "Без доспеха";

    // Скорость и доп. поля
    this.speed = data.speed || "30 фт";
    this.speedSub = data.speedSub || "9м";
    this.extraTitle = data.extraTitle || "Вдохновение";
    this.extraVal = data.extraVal || "□";
    this.extraSub = data.extraSub || "Переброс d20";

    const defaultScore = this.budgetMode === "point_buy" ? "8" : "12";
    this.abilities = data.abilities || [
      { name: "СИЛА", mod: "-1", score: defaultScore },
      { name: "ЛОВКОСТЬ", mod: "-1", score: defaultScore },
      { name: "ТЕЛОСЛОЖ.", mod: "-1", score: defaultScore },
      { name: "ИНТЕЛЛЕКТ", mod: "-1", score: defaultScore },
      { name: "МУДРОСТЬ", mod: "-1", score: defaultScore },
      { name: "ХАРИЗМА", mod: "-1", score: defaultScore }
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

    this.recalcDerivedStats();
  }

  changeFontSize(section, delta) {
    if (!this.fontSizes) {
      this.fontSizes = { attacks: 7.5, inventory: 7.5, features: 7.5, description: 8.0 };
    }
    const current = parseFloat(this.fontSizes[section]) || 7.5;
    const next = Math.round((current + delta) * 10) / 10;
    // Ограничиваем размер от 5pt до 14pt
    this.fontSizes[section] = Math.max(5, Math.min(14, next));
  }

  static calcMod(score) {
    const num = parseInt(score, 10);
    if (isNaN(num)) return 0;
    return Math.floor((num - 10) / 2);
  }

  static formatMod(modNum) {
    return modNum >= 0 ? `+${modNum}` : `${modNum}`;
  }

  static getPointBuyCost(score) {
    const s = parseInt(score, 10) || 8;
    if (s <= 8) return 0;
    if (s >= 15) return 9;
    return Character.POINT_BUY_COSTS[s] ?? 0;
  }

  getAbilityNumMod(namePrefix) {
    const ab = this.abilities.find(a => a.name.toUpperCase().startsWith(namePrefix.toUpperCase()));
    const score = ab ? parseInt(ab.score, 10) : 10;
    return Character.calcMod(score);
  }

  recalcDerivedStats() {
    this.abilities.forEach(ab => {
      const modNum = Character.calcMod(ab.score);
      ab.mod = Character.formatMod(modNum);
    });

    const dexMod = this.getAbilityNumMod("ЛОВК");
    const conMod = this.getAbilityNumMod("ТЕЛО");
    const lvl = Math.max(1, parseInt(this.level, 10) || 1);

    this.init = Character.formatMod(dexMod);
    this.initSub = dexMod >= 0 ? `d20+${dexMod}` : `d20${dexMod}`;

    const totalAC = 10 + dexMod + (parseInt(this.armorBonus, 10) || 0);
    this.ac = totalAC.toString();

    const baseHp = parseInt(this.baseHpDice, 10) || 8;
    const avgGain = Math.floor(baseHp / 2) + 1;
    const extra = parseInt(this.hpMaxExtra, 10) || 0;

    const calculatedMax = Math.max(
      1,
      baseHp + (avgGain * (lvl - 1)) + (conMod * lvl) + extra
    );
    this.hpMax = calculatedMax.toString();
  }

  setBudgetMode(mode) {
    if (this.budgetMode === mode) return;
    this.budgetMode = mode;
    if (mode === "point_buy") {
      this.maxBudgetPoints = "27";
      this.abilities.forEach(ab => {
        let sc = parseInt(ab.score, 10) || 8;
        if (sc < 8) sc = 8;
        if (sc > 15) sc = 15;
        ab.score = sc.toString();
      });
    } else {
      this.maxBudgetPoints = "72";
    }
    this.recalcDerivedStats();
  }

  changeAbilityScore(idx, delta) {
    let cur = parseInt(this.abilities[idx].score, 10);
    if (isNaN(cur)) cur = this.budgetMode === "point_buy" ? 8 : 10;
    const next = cur + delta;

    if (this.budgetMode === "point_buy") {
      if (delta > 0 && cur >= 15) {
        return { error: "В Point Buy максимум 15 на 1-м уровне" };
      }
      if (delta < 0 && cur <= 8) {
        return { error: "Минимум в Point Buy — 8" };
      }
      const curCost = Character.getPointBuyCost(cur);
      const nextCost = Character.getPointBuyCost(next);
      const costDiff = nextCost - curCost;

      if (delta > 0 && this.remainingPoints < costDiff) {
        return { error: `Не хватает очков! Нужно: ${costDiff}, осталось: ${this.remainingPoints}` };
      }
    } else {
      // Режим прямой суммы (free_sum)
      if (delta > 0 && cur >= 30) {
        return { error: "Максимальное значение характеристики — 30" };
      }
      if (delta < 0 && cur <= 1) {
        return { error: "Минимальное значение характеристики — 1" };
      }
      if (delta > 0 && this.remainingPoints < delta) {
        return { error: `Лимит очков (${this.maxBudgetPoints}) исчерпан!` };
      }
    }

    this.abilities[idx].score = next.toString();
    this.recalcDerivedStats();
    return { success: true };
  }

  changeArmorBonus(delta) {
    this.armorBonus = (parseInt(this.armorBonus, 10) || 0) + delta;
    this.recalcDerivedStats();
  }

  changeMaxHPExtra(delta) {
    this.hpMaxExtra = (parseInt(this.hpMaxExtra, 10) || 0) + delta;
    this.recalcDerivedStats();
  }

  changeLevel(delta) {
    let lvl = parseInt(this.level, 10) || 1;
    lvl = Math.max(1, Math.min(20, lvl + delta));
    this.level = lvl.toString();
    this.recalcDerivedStats();
  }

  resetAC() {
    this.armorBonus = 0;
    this.recalcDerivedStats();
  }

  resetHPMax() {
    this.hpMaxExtra = 0;
    this.recalcDerivedStats();
  }

  get spentPoints() {
    if (this.budgetMode === "point_buy") {
      return this.abilities.reduce((sum, ab) => {
        return sum + Character.getPointBuyCost(ab.score);
      }, 0);
    }
    return this.abilities.reduce((sum, ab) => sum + (parseInt(ab.score, 10) || 0), 0);
  }

  get maxBudget() {
    if (this.budgetMode === "point_buy") {
      return parseInt(this.maxBudgetPoints, 10) || 27;
    }
    return parseInt(this.maxBudgetPoints, 10) || 72;
  }

  get remainingPoints() {
    return this.maxBudget - this.spentPoints;
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