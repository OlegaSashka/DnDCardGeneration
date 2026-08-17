// Импортируем классы только там, где они нужны:
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

    let abilitiesHTML = "";
    c.abilities.forEach((ab, idx) => {
      abilitiesHTML += `
        <td class="ability-box">
          <div class="ability-name" contenteditable="true" data-field="ab-name-${idx}">${ab.name}</div>
          <div class="ability-mod" id="ab-mod-val-${idx}">${ab.mod}</div>
          <div class="ability-score-row">
            <button class="stat-btn no-print" onclick="app.changeAbility(${idx}, -1)" title="Уменьшить">−</button>
            <span class="ability-score-badge" contenteditable="true" data-field="ab-score-${idx}" onblur="app.onScoreManualEdit(${idx})">${ab.score || "10"}</span>
            <button class="stat-btn no-print" onclick="app.changeAbility(${idx}, 1)" title="Увеличить">+</button>
          </div>
        </td>
      `;
    });

    let attacksHTML = "";
    c.attacks.forEach((atk, idx) => {
      attacksHTML += `
        <tr>
          <td contenteditable="true" data-atk-name="${idx}"><b>${atk.name}</b></td>
          <td contenteditable="true" data-atk-hit="${idx}">${atk.hit}</td>
          <td contenteditable="true" data-atk-dmg="${idx}">${atk.dmg}</td>
          <td class="no-print" style="width: 15px; text-align:right;">
            <button class="row-btn" onclick="app.deleteAttack(${idx})" title="Удалить"><i class="fa-solid fa-times"></i></button>
          </td>
        </tr>
      `;
    });

    let featuresHTML = "";
    c.features.forEach((feat, idx) => {
      featuresHTML += `
        <li>
          <span contenteditable="true" data-feat="${idx}">${feat}</span>
          <button class="row-btn no-print" onclick="app.deleteFeature(${idx})" style="margin-left:4px;" title="Удалить"><i class="fa-solid fa-times"></i></button>
        </li>
      `;
    });

    const spent = c.spentPoints;
    const maxPts = parseInt(c.maxBudgetPoints, 10) || 75;
    const remaining = c.remainingPoints;

    let badgeClass = "remain";
    let statusText = `Осталось очков: <b>${remaining}</b>`;
    if (remaining === 0) {
      badgeClass = "valid";
      statusText = "Очки распределены точно (0)";
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
          <td style="width: 52px; text-align: right; vertical-align: middle;">
            <div class="level-badge">
              <span class="level-title">УРОВЕНЬ</span>
              <div class="level-val" contenteditable="true" id="field-level">${c.level || "1"}</div>
            </div>
          </td>
        </tr>
      </table>

      <table class="stats-row">
        <tr>
          <td class="stat-badge" style="width: 18%;">
            <span class="stat-badge-title">КД (Защита)</span>
            <span class="stat-badge-val" contenteditable="true" id="field-ac">${c.ac || "10"}</span>
            <span class="stat-badge-sub" contenteditable="true" id="field-acSub">${c.acSub || "Без доспеха"}</span>
          </td>

          <td class="stat-badge" style="width: 36%;">
            <span class="stat-badge-title">Хиты (HP): Тек / Макс (+Врем)</span>
            <div class="hp-badge-content">
              <div class="hp-current-box" contenteditable="true" id="field-hp-cur">${c.hpCur || ""}</div>
              <span class="hp-divider">/</span>
              <div class="hp-max-val" contenteditable="true" id="field-hp-max">${c.hpMax || "10"}</div>
              <span style="font-size: 8pt; color: #94a3b8; margin-left: 2px;">+</span>
              <div class="hp-bonus-box" contenteditable="true" id="field-hp-bonus" placeholder="Бонус">${c.hpBonus || ""}</div>
            </div>
            <span class="stat-badge-sub" style="font-size: 5.5pt; color: #94a3b8;">(Тек. пишется карандашом)</span>
          </td>

          <td class="stat-badge" style="width: 12%;">
            <span class="stat-badge-title">Скорость</span>
            <span class="stat-badge-val" contenteditable="true" id="field-speed">${c.speed || "30 фт"}</span>
            <span class="stat-badge-sub" contenteditable="true" id="field-speedSub">${c.speedSub || "9м"}</span>
          </td>

          <td class="stat-badge" style="width: 14%;">
            <span class="stat-badge-title">Инициатива</span>
            <span class="stat-badge-val" contenteditable="true" id="field-init">${c.init || "+0"}</span>
            <span class="stat-badge-sub" contenteditable="true" id="field-initSub">${c.initSub || "d20 + 0"}</span>
          </td>

          <td class="stat-badge" style="width: 20%;">
            <span class="stat-badge-title" contenteditable="true" id="field-extraTitle">${c.extraTitle || "Особенность"}</span>
            <span class="stat-badge-val" contenteditable="true" id="field-extraVal">${c.extraVal || "□"}</span>
            <span class="stat-badge-sub" contenteditable="true" id="field-extraSub">${c.extraSub || "Ресурс / Слот"}</span>
          </td>
        </tr>
      </table>

      <div class="stat-budget-row no-print">
        <div>
          <span>📊 Всего очков: </span>
          <span class="max-points-input" contenteditable="true" id="field-max-budget" oninput="app.updateBudgetLive()" onblur="app.onMaxBudgetChange()" title="Нажмите, чтобы изменить максимум">${c.maxBudgetPoints}</span>
          <span style="color: #64748b; margin-left: 4px;">(сумма 6 статов)</span>
        </div>
        <div id="stat-budget-badge-container">
          <span class="stat-budget-badge ${badgeClass}">
            Потрачено: <b>${spent}</b> / ${maxPts} &nbsp;|&nbsp; ${statusText}
          </span>
        </div>
      </div>

      <table class="abilities-table">
        <tr>${abilitiesHTML}</tr>
      </table>

      <div class="columns-row">
        <div class="col-left">
          <div class="block-section weapons-section">
            <div class="block-title">
              <span>⚔️ Оружие и атаки</span>
              <button class="add-btn no-print" onclick="app.addAttack()"><i class="fa-solid fa-plus"></i> Добавить</button>
            </div>
            <table class="compact-table">
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
            <div class="block-title">🎒 Снаряжение</div>
            <div class="inventory-text" contenteditable="true" id="field-inventory" placeholder="Снаряжение, золото, предметы...">${c.inventory || ""}</div>
          </div>
        </div>

        <div class="col-right">
          <div class="block-section features-section">
            <div class="block-title">
              <span>🛡️ Умения и способности</span>
              <button class="add-btn no-print" onclick="app.addFeature()"><i class="fa-solid fa-plus"></i> Добавить</button>
            </div>
            <div class="features-list-wrapper">
              <ul class="feature-list">
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
        <table class="header-table" style="margin-bottom: 6px;">
          <tr>
            <td>
              <div style="font-size: 11pt; font-weight: bold; color: #0f172a;" id="desc-sync-name">${c.name || "ИМЯ ПЕРСОНАЖА"}</div>
              <div style="font-size: 7.5pt; color: #475569;" id="desc-sync-meta">
                Раса: <b>${c.race || "—"}</b> | Класс: <b>${c.class || "—"}</b> | ${c.meta || ""}
              </div>
            </td>
            <td style="width: 52px; text-align: right; vertical-align: middle;">
              <div class="level-badge">
                <span class="level-title">УРОВЕНЬ</span>
                <div class="level-val" id="desc-sync-level">${c.level || "1"}</div>
              </div>
            </td>
          </tr>
        </table>

        <div class="description-body">
          <div class="desc-avatar-box" onclick="app.openAvatarModal()" title="Нажмите, чтобы загрузить/изменить фото">
            ${avatarPreviewHTML}
          </div>
          <div class="desc-text-wrapper">
            <div class="description-text" contenteditable="true" id="field-description" placeholder="Здесь можно записать предысторию, внешность, характер, цели или игровые заметки...">${c.description || ""}</div>
          </div>
        </div>

        <div style="border-top: 1px dashed #cbd5e1; margin-top: 4px; padding-top: 2px; display: flex; justify-content: space-between; font-size: 6.5pt; color: #94a3b8;">
          <span>D&D 5e • Оборотная сторона карточки</span>
          <span>(Текст и портрет сохраняются автоматически)</span>
        </div>
      </div>
    `;

    const descTextEl = document.getElementById("field-description");
    if (descTextEl) {
      descTextEl.addEventListener('input', () => this.saveCurrentDOM());
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
    if (budgetEl) c.maxBudgetPoints = budgetEl.innerText.trim();

    const descEl = document.getElementById("field-description");
    if (descEl) c.description = descEl.innerHTML.trim();

    c.name = getVal("field-name");
    c.race = getVal("field-race");
    c.class = getVal("field-class");
    c.meta = getVal("field-meta");
    c.level = getVal("field-level") || "1";
    c.ac = getVal("field-ac");
    c.acSub = getVal("field-acSub");
    c.hpCur = getVal("field-hp-cur");
    c.hpMax = getVal("field-hp-max");
    c.hpBonus = getVal("field-hp-bonus");
    c.speed = getVal("field-speed");
    c.speedSub = getVal("field-speedSub");
    c.init = getVal("field-init");
    c.initSub = getVal("field-initSub");
    c.extraTitle = getVal("field-extraTitle");
    c.extraVal = getVal("field-extraVal");
    c.extraSub = getVal("field-extraSub");
    c.inventory = getVal("field-inventory");

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
      const scoreEl = document.querySelector(`[data-field="ab-score-${idx}"]`);
      if (nameEl) ab.name = nameEl.innerText.trim();
      if (scoreEl) {
        ab.score = scoreEl.innerText.trim();
        ab.mod = Character.calcMod(ab.score);
      }
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

    localStorage.setItem("dnd_active_index", this.currentIndex.toString());
    this.debouncedAutoSave();
  }

  debouncedAutoSave() {
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      CharacterAPI.saveAll(this.characters);
    }, 500);
  }

  changeAbility(idx, delta) {
    this.saveCurrentDOM();
    this.activeCharacter.changeAbilityScore(idx, delta);
    this.renderActiveCard();
    this.saveCurrentDOM();
  }

  onScoreManualEdit(idx) {
    const scoreEl = document.querySelector(`[data-field="ab-score-${idx}"]`);
    if (!scoreEl) return;
    const val = parseInt(scoreEl.innerText.trim(), 10);
    if (!isNaN(val)) {
      this.activeCharacter.abilities[idx].score = val.toString();
      this.activeCharacter.abilities[idx].mod = Character.calcMod(val);
      this.renderActiveCard();
      this.saveCurrentDOM();
    }
  }

  updateBudgetLive() {
    const c = this.activeCharacter;
    if (!c) return;

    const budgetEl = document.getElementById("field-max-budget");
    if (budgetEl) c.maxBudgetPoints = budgetEl.innerText.trim() || "75";

    c.abilities.forEach((ab, idx) => {
      const scoreEl = document.querySelector(`[data-field="ab-score-${idx}"]`);
      if (scoreEl) {
        const val = parseInt(scoreEl.innerText.trim(), 10);
        if (!isNaN(val)) {
          ab.score = val.toString();
          ab.mod = Character.calcMod(val);
          const modEl = document.getElementById(`ab-mod-val-${idx}`);
          if (modEl) modEl.innerText = ab.mod;
        }
      }
    });

    const spent = c.spentPoints;
    const maxPts = parseInt(c.maxBudgetPoints, 10) || 75;
    const remaining = c.remainingPoints;

    let badgeClass = "remain";
    let statusText = `Осталось очков: <b>${remaining}</b>`;
    if (remaining === 0) {
      badgeClass = "valid";
      statusText = "Очки распределены точно (0)";
    } else if (remaining < 0) {
      badgeClass = "over";
      statusText = `Перерасход: <b>+${Math.abs(remaining)}</b>`;
    }

    const badgeContainer = document.getElementById("stat-budget-badge-container");
    if (badgeContainer) {
      badgeContainer.innerHTML = `
        <span class="stat-budget-badge ${badgeClass}">
          Потрачено: <b>${spent}</b> / ${maxPts} &nbsp;|&nbsp; ${statusText}
        </span>
      `;
    }
  }

  onMaxBudgetChange() {
    const el = document.getElementById("field-max-budget");
    if (!el) return;
    this.activeCharacter.maxBudgetPoints = el.innerText.trim() || "75";
    this.renderActiveCard();
    this.saveCurrentDOM();
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

  showToast(text) {
    let toast = document.getElementById("saveToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "saveToast";
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: #059669;
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
    toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${text}`;
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

// Создаем экземпляр и экспортируем в глобальный scope окна (для работы кнопок onclick в HTML)
const app = new DnDApp();
window.app = app;
window.PDFExporter = PDFExporter;

// Запуск приложения
window.onload = () => app.init();