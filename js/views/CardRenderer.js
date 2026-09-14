/**
 * Генератор HTML шаблонов карточек
 */
export class CardRenderer {
  static getFrontHTML(c) {
    const abs = c.abilities.map(ab => `
      <td class="ability-box" style="background:#f8fafc; border:1.5px solid #cbd5e1; text-align:center; padding:2px; vertical-align:top;">
        <div class="ability-name" style="font-size:6.5pt; font-weight:bold; color:#475569; text-transform:uppercase;">${ab.name}</div>
        <div class="ability-mod" style="font-size:11pt; font-weight:bold; color:#0f172a; line-height:1.1;">${ab.mod}</div>
        <div style="font-size:7.5pt; font-weight:bold; background:#e2e8f0; border-radius:3px; display:inline-block; padding:0 3px;">${ab.score || "10"}</div>
      </td>
    `).join("");

    const atks = (c.attacks && c.attacks.length > 0)
      ? c.attacks.map(atk => `<tr><td style="padding:2px;"><b>${atk.name || ""}</b></td><td style="padding:2px;">${atk.hit || ""}</td><td style="padding:2px;">${atk.dmg || ""}</td></tr>`).join("")
      : "";

    const feats = (c.features && c.features.length > 0)
      ? c.features.map(feat => feat && feat.trim() ? `<li style="margin-bottom:2px;">${feat}</li>` : "").join("")
      : "";

    const atkFontSize = c.fontSizes?.attacks || 7.5;
    const invFontSize = c.fontSizes?.inventory || 7.5;
    const featFontSize = c.fontSizes?.features || 7.5;

    return `
      <div style="width:194mm; height:134mm; max-height:134mm; overflow:hidden; border:2px solid #334155; border-radius:8px; padding:5px 8px; box-sizing:border-box; font-size:8pt; background:#ffffff; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#1e293b; display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <table style="width:100%; border-collapse:collapse; margin-bottom:3px; background:#fff; color:#0f172a; border:1.5px solid #64748b; border-radius:6px;">
            <tr>
              <td style="padding:3px 5px;">
                <div style="font-size:11pt; font-weight:bold; color:#0f172a; border-bottom:1.2px solid #94a3b8; min-height:15px; margin-bottom:2px;">${c.name || "&nbsp;"}</div>
                <div style="font-size:7.5pt; color:#475569; display:flex; gap:8px;">
                  <span>Раса: <b style="border-bottom:1px solid #cbd5e1; min-width:40px; display:inline-block;">${c.race || "&nbsp;"}</b></span>
                  <span>Класс: <b style="border-bottom:1px solid #cbd5e1; min-width:40px; display:inline-block;">${c.class || "&nbsp;"}</b></span>
                  <span>Инфо: <b style="flex-grow:1; border-bottom:1px solid #cbd5e1; min-width:50px;">${c.meta || "&nbsp;"}</b></span>
                </div>
              </td>
              <td style="width:48px; text-align:right; padding:2px 4px; vertical-align:middle;">
                <div style="border:1.5px solid #64748b; border-radius:5px; background:#f1f5f9; text-align:center; padding:1px 2px; width:44px; margin-left:auto; box-sizing:border-box;">
                  <div style="font-size:5.5pt; font-weight:bold; color:#475569; text-transform:uppercase; line-height:1.1;">УРОВЕНЬ</div>
                  <div style="font-size:10.5pt; font-weight:bold; color:#0f172a; line-height:1.1; margin-top:1px;">${c.level || "1"}</div>
                </div>
              </td>
            </tr>
          </table>

          <table style="width:100%; border-collapse:separate; border-spacing:2px; margin-bottom:3px; text-align:center;">
            <tr>
              <td style="width:18%; background:#f8fafc; border:1.5px solid #64748b; border-radius:6px; padding:2px;">
                <span style="font-size:5.5pt; font-weight:bold; color:#475569; display:block;">КД</span>
                <span style="font-size:10pt; font-weight:bold; color:#0f172a;">${c.ac || "10"}</span>
                <span style="font-size:4.8pt; color:#64748b; display:block; line-height:1.1; margin-top:1px;">${c.armorLabel || "Без доспеха"}</span>
              </td>
              <td style="width:36%; background:#f8fafc; border:1.5px solid #64748b; border-radius:6px; padding:2px;">
                <span style="font-size:5.5pt; font-weight:bold; color:#475569; display:block;">ХИТЫ (HP): ТЕК / МАКС (+ДОП)</span>
                <div style="display:flex; align-items:center; justify-content:center; gap:3px; margin:1px 0;">
                  <span style="display:inline-block; width:26px; height:16px; border:1.2px solid #94a3b8; background:#fff; border-radius:3px;"></span>
                  <span style="font-size:10pt; font-weight:bold; color:#64748b;">/</span>
                  <span style="font-size:10pt; font-weight:bold; color:#0f172a; min-width:16px; text-align:center;">${c.hpMax || "—"}</span>
                  <span style="font-size:7pt; color:#94a3b8; margin-left:1px;">+</span>
                  <span style="display:inline-block; min-width:18px; border-bottom:1px dashed #94a3b8; font-size:7pt; color:#64748b; text-align:center;">${c.hpBonus || "&nbsp;&nbsp;&nbsp;"}</span>
                </div>
                <span style="font-size:4.5pt; color:#94a3b8; display:block;">(Заполняется карандашом)</span>
              </td>
              <td style="width:12%; background:#f8fafc; border:1.5px solid #64748b; border-radius:6px; padding:2px;">
                <span style="font-size:5.5pt; font-weight:bold; color:#475569; display:block;">СКОРОСТЬ</span>
                <span style="font-size:10pt; font-weight:bold; color:#0f172a;">${c.speed || "30 фт"}</span>
                <span style="font-size:5pt; color:#64748b; display:block;">${c.speedSub || "9м"}</span>
              </td>
              <td style="width:14%; background:#f8fafc; border:1.5px solid #64748b; border-radius:6px; padding:2px;">
                <span style="font-size:5.5pt; font-weight:bold; color:#475569; display:block;">ИНИЦИАТИВА</span>
                <span style="font-size:10pt; font-weight:bold; color:#0f172a;">${c.init || "+0"}</span>
                <span style="font-size:5pt; color:#64748b; display:block;">${c.initSub || "d20+0"}</span>
              </td>
              <td style="width:20%; background:#f8fafc; border:1.5px solid #64748b; border-radius:6px; padding:2px;">
                <span style="font-size:5.5pt; font-weight:bold; color:#475569; display:block;">${c.extraTitle || "Особенность"}</span>
                <span style="font-size:10pt; font-weight:bold; color:#0f172a;">${c.extraVal || "□"}</span>
                <span style="font-size:5pt; color:#64748b; display:block;">${c.extraSub || ""}</span>
              </td>
            </tr>
          </table>

          <table style="width:100%; border-collapse:separate; border-spacing:2px; margin-bottom:3px;">
            <tr>${abs}</tr>
          </table>
        </div>

        <div style="display:flex; flex:1 1 auto; gap:6px; width:100%; min-height:0; box-sizing:border-box;">
          <div style="width:50%; display:flex; flex-direction:column; min-height:0;">
            <div style="border:1px solid #cbd5e1; border-radius:5px; padding:2px 4px; margin-bottom:2px; background:#fafafa; flex:0 0 auto;">
              <div style="font-size:7pt; font-weight:bold; border-bottom:1px solid #e2e8f0; margin-bottom:1px;">⚔️ Оружие и атаки</div>
              <table style="width:100%; border-collapse:collapse; font-size:${atkFontSize}pt; text-align:justify; text-justify:inter-word; word-break:break-word;">${atks}</table>
            </div>
            <div style="border:1px dashed #94a3b8; border-radius:4px; padding:2px; text-align:center; font-size:6.5pt; margin-bottom:2px; background:#f8fafc; flex:0 0 auto;">
              Спасброски от смерти: Успехи: ○ ○ ○ | Провалы: ○ ○ ○
            </div>
            <div style="border:1px solid #cbd5e1; border-radius:5px; padding:2px 4px; background:#fafafa; flex:1 1 auto; display:flex; flex-direction:column; box-sizing:border-box;">
              <div style="font-size:7pt; font-weight:bold; border-bottom:1px solid #e2e8f0; margin-bottom:1px;">🎒 Снаряжение</div>
              <div style="font-size:${invFontSize}pt; color:#334155; flex:1 1 auto; text-align:justify; text-justify:inter-word; word-break:break-word;">${c.inventory || ""}</div>
            </div>
          </div>
          <div style="width:50%; display:flex; flex-direction:column; min-height:0;">
            <div style="border:1px solid #cbd5e1; border-radius:5px; padding:2px 4px; background:#fafafa; flex:1 1 auto; display:flex; flex-direction:column; box-sizing:border-box;">
              <div style="font-size:7pt; font-weight:bold; border-bottom:1px solid #e2e8f0; margin-bottom:1px;">🛡️ Умения и способности</div>
              <ul style="margin:0; padding-left:10px; font-size:${featFontSize}pt; flex:1 1 auto; text-align:justify; text-justify:inter-word; word-break:break-word;">${feats}</ul>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  static getBackHTML(c) {
    const hasAvatar = Boolean(c.avatar && c.avatar.trim());
    const avatarHTML = hasAvatar ? `
      <div style="width: 30%; height: 100%; flex-shrink: 0; border: 1.5px solid #cbd5e1; border-radius: 6px; overflow: hidden; background: #f8fafc; box-sizing: border-box;">
        <img src="${c.avatar}" style="width: 100%; height: 100%; object-fit: cover; display: block;" alt="Портрет">
      </div>
    ` : "";

    const textWidth = hasAvatar ? "width: 70%;" : "width: 100%;";
    const descFontSize = c.fontSizes?.description || 8.0;

    return `
      <div style="width:194mm; height:134mm; max-height:134mm; overflow:hidden; border:2px solid #334155; border-radius:8px; padding:5px 8px; box-sizing:border-box; font-size:8pt; background:#ffffff; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#1e293b; display:flex; flex-direction:column; justify-content:space-between;">
        <div style="display:flex; gap:8px; flex:1 1 auto; min-height:0; height:100%; overflow:hidden; box-sizing:border-box; margin-bottom:4px;">
          ${avatarHTML}
          <div style="${textWidth} height:100%; min-height:0; overflow:hidden; font-size:${descFontSize}pt; line-height:1.35; color:#334155; white-space:pre-wrap; word-break:break-word; text-align:justify; text-justify:inter-word; border:1px solid #cbd5e1; border-radius:6px; padding:6px 8px; background:#fafafa; box-sizing:border-box;">${c.description || ""}</div>
        </div>

        <div style="border-top:1px dashed #cbd5e1; padding-top:2px; display:flex; justify-content:space-between; font-size:5.5pt; color:#94a3b8; flex: 0 0 auto;">
          <span>D&D 5e • Оборотная сторона карточки</span>
          <span>Предыстория, характер и заметки</span>
        </div>
      </div>
    `;
  }
}
