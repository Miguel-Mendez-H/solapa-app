import { normalize, plain } from './score';

export type Visibility = 'public' | 'link' | 'private' | 'scheduled';
export type SceneKind = 'brasas' | 'humo' | 'ondas' | 'polvo';
export type Mode = 'auto' | 'light' | 'dark';
export type RGB = [number, number, number];

export interface Cover { kind: 'preset' | 'image'; preset: string; img: string }
export type BgMode = 'none' | 'cover' | 'image';
export interface Book { title: string; author: string; ficha: string; cover: Cover; mode: Mode; bg?: BgMode; bgImg?: string }
export interface Text { id: string; title: string; body: string; scene: SceneKind; visibility: Visibility; publishAt: string; token: string }
export interface Sub { email: string; at: string; from: string }
export interface Data { lite: boolean; subs: Sub[]; book: Book; texts: Text[] }

export const KEY = 'solapa-v2';

export const SCENES: Record<SceneKind, string> = { brasas: 'Brasas', humo: 'Humo', ondas: 'Ondas', polvo: 'Polvo' };
export const VIS: Record<Visibility, { name: string; desc: string }> = {
  public: { name: 'Público', desc: 'Cualquiera lo lee y los buscadores lo indexan.' },
  link: { name: 'Por enlace', desc: 'Solo quien tenga el enlace. No sale en el índice ni en buscadores.' },
  private: { name: 'Privado', desc: 'Solo tú, desde el estudio. Ideal para borradores.' },
  scheduled: { name: 'Programado', desc: 'Privado hasta la fecha elegida; ese día pasa a público.' },
};
export const PRESETS: Record<string, { name: string; bg: RGB; fg: RGB }> = {
  bermellon: { name: 'Bermellón', bg: [214, 64, 42], fg: [244, 238, 230] },
  carbon: { name: 'Carbón', bg: [52, 52, 56], fg: [224, 176, 72] },
  bosque: { name: 'Bosque', bg: [31, 61, 50], fg: [232, 226, 208] },
  papel: { name: 'Papel', bg: [231, 227, 218], fg: [21, 21, 21] },
};

// Partitura de ejemplo: las líneas `::efecto` no se muestran, dan un efecto a su estrofa (ver score.ts).
const ESPADA = "Soy el temple que duda en el hierro.\nSi algo en mí se quiebra\nno te astillas\nte templas.\n\n::grieta\nNos sabemos por la grieta\nesa boca donde la piel se abre\na lo previo al olvido\nla vibración anterior al nombre.\n\nAllí late la fractura\ncomo un segundo alfabeto.\n\nNi activa ni pasiva:\nsiendo-siendo.\n\nEntonces ve.\n(O quédate, y conviértete en vaina.)\n\n::revela\nCamina hacia la noche\nque no es noche\nsino cámara oscura\nlo que la luz nunca supo decir\nse revela en su ausencia.\n\nVe\ndonde el grito tarda generaciones en dar fruto\ngermina en bocas aún no nacidas\nen gargantas que aún no saben\nque ya cargan la semilla.\n\n::hueco\nLas niñas aprendieron temprano:\ncallar es un idioma.\nGramática de ausencia\nsintaxis del aire\ndonde debió haber una palabra\ny no hubo ninguna.\n\nEl óxido nos ciñe por dentro\nnadie ve ese trabajo lento\nesa paciencia de convertir\nel hierro\nen memoria.\n\n::fuego\nEl fuego no pregunta a quién calcina\nsolo reconoce lo que resiste.\nYo ardo\ntú arderás\nnosotras habremos ardido.\n\n::fuego\nEn el punto más caliente de la llama\nalgo nuestro murió sin hacer ruido\ny algo más antiguo, algo que llevaba siglos\nesperando su turno\nabrió los ojos.\n\nLa aleación no es el metal que fuimos\nes lo que el fuego inventó\ncuando ya no hacía falta preguntar.\nNo cicatrices que hablan\ncicatrices que son el habla.\n\nEl idioma que entienden\nsolo las que también son fisura.\n\nHasta el mutismo estremece\ncuando toca lo indecible.\nEl acero llora hacia adentro\nasí llora todo lo que tarda siglos en romperse.\n\n::quieto\nLa dureza es memoria\nno destino.\n\n::quieto\nCamino entre la gente\nnadie sabe que llevo el filo invertido\nque me corto yo primero\nantes de rozar a alguien más.\n\n::quieto\nEsa es la espada que he elegido.";

function seed(): Data {
  return {
    lite: false,
    subs: [],
    book: { title: 'Espada un filo', author: 'Giselle S. Vargas B.', ficha: 'Poesía', cover: { kind: 'preset', preset: 'carbon', img: '' }, mode: 'auto' },
    texts: [{ id: 't1', title: 'Espada', scene: 'brasas', visibility: 'public', publishAt: '', token: '', body: ESPADA }],
  };
}

/**
 * Quien ya tenía guardado el poema de ejemplo sin tocar (sin partitura) recibe la versión con efectos.
 * Si lo editó, no se toca nada.
 */
function upgradeSeed(d: Data): void {
  const t = d.texts.find((x) => x.id === 't1');
  if (t && t.title === 'Espada' && !/^::/m.test(t.body) && normalize(t.body).trim() === plain(ESPADA)) {
    t.body = ESPADA;
    if (t.scene === 'humo') t.scene = 'brasas';
  }
}

function load(): Data | null {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const d = JSON.parse(s) as Data;
      if (d && d.book && Array.isArray(d.texts) && Array.isArray(d.subs)) { upgradeSeed(d); return d; }
    }
  } catch { /* sin almacenamiento */ }
  return null;
}

export const data: Data = load() ?? seed();
export function save(): void { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* sin almacenamiento */ } }

import { today } from './util';

export function stateOf(t: Text): Visibility {
  if (t.visibility === 'scheduled') return t.publishAt && t.publishAt <= today() ? 'public' : 'scheduled';
  return t.visibility;
}
export const byId = (id: string | null): Text | undefined => data.texts.find((t) => t.id === id);
export const publicTexts = (): Text[] => data.texts.filter((t) => stateOf(t) === 'public');

/** Estado de interfaz que no se guarda. */
export interface UI { sel: string | null; open: string | null; asLink: boolean; preview: boolean; next: { open?: string; asLink?: boolean; preview?: boolean } | null }
export const ui: UI = { sel: data.texts[0]?.id ?? null, open: null, asLink: false, preview: false, next: null };
