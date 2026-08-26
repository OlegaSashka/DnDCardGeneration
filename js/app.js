import { Character } from './models/Character.js';
import { CharacterAPI } from './services/CharacterAPI.js';
import { PDFExporter } from './services/PDFExporter.js';

class DnDApp {
  constructor() {
    this.characters = [];
    this.currentIndex = 0;
    this.autoSaveTimer = null;
  }

  async init() {
    this.characters = await CharacterAPI.loadAll();
    if (this.characters.length === 0) {
      this.addNewCharacter();
    } else {
      const savedIndex = localStorage.getItem("dnd_active_index");
      if (savedIndex !== null && Number(savedIndex) < this.characters.length) {
        this.currentIndex = Number(savedIndex);
      }
      this.render();
    }
    this.bindGlobalEvents();
  }

  get activeCharacter() {
    return this.characters[this.currentIndex] || null;
  }

  changeLevel(delta) {
    this.saveCurrentDOM();
    this.activeCharacter.changeLevel(delta);
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

    this.characters.forEach((char, idx) => {
      const btn = document.createElement("button");
      btn.className = `tab-btn ${idx === this.currentIndex ? 'active' : ''}`;
      btn.id = `tab-btn-${idx}`;
      btn.innerHTML = `<i class="fa-solid fa-shield-halved"></i> <span>${char.tabTitle}</span>`;
      btn.onclick = () => {
        this.saveCurrentDOM();
        this.currentIndex = idx;
        this.render();
      };
      tabsList.appendChild(btn);
    });
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
            <button class="stat-btn no-print" onclick="app.changeAbility(${idx}, -1)" title="Уменьшить" style="cursor:pointer; width:18px; height:18px; padding:0; line-height:1;">−</button>
            <span class="ability-score-badge" style="min-width:18px; font-weight:bold;">${ab.score || "10"}</span>
            <button class="stat-btn no-print" onclick="app.changeAbility(${idx}, 1)" title="Увеличить" style="cursor:pointer; width:18px; height:18px; padding:0; line-height:1;">+</button>
          </div>
        </td>
      `;
    });

    // 2. Атаки
    let attacksHTML = "";
    c.attacks.forEach((atk, idx) => {
      attacksHTML += `
        <tr>
          <td contenteditable="true" data-atk-name="${idx}"><b>${atk.name}</b></td>
          <td contenteditable="true" data-atk-hit="${idx}">${atk.hit}</td>
          <td contenteditable="true" data-atk-dmg="${idx}">${atk.dmg}</td>
          <td class="no-print" style="width: 16px; text-align:right;">
            <button class="row-btn" onclick="app.deleteAttack(${idx})" title="Удалить">✕</button>
          </td>
        </tr>
      `;
    });

    // 3. Умения
    let featuresHTML = "";
    c.features.forEach((feat, idx) => {
      featuresHTML += `
        <li>
          <span contenteditable="true" data-feat="${idx}">${feat}</span>
          <button class="row-btn no-print" onclick="app.deleteFeature(${idx})" style="margin-left:4px;" title="Удалить">✕</button>
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
                  <div class="line-input meta-input" contenteditable="true" id="field-race" placeholder="Раса">${c.race || ""}</div>
                </div>

                <div class="field-group">
                  <span class="field-lbl">Класс:</span>
                  <div class="line-input meta-input" contenteditable="true" id="field-class" placeholder="Класс">${c.class || ""}</div>
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
              <span class="stat-badge-val" onclick="app.resetAC()" title="Клик: сбросить броню к 10+Ловк" style="cursor:pointer; font-weight:bold; min-width:20px; user-select:none;">${c.ac}</span>
              <button class="stat-btn no-print" onclick="app.changeArmorBonus(1)" title="Добавить щит/броню (+1)" style="cursor:pointer; width:16px; height:16px; padding:0; line-height:1;">+</button>
            </div>
            <span class="stat-badge-sub" contenteditable="true" id="field-acSub">${c.acSub || "Без доспеха"}</span>
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
            <span class="stat-badge-val" onclick="app.resetInit()" title="Клик: пересчитать от Ловкости" style="cursor:pointer; font-weight:bold; user-select:none;">${c.init}</span>
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
              <div style="display:flex; align-items:center; gap:2px;">
                <button class="font-size-btn no-print" onclick="app.changeFontSize('attacks', -0.5)" title="Уменьшить шрифт">A−</button>
                <span class="font-size-val no-print">${c.fontSizes?.attacks || 7.5}pt</span>
                <button class="font-size-btn no-print" onclick="app.changeFontSize('attacks', 0.5)" title="Увеличить шрифт">A+</button>
                <button class="add-btn no-print" onclick="app.addAttack()" style="margin-left:4px;"><i class="fa-solid fa-plus"></i> Добавить</button>
              </div>
            </div>
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
    c.class = getVal("field-class");
    c.meta = getVal("field-meta");
    c.level = getVal("field-level") || "1";
    c.acSub = getVal("field-acSub");
    c.speed = getVal("field-speed");
    c.speedSub = getVal("field-speedSub");
    c.extraTitle = getVal("field-extraTitle");
    c.extraVal = getVal("field-extraVal");
    c.extraSub = getVal("field-extraSub");
    c.inventory = getVal("field-inventory");
    
    const curHpEl = document.getElementById("field-hp-cur");
    const bonusHpEl = document.getElementById("field-hp-bonus");

    c.hpCur = curHpEl ? curHpEl.innerText.replace(/[^0-9]/g, '') : "";
    c.hpBonus = bonusHpEl ? bonusHpEl.innerText.replace(/[^0-9]/g, '') : "";

    const activeTabSpan = document.querySelector(`#tab-btn-${this.currentIndex} span`);
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

    c.attacks.forEach((atk, idx) => {
      const nameEl = document.querySelector(`[data-atk-name="${idx}"]`);
      const hitEl = document.querySelector(`[data-atk-hit="${idx}"]`);
      const dmgEl = document.querySelector(`[data-atk-dmg="${idx}"]`);
      if (nameEl) atk.name = nameEl.innerText.trim();
      if (hitEl) atk.hit = hitEl.innerText.trim();
      if (dmgEl) atk.dmg = dmgEl.innerText.trim();
    });

    const feats = [];
    document.querySelectorAll(`[data-feat]`).forEach(el => feats.push(el.innerHTML.trim()));
    c.features = feats;

    c.recalcDerivedStats();

    localStorage.setItem("dnd_active_index", this.currentIndex.toString());
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

  resetInit() {
    this.saveCurrentDOM();
    this.activeCharacter.recalcDerivedStats();
    this.renderActiveCard();
    this.saveCurrentDOM();
    this.showToast("Инициатива пересчитана от Ловкости!");
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
    this.currentIndex = this.characters.length - 1;
    this.render();
    await CharacterAPI.saveAll(this.characters);
    this.showToast("Создан новый герой!");
  }

  async deleteCurrentCharacter() {
    if (this.characters.length === 0) return;
    const target = this.activeCharacter;

    if (confirm(`Удалить карточку «${target.name || 'Герой'}»?`)) {
      await CharacterAPI.deleteCharacter(target.id);
      this.characters.splice(this.currentIndex, 1);
      this.currentIndex = Math.max(0, this.currentIndex - 1);

      if (this.characters.length === 0) {
        await this.addNewCharacter();
      } else {
        this.render();
        await CharacterAPI.saveAll(this.characters);
        this.showToast("Карточка удалена.");
      }
    }
  }

  addAttack() {
    this.saveCurrentDOM();
    this.activeCharacter.attacks.push({ name: "Новое оружие", hit: "d20 + 0", dmg: "1d6" });
    this.renderActiveCard();
  }

  deleteAttack(idx) {
    this.saveCurrentDOM();
    this.activeCharacter.attacks.splice(idx, 1);
    this.renderActiveCard();
  }

  addFeature() {
    this.saveCurrentDOM();
    this.activeCharacter.features.push("<b>Новая способность:</b> Текст умения.");
    this.renderActiveCard();
  }

  deleteFeature(idx) {
    this.saveCurrentDOM();
    this.activeCharacter.features.splice(idx, 1);
    this.renderActiveCard();
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