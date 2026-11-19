// Pinecrest Hollow: places, roads and how snow changes them through the night. See design §7 and §8.
// Map coordinates are in a 1000×600 space.

import type { Road, SnowEvent, Town } from '../engine/night';

const roads: Road[] = [
  { id: 'main', a: 'shop', b: 'hall', name: 'Main St', base: 6, snow: 'plowed' },
  { id: 'mainW', a: 'shop', b: 'dottie', name: 'Main St West', base: 12, snow: 'snowy' },
  { id: 'elm1', a: 'shop', b: 'fenwick', name: 'Elm St', base: 7, snow: 'snowy' },
  { id: 'elm2', a: 'fenwick', b: 'rosa', name: 'Elm St', base: 8, snow: 'snowy' },
  { id: 'mill1', a: 'rosa', b: 'june', name: 'Mill Rd', base: 10, snow: 'deep' },
  { id: 'mill2', a: 'june', b: 'dottie', name: 'Mill Rd', base: 9, snow: 'snowy' },
  { id: 'mill3', a: 'dottie', b: 'brennan', name: 'Mill Rd', base: 10, snow: 'snowy' },
  { id: 'oak1', a: 'brennan', b: 'harmon', name: 'Oak St', base: 8, snow: 'deep' },
  { id: 'oak2', a: 'harmon', b: 'patterson', name: 'Oak St', base: 7, snow: 'snowy' },
  { id: 'church', a: 'patterson', b: 'shop', name: 'Church Ln', base: 9, snow: 'snowy' },
  { id: 'pine', a: 'harmon', b: 'shop', name: 'Pine St', base: 10, snow: 'deep' },
  { id: 'oak3', a: 'patterson', b: 'vic', name: 'Oak St', base: 8, snow: 'snowy' },
  { id: 'hallRd', a: 'vic', b: 'hall', name: 'Hall Rd', base: 7, snow: 'snowy' },
  { id: 'birch1', a: 'hall', b: 'nakamura', name: 'Birch Ln', base: 9, snow: 'snowy' },
  { id: 'birch2', a: 'nakamura', b: 'lindqvist', name: 'Birch Ln', base: 7, snow: 'deep' },
  { id: 'north', a: 'nakamura', b: 'fenwick', name: 'North Ln', base: 10, snow: 'snowy' },
  { id: 'lantern', a: 'hall', b: 'lindqvist', name: 'Lantern Way', base: 12, snow: 'blocked' },
  { id: 'ridge', a: 'vic', b: 'ingrid', name: 'Ridge Rd', base: 14, snow: 'deep' },
];

export const TOWN: Town = {
  places: {
    shop: { id: 'shop', name: 'Your Workshop', x: 470, y: 300, kind: 'shop' },
    hall: { id: 'hall', name: 'Town Hall', x: 660, y: 300, kind: 'hall', neighbor: 'mayor' },
    rosa: { id: 'rosa', name: '4 Elm St', x: 300, y: 170, kind: 'house', neighbor: 'rosa' },
    fenwick: { id: 'fenwick', name: '19 Elm St', x: 480, y: 140, kind: 'house', neighbor: 'fenwick' },
    harmon: { id: 'harmon', name: '7 Oak St', x: 280, y: 430, kind: 'house', neighbor: 'harmon' },
    patterson: { id: 'patterson', name: '2 Church Ln', x: 460, y: 480, kind: 'house', neighbor: 'patterson' },
    lindqvist: { id: 'lindqvist', name: '11 Birch Ln', x: 860, y: 160, kind: 'house', neighbor: 'lindqvist' },
    ingrid: { id: 'ingrid', name: 'Ridge Farm', x: 920, y: 500, kind: 'house', neighbor: 'ingrid' },
    dottie: { id: 'dottie', name: 'The Bakery', x: 130, y: 300, kind: 'house', neighbor: 'dottie' },
    vic: { id: 'vic', name: '30 Oak St', x: 670, y: 470, kind: 'house', neighbor: 'vic' },
    nakamura: { id: 'nakamura', name: '5 Birch Ln', x: 690, y: 120, kind: 'house', neighbor: 'nakamura' },
    june: { id: 'june', name: '1 Mill Rd', x: 120, y: 130, kind: 'house', neighbor: 'june' },
    brennan: { id: 'brennan', name: '14 Mill Rd', x: 140, y: 480, kind: 'house', neighbor: 'brennan' },
  },
  roads: Object.fromEntries(roads.map((r) => [r.id, r])),
};

export const NIGHT1_SNOW: SnowEvent[] = [
  { at: 90, kind: 'plow', roads: ['mainW', 'elm1', 'elm2'], label: 'Plow clears Main St West and Elm St' },
  { at: 150, kind: 'plow', roads: ['church', 'oak2', 'oak3'], label: 'Plow clears Church Ln and Oak St' },
  { at: 180, kind: 'plow', roads: ['lantern', 'birch1', 'birch2'], label: 'Plow opens Lantern Way and Birch Ln' },
  { at: 210, kind: 'snowfall', roads: [], label: 'Heavy snow: unplowed roads get worse' },
  { at: 240, kind: 'plow', roads: ['ridge', 'hallRd'], label: 'Plow clears Ridge Rd and Hall Rd' },
];

// Night 2: it snowed all day. Fresh snow on the north side, then the plows work outward.
export const NIGHT2_SNOW: SnowEvent[] = [
  { at: 0, kind: 'snowfall', roads: ['main', 'elm1', 'elm2', 'north', 'birch1'], label: 'Fresh snow on Main St, Elm St, North Ln and Birch Ln' },
  { at: 60, kind: 'plow', roads: ['main', 'mainW', 'mill2', 'mill3'], label: 'Plow clears Main St and Mill Rd' },
  { at: 120, kind: 'plow', roads: ['elm1', 'elm2', 'north', 'pine'], label: 'Plow clears Elm St, North Ln and Pine St' },
  { at: 180, kind: 'plow', roads: ['lantern', 'birch1', 'birch2'], label: 'Plow opens Lantern Way and Birch Ln' },
  { at: 240, kind: 'snowfall', roads: [], label: 'Heavy snow: unplowed roads get worse' },
  { at: 270, kind: 'plow', roads: ['church', 'oak1', 'oak2', 'oak3', 'hallRd'], label: 'Plow clears Church Ln, Oak St and Hall Rd' },
];

// Night 3: the blizzard. Every road starts worse; the plows keep the way to Town Hall open.
export const NIGHT3_SNOW: SnowEvent[] = [
  { at: 0, kind: 'snowfall', roads: [], label: 'Blizzard: every road starts worse' },
  { at: 45, kind: 'plow', roads: ['main', 'hallRd', 'birch1'], label: 'Plow clears the way to Town Hall' },
  { at: 90, kind: 'plow', roads: ['elm1', 'elm2', 'north', 'mainW'], label: 'Plow clears Elm St, North Ln and Main St West' },
  { at: 150, kind: 'plow', roads: ['church', 'oak2', 'oak3', 'pine', 'ridge'], label: 'Plow clears Church Ln, Oak St, Pine St and Ridge Rd' },
  { at: 200, kind: 'snowfall', roads: [], label: 'The blizzard picks up: unplowed roads get worse' },
  { at: 240, kind: 'plow', roads: ['main', 'hallRd', 'birch1', 'birch2', 'lantern', 'mill1', 'mill2', 'mill3'], label: 'Plow clears Main St, Birch Ln, Lantern Way and Mill Rd' },
];
