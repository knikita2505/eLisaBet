/** Канонические названия football-data.org → русский */
const TEAM_NAME_RU: Record<string, string> = {
  Afghanistan: "Афганистан",
  Albania: "Албания",
  Algeria: "Алжир",
  Argentina: "Аргентина",
  Australia: "Австралия",
  Austria: "Австрия",
  Belgium: "Бельгия",
  Bolivia: "Боливия",
  "Bosnia-Herzegovina": "Босния и Герцеговина",
  Brazil: "Бразилия",
  Cameroon: "Камерун",
  Canada: "Канада",
  "Cape Verde Islands": "Кабо-Верде",
  "Cape Verde": "Кабо-Верде",
  Chile: "Чили",
  Colombia: "Колумбия",
  "Costa Rica": "Коста-Рика",
  Croatia: "Хорватия",
  Curaçao: "Кюрасао",
  "Czech Republic": "Чехия",
  Czechia: "Чехия",
  Denmark: "Дания",
  Ecuador: "Эквадор",
  Egypt: "Египет",
  England: "Англия",
  France: "Франция",
  Germany: "Германия",
  Ghana: "Гана",
  Greece: "Греция",
  Haiti: "Гаити",
  Honduras: "Гондурас",
  Hungary: "Венгрия",
  Iran: "Иран",
  Iraq: "Ирак",
  Italy: "Италия",
  Ivory: "Кот-д'Ивуар",
  "Côte d'Ivoire": "Кот-д'Ивуар",
  Japan: "Япония",
  Jordan: "Иордания",
  "Korea Republic": "Южная Корея",
  "South Korea": "Южная Корея",
  Mexico: "Мексика",
  Morocco: "Марокко",
  Netherlands: "Нидерланды",
  "New Zealand": "Новая Зеландия",
  Nigeria: "Нигерия",
  Norway: "Норвегия",
  Panama: "Панама",
  Paraguay: "Парагвай",
  Peru: "Перу",
  Poland: "Польша",
  Portugal: "Португалия",
  Qatar: "Катар",
  Romania: "Румыния",
  Russia: "Россия",
  "Saudi Arabia": "Саудовская Аравия",
  Scotland: "Шотландия",
  Senegal: "Сенегал",
  Serbia: "Сербия",
  Slovakia: "Словакия",
  Slovenia: "Словения",
  Spain: "Испания",
  Sweden: "Швеция",
  Switzerland: "Швейцария",
  Tunisia: "Тунис",
  Turkey: "Турция",
  USA: "США",
  "United States": "США",
  Ukraine: "Украина",
  Uruguay: "Уругвай",
  Uzbekistan: "Узбекистан",
  Venezuela: "Венесуэла",
  Wales: "Уэльс",
  "DR Congo": "ДР Конго",
  "Congo DR": "ДР Конго",
  "Congo, DR": "ДР Конго",
};

export function translateTeamToRu(apiName: string): string {
  const trimmed = apiName.trim();
  if (!trimmed) return trimmed;
  if (TEAM_NAME_RU[trimmed]) return TEAM_NAME_RU[trimmed];

  const lower = trimmed.toLowerCase();
  for (const [en, ru] of Object.entries(TEAM_NAME_RU)) {
    if (en.toLowerCase() === lower) return ru;
  }

  return trimmed;
}

export function allKnownTeamTranslations() {
  return { ...TEAM_NAME_RU };
}
