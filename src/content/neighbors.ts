export interface Neighbor {
  id: string;
  name: string;
  quirk: string;
  /** Placeholder portrait color until the fal portraits land (M4). */
  color: string;
}

export const NEIGHBORS: Record<string, Neighbor> = {
  rosa: { id: 'rosa', name: 'Grandma Rosa', quirk: 'Calls every input by the name of whoever plugged it in.', color: '#d9826b' },
  lindqvist: { id: 'lindqvist', name: 'The Lindqvists', quirk: 'Got a sound bar for Christmas and two remotes for their trouble.', color: '#6bb3d9' },
  fenwick: { id: 'fenwick', name: 'Old Mr. Fenwick', quirk: 'Keeps a drawer of spare batteries, sorted by size.', color: '#b8a36b' },
  harmon: { id: 'harmon', name: 'Coach Harmon', quirk: 'Has never missed a hockey game. Not once.', color: '#7bc47f' },
  patterson: { id: 'patterson', name: 'Marjorie Patterson', quirk: 'Movie night is sacred. Hubby picks, she judges.', color: '#c67bd1' },
  ingrid: { id: 'ingrid', name: 'Farmer Ingrid', quirk: 'Lives at the end of Ridge Road with three goats and a big dish.', color: '#d1b07b' },
  dottie: { id: 'dottie', name: 'Baker Dottie', quirk: 'Pays in cinnamon rolls when she can.', color: '#e0a3a3' },
  vic: { id: 'vic', name: 'Vinyl Vic', quirk: 'Can hear a hum through a closed door.', color: '#8b9be0' },
  nakamura: { id: 'nakamura', name: 'The Nakamuras', quirk: 'Watch every movie with subtitles on, just in case.', color: '#e0c36b' },
  june: { id: 'june', name: 'Auntie June', quirk: 'Has 4,000 holiday photos and a story for each.', color: '#7fd1c2' },
  mayor: { id: 'mayor', name: 'Mayor Pell', quirk: 'Has rehearsed the festival countdown forty times. Out loud.', color: '#e07b7b' },
  brennan: { id: 'brennan', name: 'The Brennans', quirk: 'Liam, 15, blames the router for everything.', color: '#d18b6b' },
};
