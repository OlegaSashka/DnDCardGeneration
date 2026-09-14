/**
 * Модель данных одного персонажа D&D 5e с автоматическим расчетом параметров
 */
import { DND_RACES } from '../data/racesData.js';
import { DND_CLASSES } from '../data/classesData.js';
import { DND_WEAPONS } from '../data/weaponsData.js';
import { DND_ARMORS } from '../data/armorsData.js';
import { DND_FEATS } from '../data/featsData.js';

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
    // Доспех персонажа
    this.armor = data.armor || "Без доспеха";
    this.hasShield = data.hasShield !== undefined ? Boolean(data.hasShield) : false;

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

    // Изолированные категории оружия и атак
    this.classAttacks = Array.isArray(data.classAttacks) ? data.classAttacks : [];

    if (Array.isArray(data.customAttacks)) {
      this.customAttacks = data.customAttacks.filter(a => a && !a.name.toLowerCase().includes("щит"));
    } else if (Array.isArray(data.attacks)) {
      // Миграция старых данных: отсекаем заглушки и щит из оружия
      this.customAttacks = data.attacks.filter(a => a && a.name && a.name !== "Оружие" && !a.name.toLowerCase().includes("щит"));
    } else {
      this.customAttacks = [];
    }

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

    // Изолированные категории оружия и атак
    this.classAttacks = data.classAttacks || [];
    if (data.customAttacks) {
      this.customAttacks = data.customAttacks;
    } else if (Array.isArray(data.attacks)) {
      this.customAttacks = data.attacks.filter(a => a && a.name && a.name !== "Оружие");
    } else {
      this.customAttacks = [];
    }

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

  // Бонус мастерства от уровня (D&D 5e: 1-4 ур: +2, 5-8 ур: +3 и т.д.)
  get profBonus() {
    const lvl = Math.max(1, parseInt(this.level, 10) || 1);
    return Math.floor((lvl - 1) / 4) + 2;
  }

  // Быстрый доступ к модификаторам всех 6 характеристик
  get strMod() { return this.getAbilityNumMod("СИЛ"); }
  get dexMod() { return this.getAbilityNumMod("ЛОВ"); }
  get conMod() { return this.getAbilityNumMod("ТЕЛО"); }
  get intMod() { return this.getAbilityNumMod("ИНТ"); }
  get wisMod() { return this.getAbilityNumMod("МУД"); }
  get chaMod() { return this.getAbilityNumMod("ХАР"); }

  // Универсальный резолвер модификатора по текстовому ключу
  getModByStat(statKey) {
    switch ((statKey || "").toUpperCase()) {
      case "ЛОВ": return this.dexMod;
      case "СИЛ": return this.strMod;
      case "ТЕЛО": return this.conMod;
      case "ИНТ": return this.intMod;
      case "МУД": return this.wisMod;
      case "ХАР": return this.chaMod;
      case "ЛОВ_ИЛИ_СИЛ": return Math.max(this.dexMod, this.strMod);
      default: return this.strMod;
    }
  }

  // Универсальный сборщик всех эффектов со всех активных черт
  getActiveModifiers() {
    const mods = {
      acBonus: 0,
      initBonus: 0,
      hpPerLvl: 0,
      weaponProf: []
    };

    (this.feats || []).forEach(featKey => {
      const feat = DND_FEATS[featKey];
      if (!feat) return;

      if (feat.acBonus) mods.acBonus += feat.acBonus;
      if (feat.initBonus) mods.initBonus += feat.initBonus;
      if (feat.hpPerLvl) mods.hpPerLvl += feat.hpPerLvl;
      if (Array.isArray(feat.weaponProf)) mods.weaponProf.push(...feat.weaponProf);
    });

    return mods;
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

  // Нечеткий поиск оружия в справочнике (опечатки, недопечатки, префиксы)
  static findWeaponMatch(rawName) {
    const clean = (rawName || "").toLowerCase().trim();
    if (!clean) return null;

    // 1. Точное совпадение или прямое вхождение подстроки
    for (const [key, cfg] of Object.entries(DND_WEAPONS)) {
      const k = key.toLowerCase();
      if (clean === k || clean.includes(k) || k.includes(clean)) {
        return [key, cfg];
      }
    }

    // Алгоритм расстояния Левенштейна для поиска опечаток
    const getLevenshteinDistance = (s1, s2) => {
      const m = s1.length, n = s2.length;
      const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          dp[i][j] = s1[i - 1] === s2[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
      return dp[m][n];
    };

    const inputWords = clean.split(/\s+/).filter(Boolean);

    // 2. Поиск по префиксам слов (недопечатки: «длин меч», «корот лук», «рапир»)
    for (const [key, cfg] of Object.entries(DND_WEAPONS)) {
      const keyWords = key.toLowerCase().split(/\s+/);
      const allWordsMatchPrefix = inputWords.length > 0 && inputWords.every(w =>
        w.length >= 3 && keyWords.some(kw => kw.startsWith(w) || w.startsWith(kw))
      );
      if (allWordsMatchPrefix) {
        return [key, cfg];
      }
    }

    // 3. Поиск по опечаткам («кинжл», «секиро», «длиный меч»)
    let bestMatch = null;
    let minDistance = Infinity;

    for (const [key, cfg] of Object.entries(DND_WEAPONS)) {
      const k = key.toLowerCase();
      const d = getLevenshteinDistance(clean, k);
      const allowedErrors = k.length > 6 ? 2 : 1; // 1 опечатка для коротких слов, 2 для длинных
      if (d <= allowedErrors && d < minDistance) {
        minDistance = d;
        bestMatch = [key, cfg];
      }
    }

    return bestMatch;
  }

// Проверка владения оружием (автоматически от класса и расы)
  checkDefaultWeaponProficiency(weaponName) {
    if (!weaponName) return false;
    const clean = weaponName.toLowerCase().trim();

    const match = Character.findWeaponMatch(clean);
    // Если оружие не в каталоге — его категория "improvised"
    const category = match ? match[1].category : "improvised";
    const stdName = match ? match[0].toLowerCase() : clean;

    const classCfg = this.getClassConfig();
    const raceCfg = this.getRaceConfig();

    const mods = this.getActiveModifiers();

    // Единый массив всех владений персонажа (Класс + Раса + Черты)
    const allProfs = [
      ...(classCfg?.weaponProficiencies || []),
      ...(raceCfg?.weaponProficiencies || []),
      ...mods.weaponProf
    ].map(p => p.toLowerCase());

    // Проверяем: совпала ли категория (simple, martial, improvised) или точное имя оружия
    return allProfs.includes(category) || allProfs.includes(stdName);
  }

  // Расчет атаки конкретного оружия
  calcWeaponStats(weaponName, isProfOverride = null) {
    const cleanName = (weaponName || "").trim();
    if (!cleanName) return null;

    const baseQuery = cleanName
      .replace(/\s*\*+$/g, '')
      .replace(/\s*[\(\[]?(импров|improv)[\.а-яa-z]*[\)\]]?/gi, '')
      .trim();

    const match = Character.findWeaponMatch(baseQuery || cleanName);

    // Определяем статус владения: ручной оверрайд или автоопределение
    const isProficient = (isProfOverride !== null)
      ? Boolean(isProfOverride)
      : this.checkDefaultWeaponProficiency(baseQuery || cleanName);

    if (match) {
      const [standardName, w] = match;
      const finalName = (cleanName.length > standardName.length + 4) ? cleanName : standardName;

      const allowedStats = Array.isArray(w.stats) ? w.stats : ["СИЛ"];
      let bestStat = allowedStats[0];
      let maxMod = this.getAbilityNumMod(bestStat);

      for (let i = 1; i < allowedStats.length; i++) {
        const curMod = this.getAbilityNumMod(allowedStats[i]);
        if (curMod > maxMod) {
          maxMod = curMod;
          bestStat = allowedStats[i];
        }
      }

      const mod = maxMod;
      const statKey = bestStat;

      // Прибавляем бонус мастерства ТОЛЬКО при наличии владения
      const profToAdd = isProficient ? this.profBonus : 0;
      const hitTotal = mod + profToAdd;
      const hit = `d20 ${hitTotal >= 0 ? '+' : '-'} ${Math.abs(hitTotal)} (${statKey})`;

      let dmg = w.dice;
      if (mod !== 0) {
        dmg += ` ${mod >= 0 ? '+' : '-'} ${Math.abs(mod)} (${statKey})`;
      } else {
        dmg += ` (${statKey})`;
      }
      if (w.type) {
        dmg += ` ${w.type}`;
      }

      const tooltip = `Владение: ${isProficient ? 'Да (+ ' + this.profBonus + ')' : 'Нет (+0)'}\n` +
                      `Попадание: d20 + ${profToAdd} (Маст.) ${mod >= 0 ? '+' : '-'} ${Math.abs(mod)} (${statKey}) = ${hit}\n` +
                      `Урон: ${w.dice} ${mod >= 0 ? '+' : '-'} ${Math.abs(mod)} (${statKey})`;

      return { name: finalName, hit, dmg, tooltip, isProficient, isImprovised: false };
    }

    // Импровизированное оружие (*)
    const finalName = `${baseQuery || cleanName} *`;
    const str = this.strMod;
    const profToAdd = isProficient ? this.profBonus : 0;
    const hitTotal = str + profToAdd;
    const hit = `d20 ${hitTotal >= 0 ? '+' : '-'} ${Math.abs(hitTotal)} (СИЛ)`;
    const dmg = `1d4 ${str !== 0 ? (str >= 0 ? '+' : '-') + ' ' + Math.abs(str) + ' ' : ''}дробящий`;

    return { name: finalName, hit, dmg, isProficient, isImprovised: true };
  }

// Перерасчет обеих категорий атак от текущих характеристик
  recalcAttacks() {
    const all = [...(this.classAttacks || []), ...(this.customAttacks || [])];
    all.forEach(atk => {
      const calculated = this.calcWeaponStats(atk.name);
      if (calculated) {
        atk.hit = calculated.hit;
        atk.dmg = calculated.dmg;
      }
    });
  }

// Применение стартового арсенала класса (чистит только категорию класса)
  applyClassWeapons(force = true) {
    const classCfg = this.getClassConfig();
    if (!force && this.classAttacks && this.classAttacks.length > 0) {
      return;
    }

    this.classAttacks = []; // Сбрасываем оружие предыдущего класса

    if (!classCfg || !classCfg.defaultWeapons) return;

    this.classAttacks = classCfg.defaultWeapons.map(weaponName => {
      const stats = this.calcWeaponStats(weaponName);
      return stats || { name: weaponName, hit: "d20 + 2", dmg: "1d6" };
    });
  }

  syncClassFeatures() {
    const classCfg = this.getClassConfig();
    this.classFeatures = {}; // Очистка умений прошлого класса

    if (!classCfg) {
      this.classAttacks = [];
      this.recalcDerivedStats();
      return;
    }

    if (classCfg.hitDie) {
      this.baseHpDice = classCfg.hitDie;
    }

    if (classCfg.extra) {
      this.extraTitle = classCfg.extra.title;
      this.extraVal = classCfg.extra.val;
      this.extraSub = classCfg.extra.sub;
    }

    if (classCfg.defaultArmor && (!this.armor || this.armor === "Без доспеха")) {
      this.armor = classCfg.defaultArmor;
    }

    const lvl = Math.max(1, parseInt(this.level, 10) || 1);

    if (classCfg.baseFeatures) {
      Object.entries(classCfg.baseFeatures).forEach(([key, html]) => {
        this.classFeatures[key] = html;
      });
    }

    if (classCfg.scalingFeatures) {
      Object.entries(classCfg.scalingFeatures).forEach(([key, resolver]) => {
        const text = resolver(lvl);
        if (text) {
          this.classFeatures[key] = text;
        }
      });
    }

    // Принудительно обновляем классовый арсенал под выбранный класс
    this.applyClassWeapons(true);
    this.recalcDerivedStats();
  }

  get features() {
    return [
      ...Object.values(this.raceFeatures || {}),
      ...Object.values(this.classFeatures || {}),
      ...(this.customFeatures || [])
    ];
  }

  get attacks() {
    return [
      ...(this.classAttacks || []),
      ...(this.customAttacks || [])
    ];
  }

  // Строка экипировки для PDF и подсказок
  get armorLabel() {
    const parts = [this.armor || "Без доспеха"];
    if (this.hasShield) parts.push("Щит (+2)");
    if (this.armorBonus) parts.push(`${this.armorBonus > 0 ? '+' : ''}${this.armorBonus}`);
    return parts.join(" • ");
  }

  setArmor(armorName) {
    this.armor = DND_ARMORS[armorName] ? armorName : "Без доспеха";
    this.recalcDerivedStats();
  }

  setArmor(armorName) {
    this.armor = DND_ARMORS[armorName] ? armorName : "Без доспеха";
    this.acSub = `${this.armor}${this.hasShield ? ' + Щит' : ''}`;
    this.recalcDerivedStats();
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
    const lvl = Math.max(1, parseInt(this.level, 10) || 1);
    const raceCfg = this.getRaceConfig();
    const armorCfg = DND_ARMORS[this.armor] || DND_ARMORS["Без доспеха"];

    // 1. Характеристики (База + Раса -> Итоговый счет и модификатор)
    this.abilities.forEach(ab => {
      const bonus = this.getRaceStatBonus(ab.name);
      ab.raceBonus = bonus;

      const rawBase = ab.baseScore !== undefined ? ab.baseScore : ab.score;
      const parsedBase = parseInt(rawBase, 10);
      const defaultFloor = this.budgetMode === "point_buy" ? 8 : 0;
      const base = !isNaN(parsedBase) ? parsedBase : defaultFloor;
      ab.baseScore = base.toString();

      const total = base + bonus;
      ab.score = total.toString();
      ab.mod = Character.formatMod(Character.calcMod(total));
    });

    // 2. Модификаторы основных характеристик и активных черт
    const dexMod = this.getAbilityNumMod("ЛОВ");
    const conMod = this.getAbilityNumMod("ТЕЛО");
    const mods = this.getActiveModifiers();

    // 3. Класс Доспеха (КД)
    let effectiveDex = dexMod;
    if (armorCfg.maxDex === 0) {
      effectiveDex = 0; // Тяжелые доспехи игнорируют Ловкость
    } else if (armorCfg.maxDex !== null) {
      effectiveDex = Math.min(dexMod, armorCfg.maxDex); // Средние доспехи: максимум +2
    }

    const shieldBonus = this.hasShield ? 2 : 0;
    const manualAcBonus = parseInt(this.armorBonus, 10) || 0;
    const totalAC = armorCfg.baseAC + effectiveDex + shieldBonus + manualAcBonus + (mods.acBonus || 0);
    this.ac = totalAC.toString();

    // 4. Инициатива (Ловкость + Ручной бонус + Бонус черт)
    const manualInitBonus = parseInt(this.initBonus, 10) || 0;
    const totalInit = dexMod + manualInitBonus + (mods.initBonus || 0);
    this.init = Character.formatMod(totalInit);
    this.initSub = totalInit >= 0 ? `d20+${totalInit}` : `d20${totalInit}`;

    // 5. Скорость и помеха на скрытность от доспеха
    const baseSpeedMeters = raceCfg?.speedSub || "9м";
    this.speedSub = armorCfg.stealthDisadv
      ? `${baseSpeedMeters} • Помеха скрытности`
      : baseSpeedMeters;

    // 6. Максимум здоровья (HP)
    const baseDice = parseInt(this.baseHpDice, 10) || 8;
    const avgGain = Math.floor(baseDice / 2) + 1;
    const raceHpBonus = (raceCfg?.hpPerLevel || 0) * lvl;
    const featHpBonus = (mods.hpPerLvl || 0) * lvl;
    const manualHpExtra = parseInt(this.hpMaxExtra, 10) || 0;

    const calculatedMax = Math.max(
      1,
      baseDice + (avgGain * (lvl - 1)) + (conMod * lvl) + raceHpBonus + featHpBonus + manualHpExtra
    );
    this.hpMax = calculatedMax.toString();

    // 7. Перерасчет бросков атак и урона
    this.recalcAttacks();
  }

  toggleShield() {
    this.hasShield = !this.hasShield;
    this.recalcDerivedStats();
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
    return {
      ...this,
      attacks: this.attacks
    };
  }
}
