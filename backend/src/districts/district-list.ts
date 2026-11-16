/**
 * Districts listeners choose from, and stations say they reach.
 * Kerala and Tamil Nadu first; add a state by adding its districts here.
 */
export type District = { id: string; name: string; state: string };

const KERALA = [
  'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam', 'Idukki', 'Ernakulam',
  'Thrissur', 'Palakkad', 'Malappuram', 'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod',
];

const TAMIL_NADU = [
  'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode',
  'Kallakurichi', 'Kancheepuram', 'Kanniyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai',
  'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet',
  'Salem', 'Sivaganga', 'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli',
  'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar',
];

const slug = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, '-');

export const DISTRICTS: District[] = [
  ...KERALA.map((name) => ({ id: `kl-${slug(name)}`, name, state: 'Kerala' })),
  ...TAMIL_NADU.map((name) => ({ id: `tn-${slug(name)}`, name, state: 'Tamil Nadu' })),
];

const IDS = new Set(DISTRICTS.map((d) => d.id));

export const isDistrict = (id: unknown): id is string => typeof id === 'string' && IDS.has(id);

/** A district id from a query string, or null when missing or unknown. */
export const districtParam = (id: unknown) => (isDistrict(id) ? id : null);

/**
 * SQL: the station (an expression giving its id) reaches the district in
 * parameter $n. A station that has not chosen its districts yet, and a
 * programme with no station, show everywhere. With no district chosen
 * (the parameter is null) everything shows.
 */
export const IN_DISTRICT = (stationIdSql: string, n: number) =>
  `($${n}::text IS NULL OR ${stationIdSql} IS NULL OR EXISTS (
     SELECT 1 FROM stations sd WHERE sd.id = ${stationIdSql}
        AND (sd.districts IS NULL OR cardinality(sd.districts) = 0 OR $${n}::text = ANY(sd.districts))))`;
