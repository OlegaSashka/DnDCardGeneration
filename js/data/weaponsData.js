export const DND_WEAPONS = {
  // Простое оружие
  "Кинжал": { dice: "1d4", type: "колющий", category: "simple", stats: ["ЛОВ", "СИЛ"], thrown: "6/18м" },
  "Булава": { dice: "1d6", type: "дробящий", category: "simple", stats: ["СИЛ"] },
  "Боевой посох": { dice: "1d6", type: "дробящий", category: "simple", stats: ["СИЛ"], versatile: "1d8" },
  "Копье": { dice: "1d6", type: "колющий", category: "simple", stats: ["СИЛ"], versatile: "1d8", thrown: "6/18м" },
  "Ручной топор": { dice: "1d6", type: "рубящий", category: "simple", stats: ["СИЛ"], thrown: "6/18м" },
  "Короткий лук": { dice: "1d6", type: "колющий", category: "simple", stats: ["ЛОВ"] },
  "Легкий арбалет": { dice: "1d8", type: "колющий", category: "simple", stats: ["ЛОВ"] },
  "Дротик": { dice: "1d4", type: "колющий", category: "simple", stats: ["ЛОВ", "СИЛ"], thrown: "6/18м" },

  // Воинское оружие
  "Короткий меч": { dice: "1d6", type: "колющий", category: "martial", stats: ["ЛОВ", "СИЛ"] },
  "Рапира": { dice: "1d8", type: "колющий", category: "martial", stats: ["ЛОВ", "СИЛ"] },
  "Скимитар": { dice: "1d6", type: "рубящий", category: "martial", stats: ["ЛОВ", "СИЛ"] },
  "Длинный меч": { dice: "1d8", type: "рубящий", category: "martial", stats: ["СИЛ"], versatile: "1d10" },
  "Боевой молот": { dice: "1d8", type: "дробящий", category: "martial", stats: ["СИЛ"], versatile: "1d10" },
  "Секира": { dice: "1d8", type: "рубящий", category: "martial", stats: ["СИЛ"], versatile: "1d10" },
  "Двуручный меч": { dice: "2d6", type: "рубящий", category: "martial", stats: ["СИЛ"] },
  "Двуручный топор": { dice: "1d12", type: "рубящий", category: "martial", stats: ["СИЛ"] },
  "Алебарда": { dice: "1d10", type: "рубящий", category: "martial", stats: ["СИЛ"] },
  "Длинный лук": { dice: "1d8", type: "колющий", category: "martial", stats: ["ЛОВ"] },
  "Тяжелый арбалет": { dice: "1d10", type: "колющий", category: "martial", stats: ["ЛОВ"] },
  "Ручной арбалет": { dice: "1d6", type: "колющий", category: "martial", stats: ["ЛОВ"] },

  // Фокусы и инструменты
  "Лютня": { dice: "1d4", type: "дробящий (фокус)", category: "improvised", stats: ["СИЛ"] },
  "Флейта": { dice: "1d4", type: "дробящий (фокус)", category: "improvised", stats: ["СИЛ"] }
};
