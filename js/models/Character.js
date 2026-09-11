/**
 * Модель данных одного персонажа D&D 5e с автоматическим расчетом параметров
 */
import { DND_RACES } from '../data/racesData.js';
import { DND_CLASSES } from '../data/classesData.js';

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
    this.class = data.class || "Воин";
    this.meta = data.meta || "";
    this.level = data.level || "1";
    this.avatar = data.avatar || "";
    this.description = data.description || "";

    // Бонус инициативы (для черт, заклинаний и ручной подстройки)
    this.initBonus = data.initBonus !== undefined ? parseInt(data.initBonus, 10) : 0;

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
    const rawAbilities = data.abilities || [
      { name: "СИЛА", score: defaultScore },
      { name: "ЛОВКОСТЬ", score: defaultScore },
      { name: "ТЕЛОСЛОЖ.", score: defaultScore },
      { name: "ИНТЕЛЛЕКТ", score: defaultScore },
      { name: "МУДРОСТЬ", score: defaultScore },
      { name: "ХАРИЗМА", score: defaultScore }
    ];

    this.abilities = rawAbilities.map(ab => {
      const base = ab.baseScore !== undefined ? ab.baseScore : (ab.score || defaultScore);
      return {
        name: ab.name,
        baseScore: base.toString(),
        score: ab.score || base.toString(),
        mod: ab.mod || "+0",
        raceBonus: 0
      };
    });

    this.attacks = data.attacks || [
      { name: "Оружие", hit: "d20 + 2", dmg: "1d6 + 0" }
    ];

    this.deathSuccess = data.deathSuccess || 0;
    this.deathFail = data.deathFail || 0;
    this.inventory = data.inventory || "Стандартный походный набор, 10 gp.";

    // Изолированные категории умений
    this.raceFeatures = data.raceFeatures || {};   // Словарь: key -> html (от расы)
    this.classFeatures = data.classFeatures || {}; // Словарь: key -> html (от класса)

    if (data.customFeatures) {
      this.customFeatures = data.customFeatures;
    } else if (Array.isArray(data.features)) {
      // Миграция старых данных: оставляем только пользовательские умения
      this.customFeatures = data.features.filter(f => !f.includes("<!--id:"));
    } else {
      this.customFeatures = [
        "<b>Черта/Способность:</b> Описание способности."
      ];
    }

    this.syncRaceTraits();
    this.syncClassFeatures();
    this.recalcDerivedStats();
  }

  getClassConfig() {
    if (!this.class) return null;
    const cleanClass = this.class.trim().toLowerCase();
    for (const [key, cfg] of Object.entries(DND_CLASSES)) {
      if (cleanClass.includes(key.toLowerCase()) || key.toLowerCase().includes(cleanClass)) {
        return cfg;
      }
    }
    return null;
  }

  syncClassFeatures() {
    const classCfg = this.getClassConfig();
    this.classFeatures = {}; // Полная очистка умений прошлого класса

    if (!classCfg) {
      this.recalcDerivedStats();
      return;
    }

    // 1. Автоматическая привязка кости здоровья (Hit Die: d6, d8, d10, d12)
    if (classCfg.hitDie) {
      this.baseHpDice = classCfg.hitDie;
    }

    // 2. Установка ресурсов класса для 5-й плашки
    if (classCfg.extra) {
      this.extraTitle = classCfg.extra.title;
      this.extraVal = classCfg.extra.val;
      this.extraSub = classCfg.extra.sub;
    }

    const lvl = Math.max(1, parseInt(this.level, 10) || 1);

    // 3. Постоянные умения 1-го уровня
    if (classCfg.baseFeatures) {
      Object.entries(classCfg.baseFeatures).forEach(([key, html]) => {
        this.classFeatures[key] = html;
      });
    }

    // 4. Масштабируемые умения под текущий уровень (Скрытая атака, Кара и т.д.)
    if (classCfg.scalingFeatures) {
      Object.entries(classCfg.scalingFeatures).forEach(([key, resolver]) => {
        const text = resolver(lvl);
        if (text) {
          this.classFeatures[key] = text;
        }
      });
    }

    this.recalcDerivedStats();
  }

  get features() {
    return [
      ...Object.values(this.raceFeatures || {}),
      ...Object.values(this.classFeatures || {}),
      ...(this.customFeatures || [])
    ];
  }

  getRaceStatBonus(abilityName) {
    const raceCfg = this.getRaceConfig();
    if (!raceCfg || !raceCfg.stats) return 0;

    const clean = (abilityName || "").trim().toUpperCase();
    for (const [statKey, bonus] of Object.entries(raceCfg.stats)) {
      if (clean.startsWith(statKey.substring(0, 3)) || statKey.startsWith(clean.substring(0, 3))) {
        return bonus;
      }
    }
    return 0;
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

  getRaceConfig() {
    if (!this.race) return null;
    const cleanRace = this.race.trim().toLowerCase();
    for (const [key, cfg] of Object.entries(DND_RACES)) {
      if (cleanRace.includes(key.toLowerCase()) || key.toLowerCase().includes(cleanRace)) {
        return cfg;
      }
    }
    return null;
  }

  upsertFeature(key, htmlText) {
    const marker = `<!--id:${key}-->`;
    const existingIdx = this.features.findIndex(f => f && f.includes(marker));

    if (!htmlText) {
      // Если уровень понизился и способность больше недоступна — удаляем
      if (existingIdx !== -1) {
        this.features.splice(existingIdx, 1);
      }
      return;
    }

    const payload = `${marker}${htmlText}`;

    if (existingIdx !== -1) {
      // Обновляем урон / СЛ на месте без дублирования
      this.features[existingIdx] = payload;
    } else {
      // Удаляем дефолтную заглушку, если она всё ещё висит
      if (this.features.length === 1 && this.features[0].includes("Черта/Способность")) {
        this.features = [];
      }
      this.features.push(payload);
    }
  }

  syncRaceTraits() {
    const raceCfg = this.getRaceConfig();

    // 1. Полная очистка умений предыдущей расы
    this.raceFeatures = {};

    if (!raceCfg) {
      this.recalcDerivedStats();
      return;
    }

    // 2. Обновление скорости расы
    if (raceCfg.speed) this.speed = raceCfg.speed;
    if (raceCfg.speedSub) this.speedSub = raceCfg.speedSub;

    const lvl = Math.max(1, parseInt(this.level, 10) || 1);
    const conMod = this.getAbilityNumMod("ТЕЛО");
    const profBonus = Math.floor((lvl - 1) / 4) + 2;

    // 3. Запись постоянных черт новой расы
    if (raceCfg.baseFeatures) {
      Object.entries(raceCfg.baseFeatures).forEach(([key, html]) => {
        this.raceFeatures[key] = html;
      });
    }

    // 4. Запись масштабируемых черт под текущий уровень
    if (raceCfg.scalingFeatures) {
      Object.entries(raceCfg.scalingFeatures).forEach(([key, resolver]) => {
        const text = resolver(lvl, conMod, profBonus);
        if (text) {
          this.raceFeatures[key] = text;
        }
      });
    }

    this.recalcDerivedStats();
  }

  recalcDerivedStats() {
    this.abilities.forEach(ab => {
      const bonus = this.getRaceStatBonus(ab.name);
      ab.raceBonus = bonus;

      const rawBase = ab.baseScore !== undefined ? ab.baseScore : ab.score;
      const parsedBase = parseInt(rawBase, 10);
      const defaultFloor = this.budgetMode === "point_buy" ? 8 : 0;
      const base = !isNaN(parsedBase) ? parsedBase : defaultFloor;
      ab.baseScore = base.toString();

      // Итоговое значение: База + Раса
      const total = base + bonus;
      ab.score = total.toString();
      const modNum = Character.calcMod(total);
      ab.mod = Character.formatMod(modNum);
    });

    const dexMod = this.getAbilityNumMod("ЛОВК");
    const conMod = this.getAbilityNumMod("ТЕЛО");
    const lvl = Math.max(1, parseInt(this.level, 10) || 1);

    const totalInit = dexMod + (parseInt(this.initBonus, 10) || 0);
    this.init = Character.formatMod(totalInit);
    this.initSub = totalInit >= 0 ? `d20+${totalInit}` : `d20${totalInit}`;

    const totalAC = 10 + dexMod + (parseInt(this.armorBonus, 10) || 0);
    this.ac = totalAC.toString();

    const raceCfg = this.getRaceConfig();
    const raceHpBonus = (raceCfg?.hpPerLevel || 0) * lvl;

    const baseHp = parseInt(this.baseHpDice, 10) || 8;
    const avgGain = Math.floor(baseHp / 2) + 1;
    const extra = parseInt(this.hpMaxExtra, 10) || 0;

    const calculatedMax = Math.max(
      1,
      baseHp + (avgGain * (lvl - 1)) + (conMod * lvl) + raceHpBonus + extra
    );
    this.hpMax = calculatedMax.toString();
  }

  changeInitBonus(delta) {
    this.initBonus = (parseInt(this.initBonus, 10) || 0) + delta;
    this.recalcDerivedStats();
  }

  resetInit() {
    this.initBonus = 0; // Обнуляем ручной бонус
    this.recalcDerivedStats(); // Пересчитываем строго от модификатора Ловкости
  }

  changeAbilityScore(idx, delta) {
    const ab = this.abilities[idx];
    const bonus = this.getRaceStatBonus(ab.name);

    let curBase = parseInt(ab.baseScore, 10);
    if (isNaN(curBase)) {
      curBase = this.budgetMode === "point_buy" ? 8 : 0;
    }
    const nextBase = curBase + delta;

    if (this.budgetMode === "point_buy") {
      if (delta > 0 && curBase >= 15) {
        const maxWithRace = 15 + bonus;
        return {
          error: bonus > 0
            ? `Максимум покупки — 15 (итоговый с расой: ${maxWithRace})`
            : "Максимум покупки в Point Buy — 15"
        };
      }
      if (delta < 0 && curBase <= 8) {
        const minWithRace = 8 + bonus;
        return {
          error: bonus > 0
            ? `Минимум покупки — 8 (итоговый с расой: ${minWithRace})`
            : "Минимум покупки в Point Buy — 8"
        };
      }
      const curCost = Character.getPointBuyCost(curBase);
      const nextCost = Character.getPointBuyCost(nextBase);
      const costDiff = nextCost - curCost;

      if (delta > 0 && this.remainingPoints < costDiff) {
        return { error: `Не хватает очков! Нужно: ${costDiff}, осталось: ${this.remainingPoints}` };
      }
    } else {
      // Режим прямой суммы (free_sum)
      if (delta > 0 && nextBase > 30) {
        return { error: "Максимальное базовое значение — 30" };
      }
      if (delta < 0 && nextBase < 0) {
        return { error: "Минимум в прямой сумме — 0" };
      }
      if (delta > 0 && this.remainingPoints < delta) {
        return { error: `Лимит очков (${this.maxBudgetPoints}) исчерпан!` };
      }
    }

    ab.baseScore = nextBase.toString();
    this.recalcDerivedStats();
    return { success: true };
  }

  setBudgetMode(mode) {
    if (this.budgetMode === mode) return;
    this.budgetMode = mode;
    if (mode === "point_buy") {
      this.maxBudgetPoints = "27";
      this.abilities.forEach(ab => {
        let sc = parseInt(ab.baseScore, 10) || 8;
        if (sc < 8) sc = 8;
        if (sc > 15) sc = 15;
        ab.baseScore = sc.toString();
      });
    } else {
      this.maxBudgetPoints = "72";
    }
    this.recalcDerivedStats();
  }

  get spentPoints() {
    if (this.budgetMode === "point_buy") {
      return this.abilities.reduce((sum, ab) => {
        const base = parseInt(ab.baseScore, 10);
        const safeBase = !isNaN(base) ? base : 8;
        return sum + Character.getPointBuyCost(safeBase);
      }, 0);
    }
    // Прямая сумма: считаем строго чистые очки игрока без учета бонуса расы
    return this.abilities.reduce((sum, ab) => {
      const base = parseInt(ab.baseScore, 10);
      return sum + (!isNaN(base) ? base : 0);
    }, 0);
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
