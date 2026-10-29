// Правила вместо AI: шаблоны маленьких действий по сферам.
export interface Action {
  title: string
  minutes: number
  why: string
}

export interface Area {
  id: string
  label: string
  actions: Action[]
}

export const AREAS: Area[] = [
  {
    id: 'health',
    label: 'Здоровье и энергия',
    actions: [
      { title: 'Стакан воды после пробуждения', minutes: 2, why: 'Простое действие, которое легко запускает утро.' },
      { title: 'Прогулка 10 минут', minutes: 10, why: 'Короткое движение помогает энергии и настроению.' },
      { title: 'Растяжка 5 минут', minutes: 5, why: 'Снимает напряжение после сидячей работы.' },
    ],
  },
  {
    id: 'learning',
    label: 'Обучение',
    actions: [
      { title: 'Короткий конспект по одной теме', minutes: 10, why: 'Малый объём каждый день работает лучше редких марафонов.' },
      { title: 'Повторить вчерашнее', minutes: 5, why: 'Повторение закрепляет материал в памяти.' },
      { title: 'Записать 3 вопроса по теме', minutes: 5, why: 'Вопросы показывают, что именно стоит разобрать дальше.' },
    ],
  },
  {
    id: 'languages',
    label: 'Языки',
    actions: [
      { title: '10 слов в карточках', minutes: 10, why: 'Регулярность важнее длительности.' },
      { title: 'Сказать одну фразу вслух', minutes: 5, why: 'Речь тренируется только речью.' },
      { title: 'Послушать подкаст на изучаемом языке', minutes: 10, why: 'Слух привыкает к живому темпу.' },
    ],
  },
  {
    id: 'reading',
    label: 'Чтение',
    actions: [
      { title: 'Прочитать 5 страниц', minutes: 10, why: 'Маленькая норма легко удерживается.' },
      { title: 'Выписать одну мысль из книги', minutes: 5, why: 'Так прочитанное превращается в своё.' },
      { title: 'Выбрать следующую книгу', minutes: 5, why: 'Заранее выбранная книга убирает паузу между чтением.' },
    ],
  },
  {
    id: 'spiritual',
    label: 'Духовная практика',
    actions: [
      { title: 'Пять минут тишины или молитвы', minutes: 5, why: 'Короткая пауза помогает собраться.' },
      { title: 'Записать, за что благодарен', minutes: 5, why: 'Благодарность смещает внимание на хорошее.' },
      { title: 'Прочитать короткий текст и подумать над ним', minutes: 10, why: 'Небольшая порция легче превращается в привычку.' },
    ],
  },
  {
    id: 'career',
    label: 'Карьера и проекты',
    actions: [
      { title: 'Один маленький шаг по проекту', minutes: 15, why: 'Постоянное движение важнее редких рывков.' },
      { title: 'Записать следующий шаг по проекту', minutes: 5, why: 'Понятный следующий шаг снижает сопротивление.' },
      { title: 'Отправить одно рабочее сообщение', minutes: 10, why: 'Контакты и ответы двигают дело вперёд.' },
    ],
  },
  {
    id: 'relationships',
    label: 'Отношения',
    actions: [
      { title: 'Написать близкому человеку', minutes: 5, why: 'Внимание — главное, что мы можем дать.' },
      { title: 'Позвонить кому-то из родных', minutes: 10, why: 'Живой голос греет сильнее переписки.' },
      { title: 'Сказать «спасибо» вслух', minutes: 2, why: 'Мелочь, которая заметно меняет атмосферу.' },
    ],
  },
  {
    id: 'discipline',
    label: 'Дисциплина',
    actions: [
      { title: 'Выписать 3 дела на завтра', minutes: 5, why: 'Заранее составленный список снимает утреннюю неопределённость.' },
      { title: '5 минут уборки на рабочем месте', minutes: 5, why: 'Порядок вокруг помогает порядку в голове.' },
      { title: '20 минут без телефона', minutes: 20, why: 'Тренирует внимание и сопротивление отвлечениям.' },
    ],
  },
  {
    id: 'finance',
    label: 'Финансы',
    actions: [
      { title: 'Записать сегодняшние траты', minutes: 5, why: 'Видимые расходы проще контролировать.' },
      { title: 'Проверить баланс и подписки', minutes: 10, why: 'Находит лишние списания.' },
      { title: 'Отложить небольшую сумму', minutes: 5, why: 'Регулярность важнее размера суммы.' },
    ],
  },
]

export const areaLabel = (id: string | null | undefined) =>
  AREAS.find((a) => a.id === id)?.label ?? (id ? id : 'Свободная сфера')

function pickAction(area: Area, minutes: number, round: number): Action {
  const fit = area.actions.filter((a) => a.minutes <= minutes)
  const pool = fit.length ? fit : [[...area.actions].sort((a, b) => a.minutes - b.minutes)[0]]
  return pool[round % pool.length]
}

/** План по дням [from..to] из выбранных сфер. Действия не длиннее, чем daily_minutes. */
export function buildPlan(areaIds: string[], minutes: number, from: number, to: number) {
  const areas = areaIds.map((id) => AREAS.find((a) => a.id === id)).filter((a): a is Area => Boolean(a))
  const use = areas.length ? areas : AREAS.filter((a) => a.id === 'discipline')
  const items: { day_number: number; title: string; area: string }[] = []
  for (let day = from; day <= to; day++) {
    const i = day - 1
    const area = use[i % use.length]
    const act = pickAction(area, minutes, Math.floor(i / use.length))
    items.push({ day_number: day, title: `${act.title} · ${act.minutes} мин`, area: area.id })
  }
  return items
}

/** Стартовые привычки из выбранных сфер (по одной из сферы). */
export function starterHabits(areaIds: string[], minutes: number, count: number) {
  const areas = areaIds.map((id) => AREAS.find((a) => a.id === id)).filter((a): a is Area => Boolean(a))
  const use = areas.length ? areas : AREAS.filter((a) => ['health', 'discipline', 'reading'].includes(a.id))
  return use.slice(0, count).map((a) => {
    const act = pickAction(a, minutes, 0)
    return { title: act.title, why: act.why }
  })
}
