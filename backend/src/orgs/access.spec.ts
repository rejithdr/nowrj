import { isLevel, meets, withinScope, wouldCreateCycle, accessSql } from './access-rules';

// Head office ─ South (region) ─ Kerala (region) ─ Kochi (station)
//             └ North (region) ─ Delhi (station)
const units = [
  { id: 'south', parentId: null },
  { id: 'kerala', parentId: 'south' },
  { id: 'kochi', parentId: 'kerala' },
  { id: 'north', parentId: null },
  { id: 'delhi', parentId: 'north' },
];

describe('levels', () => {
  it('are cumulative: authorise ⊇ edit ⊇ view', () => {
    expect(meets('authorise', 'edit')).toBe(true);
    expect(meets('authorise', 'view')).toBe(true);
    expect(meets('edit', 'view')).toBe(true);
    expect(meets('edit', 'authorise')).toBe(false);
    expect(meets('view', 'edit')).toBe(false);
    expect(meets('none', 'view')).toBe(false);
    expect(meets(null, 'view')).toBe(false);
    expect(meets('none', 'none')).toBe(true);
  });

  it('stats only takes none or view', () => {
    expect(isLevel('view', 'stats')).toBe(true);
    expect(isLevel('edit', 'stats')).toBe(false);
    expect(isLevel('authorise', 'programmes')).toBe(true);
    expect(isLevel('admin', 'programmes')).toBe(false);
    expect(isLevel(undefined, 'rjs')).toBe(false);
  });
});

describe('scope', () => {
  it('head office covers everything', () => {
    expect(withinScope(units, null, 'kochi')).toBe(true);
    expect(withinScope(units, null, null)).toBe(true);
  });
  it('a region covers the regions and stations under it', () => {
    expect(withinScope(units, 'south', 'kochi')).toBe(true);
    expect(withinScope(units, 'south', 'kerala')).toBe(true);
    expect(withinScope(units, 'south', 'south')).toBe(true);
    expect(withinScope(units, 'south', 'delhi')).toBe(false);
    expect(withinScope(units, 'south', null)).toBe(false);
  });
  it('a station covers only itself', () => {
    expect(withinScope(units, 'kochi', 'kochi')).toBe(true);
    expect(withinScope(units, 'kochi', 'kerala')).toBe(false);
  });
});

describe('moving units', () => {
  it('refuses to put a region inside itself or below itself', () => {
    expect(wouldCreateCycle(units, 'south', 'south')).toBe(true);
    expect(wouldCreateCycle(units, 'south', 'kerala')).toBe(true);
    expect(wouldCreateCycle(units, 'south', 'kochi')).toBe(true);
  });
  it('allows other moves', () => {
    expect(wouldCreateCycle(units, 'kerala', 'north')).toBe(false);
    expect(wouldCreateCycle(units, 'kerala', null)).toBe(false);
    expect(wouldCreateCycle(units, 'delhi', 'kerala')).toBe(false);
  });
});

describe('accessSql', () => {
  it('lists every level that meets the need', () => {
    expect(accessSql('p."stationId"', 'programmes', 'edit')).toContain(`IN ('edit','authorise')`);
    expect(accessSql('x', 'stats', 'view')).toContain(`IN ('view','edit','authorise')`);
  });
});
