/**
 * Контраст текста на стеклянных поверхностях.
 *
 * Полупрозрачная карточка — это не цвет, а стопка слоёв: базовый фон, три
 * пятна света под ним, сама карточка с прозрачностью и блик поверх неё.
 * Итоговая подложка под буквами получается сложением всех четырёх, и на глаз
 * её не угадать. Правило §12 «контраст не ниже AA в обеих темах» проверяется
 * здесь, а не надеждой.
 *
 * Значения берутся из `src/styles/globals.css` разбором, а не копией: копия
 * разъедется с темой в первый же день правок и будет уверенно проверять
 * несуществующие цвета.
 *
 *   npm run check:contrast
 *
 * Считается худший случай, а не средний: все три пятна света наложены друг на
 * друга и блик взят в самой яркой своей точке. Реальная страница светлее или
 * темнее этой оценки не бывает.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CSS_PATH = fileURLToPath(new URL('../src/styles/globals.css', import.meta.url));

/** Цвет в sRGB, каналы 0..1, плюс альфа. */
type Rgba = { r: number; g: number; b: number; a: number };

// ─── Цветовая арифметика ────────────────────────────────────────────────────

function oklchToRgb(l: number, c: number, hDeg: number, alpha: number): Rgba {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const lCube = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mCube = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sCube = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const linear = [
    4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube,
    -1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube,
    -0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube,
  ].map((value) => Math.min(1, Math.max(0, value)));

  const encode = (value: number): number =>
    value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;

  return { r: encode(linear[0]!), g: encode(linear[1]!), b: encode(linear[2]!), a: alpha };
}

/** Наложение цвета с альфой на непрозрачную подложку. */
function over(top: Rgba, bottom: Rgba): Rgba {
  return {
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  };
}

function luminance({ r, g, b }: Rgba): number {
  const linear = (value: number): number =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: Rgba, b: Rgba): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

function hex({ r, g, b }: Rgba): string {
  const channel = (value: number): string =>
    Math.round(Math.min(1, Math.max(0, value)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

// ─── Разбор темы из CSS ─────────────────────────────────────────────────────

const OKLCH = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)/;
/** Та же запись, но для перебора всех цветов внутри градиента. */
const OKLCH_ALL = new RegExp(OKLCH.source, 'g');

function parseOklch(value: string): Rgba {
  const match = OKLCH.exec(value);
  if (match === null) throw new Error(`Не разобрать цвет: ${value}`);
  return oklchToRgb(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    match[4] === undefined ? 1 : Number(match[4]),
  );
}

/**
 * Блок темы из CSS: пары «переменная — значение».
 *
 * Тёмная тема живёт в `[data-theme='dark']`, светлая в `:root`. Оба блока
 * плоские, без вложенности, поэтому разбор кончается на первой закрывающей
 * скобке в начале строки.
 *
 * Комментарии вырезаются до разбора: в них лежат и точки с запятой, и имена
 * переменных, и разбор построчно на них спотыкается. Значение может занимать
 * несколько строк — градиенты записаны в столбик, — поэтому границей служит
 * точка с запятой, а не конец строки.
 */
function readTheme(css: string, selector: string): Map<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`В globals.css нет блока ${selector}`);
  const body = css.slice(start, css.indexOf('\n}', start)).replace(/\/\*[\s\S]*?\*\//g, '');

  const tokens = new Map<string, string>();
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(match[1]!, match[2]!.replace(/\s+/g, ' ').trim());
  }
  return tokens;
}

/**
 * Доля карточки в стекле — число из `color-mix(in oklab, var(--card) 78%, transparent)`.
 * Смешение с `transparent` в premultiplied-пространстве равносильно той же
 * карточке с альфой: цвет не уезжает, меняется только прозрачность.
 */
function glassAlpha(value: string): number {
  const match = /var\(--card\)\s+([\d.]+)%/.exec(value);
  if (match === null) throw new Error(`Не разобрать стекло: ${value}`);
  return Number(match[1]) / 100;
}

/** Самый светлый упор блика: первая остановка градиента `--glass-sheen`. */
function sheenPeak(value: string): Rgba {
  const match = OKLCH.exec(value);
  if (match === null) throw new Error(`Не разобрать блик: ${value}`);
  return parseOklch(match[0]);
}

// ─── Проверка ───────────────────────────────────────────────────────────────

type Check = { name: string; text: Rgba; min: number };

/**
 * Подложка под текстом. `glassToken === null` — сам фон приложения, без
 * стекла: на нём стоят заголовки экранов и пояснения под ними, и проверять
 * их надо ровно так же, как текст на карточке.
 *
 * `sheened === false` — поверхность без светлой плёнки. Так устроена середина
 * плитки выбранного раздела: её блик симметричен, светлый по обеим кромкам и
 * прозрачный посередине, и середина — худший случай этой поверхности.
 * Кромки не считаются отдельно: их упор равен упору `--glass-sheen`, то есть
 * ровно тому, что уже проверено у остальных слоёв.
 */
function surfaceOf(
  tokens: Map<string, string>,
  glassToken: string | null,
  sheened = true,
): Rgba {
  // Фон страницы: базовый цвет и три пятна света, наложенные друг на друга.
  let base = parseOklch(tokens.get('--background')!);
  for (const depth of ['--depth-1', '--depth-2', '--depth-3']) {
    base = over(parseOklch(tokens.get(depth)!), base);
  }
  if (glassToken === null) return base;

  // Карточка с прозрачностью поверх фона, затем блик поверх карточки.
  const card = parseOklch(tokens.get('--card')!);
  const glass = over({ ...card, a: glassAlpha(tokens.get(glassToken)!) }, base);
  if (!sheened) return glass;
  return over(sheenPeak(tokens.get('--glass-sheen')!), glass);
}

function run(): boolean {
  const css = readFileSync(CSS_PATH, 'utf8');
  let ok = true;

  for (const [themeName, selector] of [
    ['светлая', ':root {'],
    ['тёмная', "[data-theme='dark'] {"],
  ] as const) {
    const tokens = readTheme(css, selector);

    const checks: Check[] = [
      { name: 'основной текст', text: parseOklch(tokens.get('--card-foreground')!), min: 4.5 },
      { name: 'приглушённый текст', text: parseOklch(tokens.get('--muted-foreground')!), min: 4.5 },
      { name: 'баланс: долг', text: parseOklch(tokens.get('--owes')!), min: 4.5 },
      { name: 'баланс: в плюсе', text: parseOklch(tokens.get('--credit')!), min: 4.5 },
      { name: 'ссылки и акцент', text: parseOklch(tokens.get('--primary')!), min: 4.5 },
      { name: 'граница поля ввода', text: parseOklch(tokens.get('--input')!), min: 3 },
      { name: 'кольцо фокуса', text: parseOklch(tokens.get('--ring')!), min: 3 },
    ];

    /*
      Слой и то, что на нём стоит. У стеклянных поверхностей проверяются все
      цвета текста — на карточку может лечь что угодно. У фона приложения
      список короче, и это не поблажка: на голом фоне стоят ровно заголовки
      экранов и пояснения под ними. Появится там сумма или поле ввода —
      строку надо расширить, а не радоваться зелёной проверке.
    */
    const PAGE_TEXTS = ['основной текст', 'приглушённый текст', 'кольцо фокуса'];

    /*
      Стёклышко `.nav-pill` стоит в двух местах: плитка выбранного раздела и
      подпись поля. В обоих на нём ровно одно слово цветом `--foreground` —
      и кольцо фокуса вокруг. Ни поля ввода, ни сумм там нет и быть не может.
      Счётчик непрочитанного — своя пара цветов (`--primary-foreground` на
      `--primary`), от подложки не зависящая.
    */
    const PILL_TEXTS = ['основной текст', 'кольцо фокуса'];


    for (const [layerName, token, only, sheened] of [
      ['карточка', '--glass-bg', null, true],
      ['шапка и диалог', '--glass-bg-strong', null, true],
      ['плитка', '--glass-bg-soft', null, true],
      ['стёклышко: раздел и подпись поля — середина, блика нет', '--glass-bg-soft', PILL_TEXTS, false],
      ['фон приложения (заголовки, пояснения)', null, PAGE_TEXTS, true],
    ] as const) {
      const surface = surfaceOf(tokens, token, sheened);
      console.log(`\n${themeName} тема · ${layerName} — подложка ${hex(surface)}`);

      for (const check of checks.filter((item) => only === null || only.includes(item.name))) {
        const ratio = contrast(check.text, surface);
        const passed = ratio >= check.min;
        if (!passed) ok = false;
        console.log(
          `  ${passed ? '✓' : '✗'} ${check.name.padEnd(22)} ${ratio.toFixed(2)}:1 (нужно ${check.min}:1)`,
        );
      }
    }

    /*
      Градиенты проверяются по обоим концам порознь. Градиент — не один цвет:
      «в среднем проходит» означает, что на одном его краю текст не читается,
      и никакая средняя величина этого не исправит.
    */
    console.log(`\n${themeName} тема · текст на градиентах`);
    for (const [name, gradient, text, min] of [
      ['кнопка действия', '--gradient-primary', '--primary-foreground', 4.5],
      ['значок-капля', '--gradient-water', '--primary-foreground', 3],
    ] as const) {
      const foreground = parseOklch(tokens.get(text)!);
      for (const [index, stop] of [...tokens.get(gradient)!.matchAll(OKLCH_ALL)].entries()) {
        const ratio = contrast(foreground, parseOklch(stop[0]));
        const passed = ratio >= min;
        if (!passed) ok = false;
        console.log(
          `  ${passed ? '✓' : '✗'} ${`${name}, конец ${index + 1}`.padEnd(22)} ${ratio.toFixed(2)}:1 (нужно ${min}:1)`,
        );
      }
    }

    /*
      Название приложения набрано градиентом. Своё место у него одно — шапка
      поверх стекла, — но та же пара цветов может однажды встать прямо на
      фоне, и подложки эти разные: пройденной на стекле за фон не поручиться.
      Поэтому проверок две, и вторая — запас, а не описание текущего экрана.
    */
    for (const [place, token] of [
      ['логотип в шапке', '--glass-bg-strong'],
      ['логотип на фоне', null],
    ] as const) {
      const surface = surfaceOf(tokens, token);
      for (const [index, stop] of [
        ...tokens.get('--gradient-wordmark')!.matchAll(OKLCH_ALL),
      ].entries()) {
        const ratio = contrast(parseOklch(stop[0]), surface);
        const passed = ratio >= 4.5;
        if (!passed) ok = false;
        console.log(
          `  ${passed ? '✓' : '✗'} ${`${place}, конец ${index + 1}`.padEnd(22)} ${ratio.toFixed(2)}:1 (нужно 4.5:1)`,
        );
      }
    }
  }

  console.log(
    ok
      ? '\nВсе пары проходят AA в худшем случае наложения слоёв.\n'
      : '\nЕсть пары ниже порога §12. Правь прозрачность стекла или яркость пятен.\n',
  );
  return ok;
}

process.exit(run() ? 0 : 1);
