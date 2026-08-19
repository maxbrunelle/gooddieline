export type FluteType = 'E' | 'B' | 'C' | 'EB' | 'F' | 'Micro' | 'None' | 'Solid' | 'Plastic';

export interface MaterialProfile {
  id: string;
  name: string;
  manufacturer: string;
  category: 'corrugated' | 'paperboard' | 'rigid' | 'plastic' | 'foam';
  flute: FluteType;
  thickness: number; // in mm
  densityGsm: number; // grams per square meter
  recommendedKnife: string; // e.g., "Zünd Z10 / Z11 Drag Knife" or "Z21 Oscillating"
  recommendedCreaseWheel: string; // e.g., "CTT1 C205 Wheel"
  zundModule: 'UCT' | 'POT' | 'EOT' | 'CTT1' | 'CTT2' | 'VCT' | 'DRT';
  costPerSquareMeter: number; // $ USD
  grainDirectionDependent: boolean;
  minCreaseSpacing: number; // mm
  bendAllowanceFactor: number; // K-factor for folding
  description: string;
  color: string;
  textureType: 'kraft' | 'white' | 'grey' | 'bleached' | 'coroplast';
}

export const SEED_MATERIALS: MaterialProfile[] = [
  {
    id: 'mat_eflute_15',
    name: 'E-Flute Corrugated Cardboard',
    manufacturer: 'Cascades / International Paper',
    category: 'corrugated',
    flute: 'E',
    thickness: 1.5,
    densityGsm: 380,
    recommendedKnife: 'Z21 Oscillating Knife',
    recommendedCreaseWheel: 'CTT1 C205 Creasing Wheel',
    zundModule: 'POT',
    costPerSquareMeter: 1.85,
    grainDirectionDependent: true,
    minCreaseSpacing: 3.0,
    bendAllowanceFactor: 0.5,
    description: 'High-strength microflute ideal for mailers, e-commerce shipping, and retail packaging with crisp fold definition.',
    color: '#d4a373',
    textureType: 'kraft'
  },
  {
    id: 'mat_bflute_30',
    name: 'B-Flute Single Wall Corrugated',
    manufacturer: 'Smurfit Westrock',
    category: 'corrugated',
    flute: 'B',
    thickness: 3.0,
    densityGsm: 550,
    recommendedKnife: 'Z26 Oscillating Knife',
    recommendedCreaseWheel: 'CTT2 C206 Wide Wheel',
    zundModule: 'POT',
    costPerSquareMeter: 2.40,
    grainDirectionDependent: true,
    minCreaseSpacing: 6.0,
    bendAllowanceFactor: 0.55,
    description: 'Standard heavy-duty shipping box board providing high puncture resistance and stacking strength for RSC cartons.',
    color: '#c29060',
    textureType: 'kraft'
  },
  {
    id: 'mat_cflute_40',
    name: 'C-Flute Heavy Shipping Board',
    manufacturer: 'Packaging Corp of America',
    category: 'corrugated',
    flute: 'C',
    thickness: 4.0,
    densityGsm: 680,
    recommendedKnife: 'Z26 Heavy Oscillating Knife',
    recommendedCreaseWheel: 'CTT2 C208 Deep Wheel',
    zundModule: 'POT',
    costPerSquareMeter: 2.95,
    grainDirectionDependent: true,
    minCreaseSpacing: 8.0,
    bendAllowanceFactor: 0.6,
    description: 'Thickest common single-wall board with superior compression cushion for master cartons and industrial parts.',
    color: '#b07d4b',
    textureType: 'kraft'
  },
  {
    id: 'mat_sbs_18pt',
    name: 'SBS Solid Bleached Sulfate (18pt / 0.45mm)',
    manufacturer: 'Metsä Board / Clearwater Paper',
    category: 'paperboard',
    flute: 'None',
    thickness: 0.45,
    densityGsm: 350,
    recommendedKnife: 'Z10 Universal Drag Knife',
    recommendedCreaseWheel: 'CTT1 C101 Fine Creaser',
    zundModule: 'UCT',
    costPerSquareMeter: 1.65,
    grainDirectionDependent: true,
    minCreaseSpacing: 1.5,
    bendAllowanceFactor: 0.4,
    description: 'Premium ultra-white virgin fiber board for high-end cosmetics, pharmaceutical, and retail folding cartons.',
    color: '#fafafa',
    textureType: 'white'
  },
  {
    id: 'mat_fbb_24pt',
    name: 'Folding Boxboard FBB (24pt / 0.60mm)',
    manufacturer: 'Stora Enso',
    category: 'paperboard',
    flute: 'None',
    thickness: 0.60,
    densityGsm: 420,
    recommendedKnife: 'Z11 Decoupling Drag Knife',
    recommendedCreaseWheel: 'CTT1 C102 Medium Creaser',
    zundModule: 'UCT',
    costPerSquareMeter: 1.90,
    grainDirectionDependent: true,
    minCreaseSpacing: 2.0,
    bendAllowanceFactor: 0.45,
    description: 'Multi-ply paperboard with coated white top side and creamy back for structural rigidity and graphic brilliance.',
    color: '#f5f5f0',
    textureType: 'bleached'
  },
  {
    id: 'mat_kraftboard_10',
    name: 'Unbleached Kraft Board 1.0mm',
    manufacturer: 'Billerud',
    category: 'paperboard',
    flute: 'Solid',
    thickness: 1.0,
    densityGsm: 650,
    recommendedKnife: 'Z16 Drag Knife',
    recommendedCreaseWheel: 'CTT1 C201 Creasing Wheel',
    zundModule: 'UCT',
    costPerSquareMeter: 2.20,
    grainDirectionDependent: true,
    minCreaseSpacing: 2.5,
    bendAllowanceFactor: 0.48,
    description: 'Eco-friendly natural brown kraft with high tear resistance, popular for artisan packaging and heavy sleeves.',
    color: '#bb8855',
    textureType: 'kraft'
  },
  {
    id: 'mat_coroplast_4mm',
    name: 'Corrugated Polypropylene (Coroplast 4mm)',
    manufacturer: 'Inteplast Group',
    category: 'plastic',
    flute: 'Plastic',
    thickness: 4.0,
    densityGsm: 800,
    recommendedKnife: 'Z20 Driven Oscillating Knife',
    recommendedCreaseWheel: 'CTT2 C204 Plastic Creaser',
    zundModule: 'POT',
    costPerSquareMeter: 3.50,
    grainDirectionDependent: true,
    minCreaseSpacing: 10.0,
    bendAllowanceFactor: 0.7,
    description: 'Waterproof, chemically inert fluted plastic sheet for reusable tote bins, weatherproof signage and durable containers.',
    color: '#e2e8f0',
    textureType: 'coroplast'
  },
  {
    id: 'mat_honeycomb_10mm',
    name: 'Honeycomb Structural Paper Core 10mm',
    manufacturer: 'Falconboard / Re-board',
    category: 'rigid',
    flute: 'Solid',
    thickness: 10.0,
    densityGsm: 1200,
    recommendedKnife: 'Z26 Long Oscillating Knife + V-Cut',
    recommendedCreaseWheel: 'VCT 45° V-Cut Tool',
    zundModule: 'VCT',
    costPerSquareMeter: 6.80,
    grainDirectionDependent: false,
    minCreaseSpacing: 20.0,
    bendAllowanceFactor: 1.0,
    description: 'High rigidity paperboard sandwich core for heavy POS displays, furniture and protective crate inserts.',
    color: '#d4b996',
    textureType: 'kraft'
  }
];
