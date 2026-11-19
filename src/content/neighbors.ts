export interface Neighbor {
  id: string;
  name: string;
  address: string;
  quirk: string;
  /** Placeholder portrait color until the fal portraits land (M4). */
  color: string;
}

export const NEIGHBORS: Record<string, Neighbor> = {
  rosa: {
    id: 'rosa',
    name: 'Grandma Rosa',
    address: '4 Elm Street',
    quirk: 'Calls every input by the name of whoever plugged it in.',
    color: '#d9826b',
  },
  lindqvist: {
    id: 'lindqvist',
    name: 'The Lindqvists',
    address: '11 Birch Lane',
    quirk: 'Got a sound bar for Christmas and two remotes for their trouble.',
    color: '#6bb3d9',
  },
};
