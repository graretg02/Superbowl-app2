
export interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  color: string;
}

export interface Square {
  row: number;
  col: number;
  participantId: string | null;
}

export interface GameState {
  participants: Participant[];
  grid: (string | null)[][]; // 10x10 grid of participant IDs
  rowNumbers: (number | null)[];
  colNumbers: (number | null)[];
  team1: string;
  team2: string;
  isLocked: boolean;
  lastSaved?: number;
}
