import { hasContactDetails } from './text-rules';

describe('hasContactDetails', () => {
  it.each([
    'call me on 9447012345',
    'my number +91 94470 12345',
    'mail me at fan@gmail.com',
    'see https://example.com',
    'visit www.example.in',
    'go to mysite.com now',
  ])('blocks "%s"', (text) => expect(hasContactDetails(text)).toBe(true));

  it.each([
    'Is 2 litres of water a day enough?',
    'Songs from 1983 please',
    'Dr. Anu, what about sugar levels after 40?',
    'Play Malare for my mother',
  ])('allows "%s"', (text) => expect(hasContactDetails(text)).toBe(false));
});
