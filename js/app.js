import { Character } from './models/Character.js';
import { CharacterAPI } from './services/CharacterAPI.js';
import { PDFExporter } from './services/PDFExporter.js';
import { DND_RACES } from './data/racesData.js';
import { DND_CLASSES } from './data/classesData.js';
import { DND_WEAPONS } from './data/weaponsData.js';
import { DND_ARMORS } from './data/armorsData.js';

class DnDApp {
  constructor() {
    this.characters = [];
    this.activeCharId = localStorage.getItem("dnd_active_char_id") || null;
    this.autoSaveTimer = null;
  }

  async init() {
    this.characters = await CharacterAPI.loadAll();

    if (this.activeCharacter) {
      this.activeCharacter.syncRaceTraits();
      this.activeCharacter.syncClassFeatures();
    }
    this.render();

    if (this.characters.length === 0) {
      await this.addNewCharacter();
    } else {
      // Проверяем, существует ли сохранённый ID среди загруженных персонажей
      const savedId = localStorage.getItem("dnd_active_char_id");
      const exists = this.characters.some(c => c.id === savedId);

      if (savedId && exists) {
        this.activeCharId = savedId;
      } else {
        // Если ID не найден или карточка была удалена — выбираем первого
        this.setActiveCharacter(this.characters[0].id);
      }
      this.render();
    }
    this.bindGlobalEvents();
  }

  addFeature() {
    this.saveCurrentDOM();
    if (!this.activeCharacter.customFeatures) {
      this.activeCharacter.customFeatures = [];
    }
    this.activeCharacter.customFeatures.push("<b>Новая способность:</b> Текст умения.");
    this.renderActiveCard();
  }

  deleteFeature(type, id) {
    this.saveCurrentDOM();
    const c = this.activeCharacter;
    if (type === 'race' && c.raceFeatures) {
      delete c.raceFeatures[id];
    } else if (type === 'class' && c.classFeatures) {
      delete c.classFeatures[id];
    } else if (type === 'custom' && c.customFeatures) {
      c.customFeatures.splice(id, 1);
    }
    this.renderActiveCard();
  }

  changeRace(newRace) {
    this.saveCurrentDOM();
    this.activeCharacter.race = newRace;
    this.activeCharacter.syncRaceTraits();
    this.render();
    this.saveCurrentDOM();
    this.showToast(`Раса изменена: ${newRace}`);
  }

// Находим активного персонажа строго по уникальному ID
  get activeCharacter() {
    if (!this.characters || this.characters.length === 0) return null;
    const found = this.characters.find(c => c.id === this.activeCharId);
    return found || this.characters[0];
  }

  get currentIndex() {
    if (!this.characters || this.characters.length === 0) return 0;
    const idx = this.characters.findIndex(c => c.id === this.activeCharId);
    return idx !== -1 ? idx : 0;
  }

  setActiveCharacter(id) {
    this.activeCharId = id;
    localStorage.setItem("dnd_active_char_id", id);
    // Удаляем старый числовой ключ, чтобы он не конфликтовал
    localStorage.removeItem("dnd_active_index");
  }

  changeLevel(delta) {
    this.saveCurrentDOM();
    this.activeCharacter.changeLevel(delta);
    this.activeCharacter.syncRaceTraits();
    this.activeCharacter.syncClassFeatures(); // Масштабируем скрытую атаку, карания и ячейки
    this.render();
    this.saveCurrentDOM();
  }

  render() {
    this.renderTabs();
    this.renderActiveCard();
  }

  renderTabs() {
    const tabsList = document.getElementById("tabsList");
    if (!tabsList) return;
    tabsList.innerHTML = "";

    const activeChar = this.activeCharacter;
    if (!activeChar) return;

    this.characters.forEach((char) => {
      const btn = document.createElement("button");
      const isActive = char.id === activeChar.id;
      btn.className = `tab-btn ${isActive ? 'active' : ''}`;
      btn.id = `tab-btn-${char.id}`;
      btn.innerHTML = `<i class="fa-solid fa-shield-halved"></i> <span>${char.tabTitle}</span>`;

      btn.onclick = () => {
        if (this.activeCharId === char.id) return;
        this.saveCurrentDOM(); // Сохраняем текущие правки перед переходом
        this.setActiveCharacter(char.id); // Фиксируем ID в localStorage мгновенно
        this.render();
      };
      tabsList.appendChild(btn);
    });
  }

  changeInitBonus(delta) {
    this.saveCurrentDOM();
    this.activeCharacter.changeInitBonus(delta);
    this.renderActiveCard();
    this.saveCurrentDOM();
  }

  resetInit() {
    this.saveCurrentDOM();
    this.activeCharacter.resetInit(); // Вызываем сброс бонуса в модели
    this.renderActiveCard();
    this.saveCurrentDOM();
    this.showToast("Инициатива сброшена к базовой (от Ловкости)!");
  }

  changeClass(newClass) {
    this.saveCurrentDOM();
    this.activeCharacter.class = newClass;
    this.activeCharacter.syncClassFeatures();    this.activeCharacter.applyClassWeapons(true);
    this.render();
    this.saveCurrentDOM();
    this.showToast(`Класс изменен: ${newClass}`);
  }

  renderActiveCard() {
    const c = this.activeCharacter;
    const container = document.getElementById("activeCardRender");
    if (!c || !container) return;

    c.recalcDerivedStats();

    // 1. Характеристики (кнопки +/- и модификатор)
    let abilitiesHTML = "";
    c.abilities.forEach((ab, idx) => {
      abilitiesHTML += `
        <td class="ability-box">
          <div class="ability-name" contenteditable="true" data-field="ab-name-${idx}">${ab.name}</div>
          <div class="ability-mod" id="ab-mod-val-${idx}">${ab.mod}</div>
          <div class="ability-score-row" style="display:flex; align-items:center; justify-content:center; gap:2px;">
            <button class="stat-btn no-print" onclick="app.changeAbility(${idx}, -1)" title="Уменьшить (База: ${ab.baseScore})" style="cursor:pointer; width:18px; height:18px; padding:0; line-height:1;">−</button>
            <span class="ability-score-badge" title="Итого: ${ab.score} (База: ${ab.baseScore}${ab.raceBonus ? ' + ' + ab.raceBonus + ' раса' : ''})" style="min-width:18px; font-weight:bold; ${ab.raceBonus ? 'color:#1d4ed8;' : ''}">${ab.score || "10"}</span>
            <button class="stat-btn no-print" onclick="app.changeAbility(${idx}, 1)" title="Увеличить (База: ${ab.baseScore})" style="cursor:pointer; width:18px; height:18px; padding:0; line-height:1;">+</button>
          </div>
        </td>
      `;
    });

// 2. Атаки (Классовое оружие + Пользовательское / AI)
    let attacksHTML = "";

    // Генерация скрытого каталога автодополнения для браузера
    const datalistHTML = `
      <datalist id="weaponsCatalogList">
        ${Object.entries(DND_WEAPONS).map(([name, w]) => `
          <option value="${name}">${w.dice} ${w.type || ''}${w.finesse ? ' • фехт.' : ''}${w.ranged ? ' • дальн.' : ''}</option>
        `).join('')}
      </datalist>
    `;

    // А. Классовое оружие
    (c.classAttacks || []).forEach((atk, idx) => {
      const charLen = Math.max(1, (atk.name || "").length);
      const isProf = atk.isProficient !== undefined ? atk.isProficient : c.checkDefaultWeaponProficiency(atk.name);

      attacksHTML += `
        <tr title="${atk.tooltip || ''}">
          <td style="display: flex; align-items: center; gap: 3px; padding: 1px 2px;">
            <span class="no-print"
                  onclick="app.toggleAttackProf('class', ${idx})"
                  title="${isProf ? 'Владеет оружием (+мастерство)' : 'Не владеет (только стат)'}"
                  style="cursor: pointer; font-size: 8pt; color: ${isProf ? '#2563eb' : '#94a3b8'}; user-select: none; line-height: 1;">
              ${isProf ? '●' : '○'}
            </span>
            <input type="text"
                   class="weapon-input"
                   list="weaponsCatalogList"
                   value="${atk.name}"
                   size="${charLen}"
                   data-atk-type="class"
                   data-atk-field="name"
                   data-atk-idx="${idx}"
                   title="${atk.tooltip || ''}"
                   placeholder="Оружие..."
                   oninput="this.size = Math.max(1, this.value.length); app.onWeaponInput('class', ${idx}, this.value)"
                   onchange="app.onWeaponCommit('class', ${idx}, this.value)"
                   onkeydown="if(event.key === 'Enter'){ this.blur(); }">
          </td>
          <td contenteditable="true" data-atk-type="class" data-atk-field="hit" data-atk-idx="${idx}" title="${atk.tooltip || ''}">${atk.hit}</td>
          <td contenteditable="true" data-atk-type="class" data-atk-field="dmg" data-atk-idx="${idx}" title="${atk.tooltip || ''}">${atk.dmg}</td>
          <td class="no-print" style="width: 16px; text-align:right;">
            <button class="row-btn" onclick="app.deleteAttack('class', ${idx})" title="Удалить">✕</button>
          </td>
        </tr>
      `;
    });

    // Б. Пользовательское оружие / Gemini
    (c.customAttacks || []).forEach((atk, idx) => {
      const charLen = Math.max(1, (atk.name || "").length);
      const isProf = atk.isProficient !== undefined ? atk.isProficient : c.checkDefaultWeaponProficiency(atk.name);

      attacksHTML += `
        <tr title="${atk.tooltip || ''}">
          <td style="display: flex; align-items: center; gap: 3px; padding: 1px 2px;">
            <span class="no-print"
                  onclick="app.toggleAttackProf('custom', ${idx})"
                  title="${isProf ? 'Владеет оружием (+мастерство)' : 'Не владеет (только стат)'}"
                  style="cursor: pointer; font-size: 8pt; color: ${isProf ? '#2563eb' : '#94a3b8'}; user-select: none; line-height: 1;">
              ${isProf ? '●' : '○'}
            </span>
            <input type="text"
                   class="weapon-input"
                   list="weaponsCatalogList"
                   value="${atk.name}"
                   size="${charLen}"
                   data-atk-type="custom"
                   data-atk-field="name"
                   data-atk-idx="${idx}"
                   title="${atk.tooltip || ''}"
                   placeholder="Оружие..."
                   oninput="this.size = Math.max(1, this.value.length); app.onWeaponInput('custom', ${idx}, this.value)"
                   onchange="app.onWeaponCommit('custom', ${idx}, this.value)"
                   onkeydown="if(event.key === 'Enter'){ this.blur(); }">
          </td>
          <td contenteditable="true" data-atk-type="custom" data-atk-field="hit" data-atk-idx="${idx}" title="${atk.tooltip || ''}">${atk.hit}</td>
          <td contenteditable="true" data-atk-type="custom" data-atk-field="dmg" data-atk-idx="${idx}" title="${atk.tooltip || ''}">${atk.dmg}</td>
          <td class="no-print" style="width: 16px; text-align:right;">
            <button class="row-btn" onclick="app.deleteAttack('custom', ${idx})" title="Удалить">✕</button>
          </td>
        </tr>
      `;
    });

    // 3. Умения (Расовые, Классовые, Пользовательские / Gemini)
    let featuresHTML = "";

    // А. Расовые способности (ключ словаря)
    Object.entries(c.raceFeatures || {}).forEach(([key, feat]) => {
      featuresHTML += `
        <li>
          <span contenteditable="true" data-feat-type="race" data-feat-key="${key}">${feat}</span>
          <button class="row-btn no-print" onclick="app.deleteFeature('race', '${key}')" style="margin-left:4px;" title="Удалить">✕</button>
        </li>
      `;
    });

    // Б. Классовые способности (задел под систему классов)
    Object.entries(c.classFeatures || {}).forEach(([key, feat]) => {
      featuresHTML += `
        <li>
          <span contenteditable="true" data-feat-type="class" data-feat-key="${key}">${feat}</span>
          <button class="row-btn no-print" onclick="app.deleteFeature('class', '${key}')" style="margin-left:4px;" title="Удалить">✕</button>
        </li>
      `;
    });

    // В. Пользовательские умения / Gemini (индекс массива)
    (c.customFeatures || []).forEach((feat, idx) => {
      featuresHTML += `
        <li>
          <span contenteditable="true" data-feat-type="custom" data-feat-idx="${idx}">${feat}</span>
          <button class="row-btn no-print" onclick="app.deleteFeature('custom', ${idx})" style="margin-left:4px;" title="Удалить">✕</button>
        </li>
      `;
    });

    const spent = c.spentPoints;
    const maxPts = c.maxBudget;
    const remaining = c.remainingPoints;

    let badgeClass = "remain";
    let statusText = `Осталось: <b>${remaining}</b>`;
    if (remaining === 0) {
      badgeClass = "valid";
      statusText = "Распределено точно (0)";
    } else if (remaining < 0) {
      badgeClass = "over";
      statusText = `Перерасход: <b>+${Math.abs(remaining)}</b>`;
    }

    container.innerHTML = `
      <table class="header-table">
        <tr>
          <td>
            <div class="header-fields-grid">
              <div class="header-top-row">
                <span class="field-lbl">Имя:</span>
                <div class="line-input char-name-input" contenteditable="true" id="field-name" placeholder="Имя персонажа">${c.name || ""}</div>
              </div>

              <div class="header-bottom-row">
                <div class="field-group">
                  <span class="field-lbl">Раса:</span>
                  <select class="line-input meta-input" id="field-race" onchange="app.changeRace(this.value)" style="border: none; border-bottom: 1.2px solid #94a3b8; background: transparent; font-size: 7.5pt; font-weight: bold; color: #0f172a; outline: none; cursor: pointer; padding: 0 2px; height: 16px;">
                    ${Object.keys(DND_RACES).map(raceName => `
                      <option value="${raceName}" ${c.race === raceName ? 'selected' : ''}>${raceName}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="field-group">
                  <span class="field-lbl">Класс:</span>
                  <select class="line-input meta-input" id="field-class" onchange="app.changeClass(this.value)" style="border: none; border-bottom: 1.2px solid #94a3b8; background: transparent; font-size: 7.5pt; font-weight: bold; color: #0f172a; outline: none; cursor: pointer; padding: 0 2px; height: 16px;">
                    ${Object.keys(DND_CLASSES).map(className => `
                      <option value="${className}" ${c.class === className ? 'selected' : ''}>${className}</option>
                    `).join('')}
                  </select>
                </div>

                <div class="field-group" style="flex-grow: 1;">
                  <span class="field-lbl">Инфо:</span>
                  <div class="line-input meta-input" contenteditable="true" id="field-meta" placeholder="Предыстория | Мировоззрение" style="width: 100%;">${c.meta || ""}</div>
                </div>
              </div>
            </div>
          </td>
          <td style="width: 56px; text-align: right; vertical-align: middle;">
            <div class="level-badge" style="display:flex; flex-direction:column; align-items:center; padding:1px 2px;">
              <span class="level-title" style="font-size:5.5pt; font-weight:bold; color:#475569;">УРОВЕНЬ</span>
              <div style="display:flex; align-items:center; justify-content:center; gap:2px; margin-top:1px;">
                <button class="stat-btn no-print" onclick="app.changeLevel(-1)" title="Понизить уровень" style="cursor:pointer; width:14px; height:14px; padding:0; line-height:1; font-size:8pt;">−</button>
                <span class="level-val" id="field-level" style="font-size:10.5pt; font-weight:bold; color:#0f172a; min-width:16px; text-align:center; user-select:none;">${c.level || "1"}</span>
                <button class="stat-btn no-print" onclick="app.changeLevel(1)" title="Повысить уровень" style="cursor:pointer; width:14px; height:14px; padding:0; line-height:1; font-size:8pt;">+</button>
              </div>
            </div>
          </td>
        </tr>
      </table>

      <table class="stats-row">
        <tr>
        <td class="stat-badge" style="width: 18%;">
            <span class="stat-badge-title">КД (Защита)</span>
            <div style="display:flex; align-items:center; justify-content:center; gap:2px; margin:1px 0;">
              <button class="stat-btn no-print" onclick="app.changeArmorBonus(-1)" title="Уменьшить броню" style="cursor:pointer; width:16px; height:16px; padding:0; line-height:1;">−</button>
              <span class="stat-badge-val" onclick="app.resetAC()" title="Клик: сбросить к базовому КД доспеха" style="cursor:pointer; font-weight:bold; min-width:20px; user-select:none;">${c.ac}</span>
              <button class="stat-btn no-print" onclick="app.changeArmorBonus(1)" title="Добавить бонус (+1)" style="cursor:pointer; width:16px; height:16px; padding:0; line-height:1;">+</button>
            </div>
            <div style="display:flex; align-items:center; justify-content:center; gap:2px; margin-top:2px;">
              <select class="no-print" id="field-armor-select" onchange="app.changeArmor(this.value)" style="border:1px solid #cbd5e1; border-radius:3px; font-size:6pt; font-weight:bold; background:#fff; color:#334155; padding:1px 2px; outline:none; cursor:pointer; max-width:68px;">
                ${Object.keys(DND_ARMORS).map(armorKey => `
                  <option value="${armorKey}" ${c.armor === armorKey ? 'selected' : ''}>${armorKey}</option>
                `).join('')}
              </select>
              <button class="shield-toggle-btn no-print ${c.hasShield ? 'active' : ''}" onclick="app.toggleShield()" title="Надеть/снять щит (+2 КД)" style="padding:1px 3px; font-size:5.5pt;">
                🛡️ ${c.hasShield ? '+2' : 'нет'}
              </button>
            </div>
          </td>

          <td class="stat-badge" style="width: 36%;">
            <span class="stat-badge-title">Хиты (HP): Тек / Макс (+Доп)</span>
            <div class="hp-badge-content" style="display:flex; align-items:center; justify-content:center; gap:3px; margin:1px 0;">
              <div class="hp-current-box" contenteditable="true" id="field-hp-cur" placeholder="—" style="min-width:26px; min-height:18px; border:1.2px solid #94a3b8; background:#fff; border-radius:3px; text-align:center; font-size:9.5pt; font-weight:bold; color:#0f172a; outline:none; cursor:text;" title="Текущие HP">${c.hpCur || ""}</div>
              <span class="hp-divider" style="font-weight:bold; color:#64748b;">/</span>
              <button class="stat-btn no-print" onclick="app.changeMaxHP(-1)" title="Уменьшить" style="cursor:pointer; width:16px; height:16px; padding:0; line-height:1;">−</button>
              <div class="hp-max-val" onclick="app.resetHPMax()" title="Клик: сброс к формуле (8 + Тел × Ур)" style="cursor:pointer; font-weight:bold; min-width:18px; text-align:center; user-select:none; font-size:10pt; color:#0f172a;">${c.hpMax}</div>
              <button class="stat-btn no-print" onclick="app.changeMaxHP(1)" title="Увеличить" style="cursor:pointer; width:16px; height:16px; padding:0; line-height:1;">+</button>
              <span style="font-size:8pt; color:#94a3b8; margin-left:1px;">+</span>
              <div class="hp-bonus-box" contenteditable="true" id="field-hp-bonus" placeholder="доп" style="min-width:24px; min-height:18px; border-bottom:1.2px dashed #94a3b8; text-align:center; font-size:8.5pt; color:#475569; outline:none; cursor:text;" title="Временные / Дополнительные HP">${c.hpBonus || ""}</div>  
            </div>
            <span class="stat-badge-sub" style="font-size: 5.5pt; color: #94a3b8;">(Тек и Доп — ввод чисел; Макс — авторасчет и +/-)</span>
          </td>

          <td class="stat-badge" style="width: 12%;">
            <span class="stat-badge-title">Скорость</span>
            <span class="stat-badge-val" contenteditable="true" id="field-speed">${c.speed || "30 фт"}</span>
            <span class="stat-badge-sub" contenteditable="true" id="field-speedSub">${c.speedSub || "9м"}</span>
          </td>

          <td class="stat-badge" style="width: 14%;">
            <span class="stat-badge-title">Инициатива</span>
            <div style="display:flex; align-items:center; justify-content:center; gap:2px; margin:1px 0;">
              <button class="stat-btn no-print" onclick="app.changeInitBonus(-1)" title="Уменьшить инициативу" style="cursor:pointer; width:16px; height:16px; padding:0; line-height:1;">−</button>
              <span class="stat-badge-val" onclick="app.resetInit()" title="Клик: сбросить к базовой (от Ловкости)" style="cursor:pointer; font-weight:bold; min-width:20px; user-select:none;">${c.init}</span>
              <button class="stat-btn no-print" onclick="app.changeInitBonus(1)" title="Увеличить инициативу (+1)" style="cursor:pointer; width:16px; height:16px; padding:0; line-height:1;">+</button>
            </div>
            <span class="stat-badge-sub" id="field-initSub">${c.initSub}</span>
          </td>

          <td class="stat-badge" style="width: 20%;">
            <span class="stat-badge-title" contenteditable="true" id="field-extraTitle">${c.extraTitle || "Особенность"}</span>
            <span class="stat-badge-val" contenteditable="true" id="field-extraVal">${c.extraVal || "□"}</span>
            <span class="stat-badge-sub" contenteditable="true" id="field-extraSub">${c.extraSub || "Ресурс / Слот"}</span>
          </td>
        </tr>
      </table>

      <!-- Блок переключения и контроля бюджета характеристик -->
      <div class="stat-budget-row no-print" style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #cbd5e1; border-radius:5px; padding:3px 8px; margin-bottom:5px; font-size:7.5pt;">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-weight:bold; color:#475569;">Система:</span>
          <select id="budgetModeSelect" onchange="app.changeBudgetMode(this.value)" style="padding:1px 5px; font-size:7.5pt; font-weight:bold; border-radius:4px; border:1px solid #94a3b8; background:#fff; cursor:pointer; color:#0f172a;">
            <option value="point_buy" ${c.budgetMode === 'point_buy' ? 'selected' : ''}>Point Buy (27 очк, 8–15)</option>
            <option value="free_sum" ${c.budgetMode === 'free_sum' ? 'selected' : ''}>Прямая сумма (${c.maxBudgetPoints} очк)</option>
          </select>
          <span style="color:#64748b;">| Лимит:</span>
          <span class="max-points-input" contenteditable="true" id="field-max-budget" onblur="app.onMaxBudgetChange()" title="Нажмите, чтобы изменить максимум" style="font-weight:bold; border-bottom:1px dashed #64748b; min-width:20px; text-align:center; display:inline-block; color:#0f172a;">${c.maxBudgetPoints}</span>
        </div>
        <div id="stat-budget-badge-container">
          <span class="stat-budget-badge ${badgeClass}" style="padding:2px 6px; border-radius:4px; font-weight:bold;">
            ${c.budgetMode === 'point_buy' ? 'Куплено' : 'Сумма'}: <b>${spent}</b> / ${maxPts} &nbsp;|&nbsp; ${statusText}
          </span>
        </div>
      </div>

      <table class="abilities-table">
        <tr>${abilitiesHTML}</tr>
      </table>

      <div class="columns-row">
        <div class="col-left">
          <div class="block-section weapons-section">
            <div class="block-title" style="display:flex; justify-content:space-between; align-items:center;">
              <span>⚔️ Оружие и атаки</span>
              <div style="display:flex; align-items:center; gap:3px;">
                <button class="row-btn no-print" onclick="app.recalcWeapons()" title="✨ Пересчитать урон и атаку от текущих статов" style="font-size:8pt; padding:0 3px;">✨</button>
                <button class="row-btn no-print" onclick="app.equipClassWeapons()" title="🎲 Выдать стартовое оружие текущего класса" style="font-size:8pt; padding:0 3px;">🎲</button>
                <button class="font-size-btn no-print" onclick="app.changeFontSize('attacks', -0.5)" title="Уменьшить шрифт">A−</button>
                <span class="font-size-val no-print">${c.fontSizes?.attacks || 7.5}pt</span>
                <button class="font-size-btn no-print" onclick="app.changeFontSize('attacks', 0.5)" title="Увеличить шрифт">A+</button>
                <button class="add-btn no-print" onclick="app.addAttack()" style="margin-left:4px;"><i class="fa-solid fa-plus"></i> Добавить</button>
              </div>
            </div>
            ${datalistHTML}
            <table class="compact-table" style="font-size: ${c.fontSizes?.attacks || 7.5}pt;">
              <tr>
                <th>Оружие</th>
                <th>Попадание</th>
                <th>Урон / Тип</th>
                <th class="no-print"></th>
              </tr>
              ${attacksHTML}
            </table>
          </div>
          <div class="death-saves-box">
            <b>Спасброски от смерти:</b><br>
            Успехи: 
            <span class="death-circle ${c.deathSuccess >= 1 ? 'checked' : ''}" onclick="app.toggleDeathSave('success', 1)"></span>
            <span class="death-circle ${c.deathSuccess >= 2 ? 'checked' : ''}" onclick="app.toggleDeathSave('success', 2)"></span>
            <span class="death-circle ${c.deathSuccess >= 3 ? 'checked' : ''}" onclick="app.toggleDeathSave('success', 3)"></span>
            &nbsp;|&nbsp;
            Провалы: 
            <span class="death-circle ${c.deathFail >= 1 ? 'checked' : ''}" onclick="app.toggleDeathSave('fail', 1)"></span>
            <span class="death-circle ${c.deathFail >= 2 ? 'checked' : ''}" onclick="app.toggleDeathSave('fail', 2)"></span>
            <span class="death-circle ${c.deathFail >= 3 ? 'checked' : ''}" onclick="app.toggleDeathSave('fail', 3)"></span>
          </div>

          <div class="block-section inventory-section">
            <div class="block-title" style="display:flex; justify-content:space-between; align-items:center;">
              <span>🎒 Снаряжение</span>
              <div style="display:flex; align-items:center; gap:2px;">
                <button class="font-size-btn no-print" onclick="app.changeFontSize('inventory', -0.5)" title="Уменьшить шрифт">A−</button>
                <span class="font-size-val no-print">${c.fontSizes?.inventory || 7.5}pt</span>
                <button class="font-size-btn no-print" onclick="app.changeFontSize('inventory', 0.5)" title="Увеличить шрифт">A+</button>
              </div>
            </div>
            <div class="inventory-text" contenteditable="true" id="field-inventory" placeholder="Снаряжение, золото, предметы..." style="font-size: ${c.fontSizes?.inventory || 7.5}pt;">${c.inventory || ""}</div>
          </div>
        </div>

        <div class="col-right">
          <div class="block-section features-section">
            <div class="block-title" style="display:flex; justify-content:space-between; align-items:center;">
              <span>🛡️ Умения и способности</span>
              <div style="display:flex; align-items:center; gap:2px;">
                <button class="font-size-btn no-print" onclick="app.changeFontSize('features', -0.5)" title="Уменьшить шрифт">A−</button>
                <span class="font-size-val no-print">${c.fontSizes?.features || 7.5}pt</span>
                <button class="font-size-btn no-print" onclick="app.changeFontSize('features', 0.5)" title="Увеличить шрифт">A+</button>
                <button class="add-btn no-print" onclick="app.addFeature()" style="margin-left:4px;"><i class="fa-solid fa-plus"></i> Добавить</button>
              </div>
            </div>
            <div class="features-list-wrapper">
              <ul class="feature-list" style="font-size: ${c.fontSizes?.features || 7.5}pt;">
                ${featuresHTML}
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;

    this.renderDescriptionCard(c);

    container.querySelectorAll('[contenteditable="true"]').forEach(el => {
      el.addEventListener('input', () => this.saveCurrentDOM());
    });

    const restrictDigits = (id, onInputCallback) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        el.innerText = el.innerText.replace(/[^0-9]/g, '');
        if (onInputCallback) onInputCallback();
        this.saveCurrentDOM();
      });
    };

    restrictDigits("field-max-budget", () => this.onMaxBudgetLive());
    restrictDigits("field-hp-cur");
    restrictDigits("field-hp-bonus");

    const levelEl = document.getElementById("field-level");
    if (levelEl) c.level = levelEl.innerText.trim() || "1";

    container.querySelectorAll('[contenteditable="true"]').forEach(el => {
      el.addEventListener('input', () => this.saveCurrentDOM());
      el.addEventListener('paste', (e) => this.handleCleanPaste(e));
    });
  }

  changeArmor(newArmor) {
    this.saveCurrentDOM();
    this.activeCharacter.setArmor(newArmor);
    this.renderActiveCard();
    this.saveCurrentDOM();
    this.showToast(`Доспех изменен: ${newArmor}`);
  }

  toggleShield() {
    this.saveCurrentDOM();
    this.activeCharacter.toggleShield();
    this.renderActiveCard();
    this.saveCurrentDOM();
    this.showToast(this.activeCharacter.hasShield ? "Щит надет (+2 к КД)" : "Щит снят (-2 к КД)");
  }

  // Срабатывает во время ввода: если игрок выбрал оружие из списка — сразу рассчитываем
  onWeaponInput(type, idx, val) {
    const clean = (val || "").trim();
    // Если набрано точное название из каталога (клик по подсказке datalist)
    if (DND_WEAPONS[clean]) {
      this.onWeaponCommit(type, idx, clean);
    }
  }

  toggleAttackProf(type, idx) {
    this.saveCurrentDOM();
    const c = this.activeCharacter;
    const list = type === 'class' ? c.classAttacks : c.customAttacks;
    if (!list || !list[idx]) return;

    const currentProf = list[idx].isProficient !== undefined
      ? list[idx].isProficient
      : c.checkDefaultWeaponProficiency(list[idx].name);

    const nextProf = !currentProf;
    list[idx].isProficient = nextProf;

    const recalculated = c.calcWeaponStats(list[idx].name, nextProf);
    if (recalculated) {
      list[idx].hit = recalculated.hit;
      list[idx].dmg = recalculated.dmg;
      list[idx].tooltip = recalculated.tooltip;
    }

    this.renderActiveCard();
    this.saveCurrentDOM();
    this.showToast(nextProf ? "Владение оружием включено" : "Владение оружием выключено");
  }

  // Фиксация ввода (выбор из списка, потеря фокуса или нажатие Enter)
  onWeaponCommit(type, idx, newName) {
    const c = this.activeCharacter;
    if (!c) return;

    const targetList = type === 'class' ? c.classAttacks : c.customAttacks;
    if (!targetList || !targetList[idx]) return;

    const clean = (newName || "").trim();
    if (!clean) return;

    // Расчет через нечеткий поиск Character.calcWeaponStats
    const calculated = c.calcWeaponStats(clean);
    if (calculated) {
      targetList[idx].name = calculated.name;
      targetList[idx].hit = calculated.hit;
      targetList[idx].dmg = calculated.dmg;

      if (calculated.isImprovised) {
        this.showToast(`«${calculated.name}» рассчитано как импровизированное!`, "warn");
      } else if (calculated.name !== clean) {
        this.showToast(`Опознано как «${calculated.name}»`);
      }
    }

    this.renderActiveCard();
    this.saveCurrentDOM();
  }

  onWeaponNameBlur(type, idx, newName) {
    const c = this.activeCharacter;
    if (!c) return;

    const targetList = type === 'class' ? c.classAttacks : c.customAttacks;
    if (!targetList || !targetList[idx]) return;

    const clean = (newName || "").trim();
    if (!clean) return;

    targetList[idx].name = clean;
    const calculated = c.calcWeaponStats(clean);
    if (calculated) {
      targetList[idx].hit = calculated.hit;
      targetList[idx].dmg = calculated.dmg;
    }

    this.renderActiveCard();
    this.saveCurrentDOM();
  }

  recalcWeapons() {
    this.saveCurrentDOM();
    this.activeCharacter.recalcAttacks();
    this.renderActiveCard();
    this.saveCurrentDOM();
    this.showToast("Атаки пересчитаны по формулам D&D 5e!");
  }

  equipClassWeapons() {
    this.saveCurrentDOM();
    this.activeCharacter.applyClassWeapons(true);
    this.renderActiveCard();
    this.saveCurrentDOM();
    this.showToast(`Выдано стартовое оружие класса: ${this.activeCharacter.class}`);
  }

  handleCleanPaste(e) {
    e.preventDefault();
    const html = (e.clipboardData || window.clipboardData).getData('text/html');
    const plainText = (e.clipboardData || window.clipboardData).getData('text/plain');

    if (!html) {
      document.execCommand('insertText', false, plainText);
      return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const sanitize = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.cloneNode(true);
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        let targetTag = null;

        if (tag === 'b' || tag === 'strong') targetTag = 'b';
        else if (tag === 'i' || tag === 'em') targetTag = 'i';
        else if (tag === 's' || tag === 'strike' || tag === 'del') targetTag = 's';
        else if (tag === 'br') targetTag = 'br';
        else if (['p', 'div', 'li'].includes(tag)) targetTag = tag;

        let newEl;
        if (targetTag) {
          newEl = document.createElement(targetTag);
        } else {
          newEl = document.createDocumentFragment();
        }

        node.childNodes.forEach(child => {
          const res = sanitize(child);
          if (res) newEl.appendChild(res);
        });
        return newEl;
      }
      return null;
    };

    const fragment = document.createDocumentFragment();
    doc.body.childNodes.forEach(child => {
      const res = sanitize(child);
      if (res) fragment.appendChild(res);
    });

    const wrapper = document.createElement('div');
    wrapper.appendChild(fragment);
    document.execCommand('insertHTML', false, wrapper.innerHTML);
  }

  changeFontSize(section, delta) {
    this.saveCurrentDOM();
    this.activeCharacter.changeFontSize(section, delta);
    this.render();
    this.saveCurrentDOM();
  }

  renderDescriptionCard(c) {
    const descContainer = document.getElementById("descBlock");
    if (!descContainer) return;

    const avatarPreviewHTML = (c.avatar && c.avatar.trim() !== "")
      ? `<img src="${c.avatar}" alt="Портрет" title="Нажмите, чтобы изменить фото">`
      : `<div class="desc-avatar-empty" title="Нажмите, чтобы добавить портрет">
           <i class="fa-solid fa-camera"></i>
           <b>+ Портрет (~1/3)</b><br>
           <span style="font-size: 6.5pt; color: #94a3b8;">(Кликните для загрузки)</span>
         </div>`;

    descContainer.innerHTML = `
      <div class="card-container desc-card-screen">
        <div class="description-body">
          <div class="desc-avatar-box" onclick="app.openAvatarModal()" title="Нажмите, чтобы загрузить/изменить фото">
            ${avatarPreviewHTML}
          </div>
          <div class="desc-text-wrapper">
            <div class="description-text" contenteditable="true" id="field-description" placeholder="Здесь можно записать предысторию, внешность, характер, цели или игровые заметки..." style="font-size: ${c.fontSizes?.description || 8.0}pt;">${c.description || ""}</div>
          </div>
        </div>

        <div style="border-top: 1px dashed #cbd5e1; margin-top: 4px; padding-top: 2px; display: flex; justify-content: space-between; align-items: center; font-size: 6.5pt; color: #94a3b8; flex: 0 0 auto;">
          <span>D&D 5e • Оборотная сторона карточки</span>
          <div style="display: flex; align-items: center; gap: 3px;">
            <span style="font-weight: bold; color: #475569;">Размер шрифта:</span>
            <button class="font-size-btn no-print" onclick="app.changeFontSize('description', -0.5)" title="Уменьшить шрифт">A−</button>
            <span class="font-size-val no-print">${c.fontSizes?.description || 8.0}pt</span>
            <button class="font-size-btn no-print" onclick="app.changeFontSize('description', 0.5)" title="Увеличить шрифт">A+</button>
          </div>
        </div>
      </div>
    `;

    const descTextEl = document.getElementById("field-description");
    if (descTextEl) {
      descTextEl.addEventListener('input', () => this.saveCurrentDOM());
      descTextEl.addEventListener('paste', (e) => this.handleCleanPaste(e));
    }
  }

  saveCurrentDOM() {
    const c = this.activeCharacter;
    if (!c) return;

    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.innerHTML.trim() : "";
    };

    const budgetEl = document.getElementById("field-max-budget");
    if (budgetEl) c.maxBudgetPoints = budgetEl.innerText.trim() || (c.budgetMode === "point_buy" ? "27" : "72");

    const descEl = document.getElementById("field-description");
    if (descEl) c.description = descEl.innerHTML.trim();

    c.name = getVal("field-name");
    c.race = getVal("field-race");
    c.meta = getVal("field-meta");
    c.level = getVal("field-level") || "1";

    const armorSelect = document.getElementById("field-armor-select");
    if (armorSelect) {
      c.armor = armorSelect.value;
    }

    c.speed = getVal("field-speed");
    c.speedSub = getVal("field-speedSub");
    c.extraTitle = getVal("field-extraTitle");
    c.extraVal = getVal("field-extraVal");
    c.extraSub = getVal("field-extraSub");
    c.inventory = getVal("field-inventory");
    
    const raceSelect = document.getElementById("field-race");
    if (raceSelect) {
      c.race = raceSelect.value;
    }

    const classSelect = document.getElementById("field-class");
    if (classSelect) {
      c.class = classSelect.value;
    }

    const curHpEl = document.getElementById("field-hp-cur");
    const bonusHpEl = document.getElementById("field-hp-bonus");

    c.hpCur = curHpEl ? curHpEl.innerText.replace(/[^0-9]/g, '') : "";
    c.hpBonus = bonusHpEl ? bonusHpEl.innerText.replace(/[^0-9]/g, '') : "";

    const activeTabSpan = document.querySelector(`#tab-btn-${c.id} span`);
    if (activeTabSpan) activeTabSpan.innerText = c.tabTitle;

    const syncName = document.getElementById("desc-sync-name");
    if (syncName) syncName.innerText = c.name || "ИМЯ ПЕРСОНАЖА";
    const syncMeta = document.getElementById("desc-sync-meta");
    if (syncMeta) syncMeta.innerHTML = `Раса: <b>${c.race || "—"}</b> | Класс: <b>${c.class || "—"}</b> | ${c.meta || ""}`;
    const syncLevel = document.getElementById("desc-sync-level");
    if (syncLevel) syncLevel.innerText = c.level || "1";

    c.abilities.forEach((ab, idx) => {
      const nameEl = document.querySelector(`[data-field="ab-name-${idx}"]`);
      if (nameEl) ab.name = nameEl.innerText.trim();
    });

// Сохранение правок текста классового оружия
    document.querySelectorAll('[data-atk-type="class"][data-atk-field="name"]').forEach(el => {
      const idx = parseInt(el.getAttribute('data-atk-idx'), 10);
      if (c.classAttacks && c.classAttacks[idx]) {
        const row = el.closest('tr');
        c.classAttacks[idx].name = (el.value !== undefined ? el.value : el.innerText).trim();
        const hitEl = row?.querySelector('[data-atk-field="hit"]');
        const dmgEl = row?.querySelector('[data-atk-field="dmg"]');
        if (hitEl) c.classAttacks[idx].hit = hitEl.innerText.trim();
        if (dmgEl) c.classAttacks[idx].dmg = dmgEl.innerText.trim();
      }
    });

// Сохранение пользовательского оружия
    const customAtks = [];
    document.querySelectorAll('[data-atk-type="custom"][data-atk-field="name"]').forEach(el => {
      const row = el.closest('tr');
      const hitEl = row?.querySelector('[data-atk-field="hit"]');
      const dmgEl = row?.querySelector('[data-atk-field="dmg"]');
      customAtks.push({
        name: (el.value !== undefined ? el.value : el.innerText).trim(),
        hit: hitEl ? hitEl.innerText.trim() : "d20 + 0",
        dmg: dmgEl ? dmgEl.innerText.trim() : "1d6"
      });
    });
    c.customAttacks = customAtks;

    const feats = [];
    document.querySelectorAll(`[data-feat]`).forEach(el => feats.push(el.innerHTML.trim()));

    // Сохранение правок текста по изолированным категориям
    document.querySelectorAll('[data-feat-type="race"]').forEach(el => {
      const key = el.getAttribute('data-feat-key');
      if (c.raceFeatures && c.raceFeatures[key] !== undefined) {
        c.raceFeatures[key] = el.innerHTML.trim();
      }
    });

    document.querySelectorAll('[data-feat-type="class"]').forEach(el => {
      const key = el.getAttribute('data-feat-key');
      if (c.classFeatures && c.classFeatures[key] !== undefined) {
        c.classFeatures[key] = el.innerHTML.trim();
      }
    });

    const custom = [];
    document.querySelectorAll('[data-feat-type="custom"]').forEach(el => {
      custom.push(el.innerHTML.trim());
    });
    c.customFeatures = custom;

    c.recalcDerivedStats();

    // Гарантируем актуальность ID в хранилище:
    localStorage.setItem("dnd_active_char_id", c.id);
    localStorage.removeItem("dnd_active_index");

    this.debouncedAutoSave();
  }

  debouncedAutoSave() {
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      CharacterAPI.saveAll(this.characters);
    }, 500);
  }

  changeBudgetMode(mode) {
    this.saveCurrentDOM();
    this.activeCharacter.setBudgetMode(mode);
    this.renderActiveCard();
    this.saveCurrentDOM();
    this.showToast(`Режим изменен: ${mode === 'point_buy' ? 'Point Buy (27 очков)' : 'Прямая сумма (72 очка)'}`);
  }

  changeAbility(idx, delta) {
    this.saveCurrentDOM();
    const res = this.activeCharacter.changeAbilityScore(idx, delta);
    if (res && res.error) {
      this.showToast(res.error, "warn");
    }
    this.renderActiveCard();
    this.saveCurrentDOM();
  }

  changeArmorBonus(delta) {
    this.saveCurrentDOM();
    this.activeCharacter.changeArmorBonus(delta);
    this.renderActiveCard();
    this.saveCurrentDOM();
  }

  changeMaxHP(delta) {
    this.saveCurrentDOM();
    this.activeCharacter.changeMaxHPExtra(delta);
    this.renderActiveCard();
    this.saveCurrentDOM();
  }

  resetAC() {
    this.saveCurrentDOM();
    this.activeCharacter.resetAC();
    this.renderActiveCard();
    this.saveCurrentDOM();
    this.showToast("КД сброшен к базовому (10 + Ловкость)!");
  }

  resetHPMax() {
    this.saveCurrentDOM();
    this.activeCharacter.resetHPMax();
    this.renderActiveCard();
    this.saveCurrentDOM();
    this.showToast("Макс. HP сброшены к формуле (8 + Тел × Ур)!");
  }

  onMaxBudgetChange() {
    const el = document.getElementById("field-max-budget");
    if (!el) return;
    this.activeCharacter.maxBudgetPoints = el.innerText.trim() || (this.activeCharacter.budgetMode === "point_buy" ? "27" : "72");
    this.renderActiveCard();
    this.saveCurrentDOM();
  }

  onMaxBudgetLive() {
    const el = document.getElementById("field-max-budget");
    if (!el) return;
    this.activeCharacter.maxBudgetPoints = el.innerText.trim();
  }

  async addNewCharacter() {
    this.saveCurrentDOM();
    const newHero = new Character({ name: "", level: "1" });
    this.characters.push(newHero);
    this.setActiveCharacter(newHero.id); // Сразу делаем созданного героя активным
    this.render();
    await CharacterAPI.saveAll(this.characters);
    this.showToast("Создан новый герой!");
  }

  async deleteCurrentCharacter() {
    if (this.characters.length === 0) return;
    const target = this.activeCharacter;

    if (confirm(`Удалить карточку «${target.name || 'Герой'}»?`)) {
      await CharacterAPI.deleteCharacter(target.id);

      const targetIdx = this.characters.findIndex(c => c.id === target.id);
      this.characters.splice(targetIdx, 1);

      if (this.characters.length === 0) {
        await this.addNewCharacter();
      } else {
        // Переключаемся на соседнего персонажа
        const nextIdx = Math.max(0, targetIdx - 1);
        this.setActiveCharacter(this.characters[nextIdx].id);
        this.render();
        await CharacterAPI.saveAll(this.characters);
        this.showToast("Карточка удалена.");
      }
    }
  }

  addAttack() {
    this.saveCurrentDOM();
    if (!this.activeCharacter.customAttacks) {
      this.activeCharacter.customAttacks = [];
    }
    this.activeCharacter.customAttacks.push({ name: "Новое оружие", hit: "d20 + 0", dmg: "1d6" });
    this.renderActiveCard();
    this.saveCurrentDOM();
  }

  deleteAttack(type, idx) {
    this.saveCurrentDOM();
    const c = this.activeCharacter;
    if (type === 'class' && c.classAttacks) {
      c.classAttacks.splice(idx, 1);
    } else if (type === 'custom' && c.customAttacks) {
      c.customAttacks.splice(idx, 1);
    }
    this.renderActiveCard();
    this.saveCurrentDOM();
  }

  toggleDeathSave(type, count) {
    const c = this.activeCharacter;
    if (type === 'success') {
      c.deathSuccess = (c.deathSuccess === count) ? count - 1 : count;
    } else {
      c.deathFail = (c.deathFail === count) ? count - 1 : count;
    }
    this.renderActiveCard();
  }

  openAvatarModal() {
    const modal = document.getElementById("avatarModal");
    const pathInput = document.getElementById("avatarPathInput");
    if (pathInput) pathInput.value = this.activeCharacter.avatar || "";
    if (modal) modal.style.display = "flex";
  }

  closeAvatarModal(e) {
    if (e && e.target !== e.currentTarget) return;
    const modal = document.getElementById("avatarModal");
    if (modal) modal.style.display = "none";
  }

  saveAvatarPath() {
    const path = document.getElementById("avatarPathInput").value.trim();
    this.activeCharacter.avatar = path;
    this.closeAvatarModal();
    this.render();
    this.saveCurrentDOM();
  }

  clearAvatar() {
    this.activeCharacter.avatar = "";
    this.closeAvatarModal();
    this.render();
    this.saveCurrentDOM();
  }

  handleAvatarFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      this.activeCharacter.avatar = evt.target.result;
      this.closeAvatarModal();
      this.render();
      this.saveCurrentDOM();
    };
    reader.readAsDataURL(file);
  }

  async saveCurrentCardToFolder() {
    this.saveCurrentDOM();
    const c = this.activeCharacter;
    try {
      const res = await CharacterAPI.saveSingle(c);
      if (res.ok) {
        this.showToast(`Карточка сохранена в ${c.id}.json!`);
      } else {
        throw new Error("Ошибка сервера");
      }
    } catch (err) {
      alert("Не удалось сохранить файл. Убедитесь, что сервер server.py запущен.");
    }
  }

  triggerJSONLoad() {
    document.getElementById("jsonFileInput").click();
  }

  loadFromJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const loaded = JSON.parse(evt.target.result);
        if (Array.isArray(loaded) && loaded.length > 0) {
          this.characters = loaded.map(item => new Character(item));
          this.currentIndex = 0;
          this.render();
          this.showToast("Группа персонажей загружена!");
        } else if (typeof loaded === 'object' && loaded.id) {
          this.characters.push(new Character(loaded));
          this.currentIndex = this.characters.length - 1;
          this.render();
          this.showToast(`Персонаж «${loaded.name || 'Герой'}» добавлен!`);
        } else {
          alert("Неверный формат JSON файла.");
        }
        CharacterAPI.saveAll(this.characters);
      } catch(err) {
        alert("Ошибка при чтении JSON: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  showToast(text, type = "info") {
    let toast = document.getElementById("saveToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "saveToast";
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        color: #ffffff;
        padding: 10px 18px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: bold;
        box-shadow: 0 6px 16px rgba(0,0,0,0.35);
        z-index: 9999;
        transition: opacity 0.3s ease, transform 0.3s ease;
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      document.body.appendChild(toast);
    }
    toast.style.background = type === "warn" ? "#dc2626" : "#059669";
    const icon = type === "warn" ? "fa-triangle-exclamation" : "fa-circle-check";
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${text}`;
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
    }, 2400);
  }

  bindGlobalEvents() {
    window.addEventListener('beforeunload', () => {
      if (this.characters.length > 0) {
        CharacterAPI.saveAll(this.characters);
      }
    });
  }
}

const app = new DnDApp();
window.app = app;
window.PDFExporter = PDFExporter;
window.onload = () => app.init();
