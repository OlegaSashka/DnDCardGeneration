// Импортируем только нужный для генерации PDF класс CardRenderer:
import { CardRenderer } from '../views/CardRenderer.js';

/**
 * Сервис печати и скачивания PDF
 */
export class PDFExporter {
  static async exportFrontA5(character) {
    if (!character) return;
    window.app.saveCurrentDOM();
    const charName = (character.name || "dnd_card").replace(/[^a-zA-Zа-яА-Я0-9]/g, "_");

    const a5Page = document.createElement("div");
    a5Page.style.cssText = `width: 210mm; height: 148mm; padding: 7mm 6mm; background: #ffffff; display: flex; justify-content: flex-start; align-items: center; box-sizing: border-box;`;
    a5Page.innerHTML = CardRenderer.getFrontHTML(character);

    const opt = {
      margin: [0, 0, 0, 0],
      filename: `${charName}_front_A5.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0, logging: false },
      jsPDF: { unit: 'mm', format: 'a5', orientation: 'landscape' }
    };
    await html2pdf().set(opt).from(a5Page).save();
  }

  static async exportBackA5(character) {
    if (!character) return;
    window.app.saveCurrentDOM();
    const charName = (character.name || "dnd_card").replace(/[^a-zA-Zа-яА-Я0-9]/g, "_");

    const a5Page = document.createElement("div");
    a5Page.style.cssText = `width: 210mm; height: 148mm; padding: 7mm 6mm; background: #ffffff; display: flex; justify-content: flex-start; align-items: center; box-sizing: border-box;`;
    a5Page.innerHTML = CardRenderer.getBackHTML(character);

    const opt = {
      margin: [0, 0, 0, 0],
      filename: `${charName}_back_description_A5.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0, logging: false },
      jsPDF: { unit: 'mm', format: 'a5', orientation: 'landscape' }
    };
    await html2pdf().set(opt).from(a5Page).save();
  }

  static async exportFoldableA4(character) {
    if (!character) return;
    window.app.saveCurrentDOM();
    const charName = (character.name || "dnd_character").replace(/[^a-zA-Zа-яА-Я0-9]/g, "_");

    const a4Page = document.createElement("div");
    a4Page.style.cssText = `
      width: 210mm; height: 297mm; max-height: 297mm; overflow: hidden; padding: 6mm 6mm;
      background: #ffffff; display: flex; flex-direction: column; justify-content: space-between;
      align-items: flex-start; box-sizing: border-box; position: relative;
    `;

    a4Page.innerHTML = `
      ${CardRenderer.getFrontHTML(character)}
      <div style="position: absolute; top: 148.5mm; left: 6mm; width: 194mm; transform: translateY(-50%); text-align: center; font-size: 6pt; color: #94a3b8; border-bottom: 1px dashed #94a3b8; line-height: 0.1em;">
        <span style="background: #ffffff; padding: 0 8px;">✁ ЛИНИЯ СГИБА (СОГНУТЬ ПОПОЛАМ И СКЛЕИТЬ) ✁</span>
      </div>
      <div style="width: 194mm; height: 134mm; transform: rotate(180deg); transform-origin: center center; display: flex; justify-content: center; align-items: center;">
        ${CardRenderer.getBackHTML(character)}
      </div>
    `;

    const opt = {
      margin: [0, 0, 0, 0],
      filename: `${charName}_A4_foldable.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    await html2pdf().set(opt).from(a4Page).save();
  }
}