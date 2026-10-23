/**
 * src/content.ts — Copy shared by the homepage and the Help tab, so they never disagree.
 * Safety claims list only what the product actually does.
 */
export const FAQ: { q: string; a: string }[] = [
  {
    q: 'Do I pay you?',
    a: 'No. EcoRide is free and takes no commission. You pay the cab app as usual, and the others pay their share straight to the person who booked, by UPI.',
  },
  {
    q: 'What if nobody matches?',
    a: 'We keep looking until you land. You can send a link to someone on your flight, or book alone whenever you like.',
  },
  {
    q: 'What if someone is late?',
    a: 'Everyone sets the longest they’ll wait when they join. If a flight runs later than that, the group is told and you can leave and pick another match. Ten minutes after the planned departure, the person booking can mark someone as not coming.',
  },
  {
    q: 'Do you book the cab?',
    a: 'No. One person in the group books a normal Uber, Ola, Rapido or Namma Yatri cab. We fill in the pickup and the first stop for them and list the other stops.',
  },
  {
    q: 'Is my address shared?',
    a: 'Others only see your area and roughly how far your drop is from theirs. Your exact address goes only to the person booking, after everyone says yes, and is deleted when the trip ends.',
  },
  {
    q: 'What if I’m not comfortable?',
    a: 'Say no thanks to any invite, or leave a group before the cab is booked. At the pickup point you can always decide not to get in and book alone. In an emergency, use the Call 112 button.',
  },
];

export const STEPS = [
  {
    title: 'Tell us where and when',
    body: 'Type your drop point, or drop a pin, and pick when you land. Your flight number is optional.',
  },
  {
    title: 'Pick a match',
    body: 'You see people landing around then and heading your way, best match first, with what you’d save.',
  },
  {
    title: 'Everyone says yes',
    body: 'Each person gets a few minutes to accept. Nothing is booked until everyone has.',
  },
  {
    title: 'Meet at pickup, one books, split by UPI',
    body: 'Check the 4-digit code together. One person books a regular cab, and everyone pays their share by UPI.',
  },
];

export const SAFETY = [
  'First names only. Nobody sees your phone number or full name.',
  'A 4-digit code to check you’re getting into the right shared cab.',
  'A women-only option. It’s self-declared, and we can’t verify it.',
  'Share your trip with family on WhatsApp, with the pickup code and cab number.',
  'A Call 112 button on every trip screen.',
  'Your data is deleted within 24 hours of your trip. Your address goes as soon as the trip ends.',
];
