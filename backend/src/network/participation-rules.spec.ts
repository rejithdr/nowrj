import { allows, nextStatusAllowed, readParticipationSettings } from './participation-rules';

describe('participation rules', () => {
  it('knows what each mode allows', () => {
    expect(allows('both', 'nominate')).toBe(true);
    expect(allows('take_part', 'nominate')).toBe(false);
    expect(allows('off', 'take_part')).toBe(false);
  });

  it('airs a nomination only after the person agreed', () => {
    expect(nextStatusAllowed('nominate', 'new', 'done', null)).toMatch(/agreed/);
    expect(nextStatusAllowed('nominate', 'contacted', 'done', null)).toMatch(/agreed/);
    expect(nextStatusAllowed('nominate', 'agreed', 'done', new Date())).toBeNull();
    expect(nextStatusAllowed('take_part', 'new', 'done', null)).toBeNull();
    expect(nextStatusAllowed('take_part', 'new', 'nonsense', null)).toBe('Unknown status.');
  });

  it('validates settings', () => {
    expect(readParticipationSettings({ participation: 'both', participationPrompt: '  Nominate   a friend ' })).toEqual({
      participation: 'both',
      participationPrompt: 'Nominate a friend',
    });
    expect(typeof readParticipationSettings({ participation: 'everyone' })).toBe('string');
    expect(typeof readParticipationSettings({ participationPrompt: 'x'.repeat(201) })).toBe('string');
  });
});
