// Formato das mensagens do motor e tipos de render. O front nunca simula:
// so recebe e desenha, entao estes tipos espelham o snapshot do servidor.

export type Team = "red" | "blue";

export type Soldier = {
  id: number;
  team: Team;
  x: number;
  y: number;
  aim: number;
  state: string;
  flash: number;
};

export type Tracer = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  team: Team;
};

export type MapMsg = {
  type: "map";
  w: number;
  h: number;
  cell: number;
  srad: number;
  core: { x: number; y: number };
  walls: [number, number, number, number][];
};

export type StateMsg = {
  type: "state";
  reds: Soldier[];
  blues: Soldier[];
  tracers: Tracer[];
  time_left: number;
  incursion: number;
  holds: number;
  breaches: number;
  core_cap: number;
};

export type View = { scale: number; ox: number; oy: number };

export type GlowSet = {
  red: HTMLCanvasElement;
  blue: HTMLCanvasElement;
  cyan: HTMLCanvasElement;
};
