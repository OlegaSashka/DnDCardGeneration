/**
 * Справочник брони D&D 5e (SRD)
 * maxDex: null — прибавляется весь модификатор Ловкости (легкие доспехи)
 * maxDex: 2 — прибавляется Ловкость, но не более +2 (средние доспехи)
 * maxDex: 0 — Ловкость не прибавляется вообще (тяжелые доспехи)
 */
export const DND_ARMORS = {
  "Без доспеха": { baseAC: 10, maxDex: null, type: "none", desc: "10 + ЛОВ", stealthDisadv: false },
  "Легкий": { baseAC: 11, maxDex: null, type: "light", desc: "11 + ЛОВ", stealthDisadv: false },
  "Средний": { baseAC: 14, maxDex: 2, type: "medium", desc: "14 + ЛОВ (макс +2)", stealthDisadv: true },
  "Тяжелый": { baseAC: 16, maxDex: 0, type: "heavy", desc: "16", stealthDisadv: true}
};
