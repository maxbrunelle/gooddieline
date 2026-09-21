import { TemplateDefinition } from '../models/dieline.models';

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    id: 'rsc_carton',
    name: 'Regular Slotted Carton (RSC)',
    code: 'FEFCO 0201',
    category: 'shipping',
    description: 'The standard global shipping carton with top and bottom flaps meeting at the center. Highly cost-effective and structurally robust.',
    recommendedMaterial: 'mat_bflute_30',
    panelCount: 12,
    defaultParams: {
      length: 300,
      width: 200,
      height: 150,
      glueFlap: 31.75,
      slotWidth: 6.35,
      bleed: 3,
      safety: 5
    },
    paramsList: [
      { key: 'length', label: 'Box Length (L)', category: 'primary', value: 300, min: 50, max: 1500, step: 5, unit: 'mm', description: 'Longer dimension of box opening' },
      { key: 'width', label: 'Box Width (W)', category: 'primary', value: 200, min: 50, max: 1200, step: 5, unit: 'mm', description: 'Shorter dimension of box opening' },
      { key: 'height', label: 'Box Depth / Height (H)', category: 'primary', value: 150, min: 40, max: 1200, step: 5, unit: 'mm', description: 'Internal height from base to top opening' },
      { key: 'glueFlap', label: 'Manufacturer Glue Flap', category: 'flaps', value: 31.75, min: 10, max: 80, step: 0.1, unit: 'mm', description: 'Side seam glue joint width (1.25" / 31.75 mm)' },
      { key: 'slotWidth', label: 'Slot Clearance (0.25")', category: 'advanced', value: 6.35, min: 1, max: 25, step: 0.25, unit: 'mm', description: 'Slot distance between adjacent folding flaps (0.25" / 6.35 mm)' },
      { key: 'bleed', label: 'Print Bleed Margin', category: 'advanced', value: 3, min: 0, max: 15, step: 0.5, unit: 'mm', description: 'Artwork bleed boundary extension' },
      { key: 'safety', label: 'Inner Safety Margin', category: 'advanced', value: 5, min: 2, max: 20, step: 0.5, unit: 'mm', description: 'Safe artwork printing clearance' }
    ]
  },
  {
    id: 'mailer_box',
    name: 'Roll End Tuck Front Mailer (RETF)',
    code: 'FEFCO 0427',
    category: 'mailer',
    description: 'Industrial roll-end tuck-front mailer with double roll-over side walls, snap-locking base slots, hinged lid, rounded dust flaps, and cherry lock front tuck flap.',
    recommendedMaterial: 'mat_eflute_15',
    panelCount: 16,
    defaultParams: {
      length: 220,
      width: 300,
      height: 80,
      tuckFlap: 80,
      caliper: 2.5,
      bleed: 3,
      safety: 5
    },
    paramsList: [
      { key: 'length', label: 'Base Width (L)', category: 'primary', value: 220, min: 50, max: 1200, step: 5, unit: 'mm', description: 'Horizontal dimension of base and lid panel' },
      { key: 'width', label: 'Base Length (W)', category: 'primary', value: 300, min: 50, max: 1200, step: 5, unit: 'mm', description: 'Vertical dimension of base and lid panel' },
      { key: 'height', label: 'Box Depth / Height (D)', category: 'primary', value: 80, min: 20, max: 500, step: 2, unit: 'mm', description: 'Wall height / box internal depth' },
      { key: 'tuckFlap', label: 'Front Tuck-In Flap Depth', category: 'flaps', value: 80, min: 25, max: 300, step: 2, unit: 'mm', description: 'Closure tuck flap depth' },
      { key: 'caliper', label: 'Board Caliper / Gap', category: 'advanced', value: 2.5, min: 0.5, max: 7, step: 0.5, unit: 'mm', description: 'Board thickness clearance for double roll-over crease' },
      { key: 'bleed', label: 'Bleed Margin', category: 'advanced', value: 3, min: 0, max: 10, step: 0.5, unit: 'mm' }
    ]
  },
  {
    id: 'ugly_ass_mailer_box',
    name: 'Ugly Ass Mailer Box',
    code: 'CUSTOM CROSS-MAILER',
    category: 'mailer',
    description: 'Minimalist 1-piece cross folder mailer box with rectangular base, full-width side wrap flaps, and creased top & bottom fold flaps. Enter closed dimensions and open flat dimensions auto-adapt.',
    recommendedMaterial: 'mat_eflute_15',
    panelCount: 9,
    defaultParams: {
      length: 280,
      width: 200,
      height: 40,
      topFlap: 152.4,
      bottomFlap: 152.4,
      leftFlap: 100,
      rightFlap: 100,
      bleed: 3,
      caliper: 2.5
    },
    paramsList: [
      { key: 'length', label: 'Closed Length (L)', category: 'primary', value: 280, min: 50, max: 1200, step: 5, unit: 'mm', description: 'Closed box length' },
      { key: 'width', label: 'Closed Width (W)', category: 'primary', value: 200, min: 50, max: 1000, step: 5, unit: 'mm', description: 'Closed box width (side flaps auto-adapt to W / 2)' },
      { key: 'height', label: 'Closed Height / Depth (H)', category: 'primary', value: 40, min: 10, max: 300, step: 2, unit: 'mm', description: 'Closed box wall depth / height' },
      { key: 'topFlap', label: 'Top & Bottom Flaps (Default 6")', category: 'flaps', value: 152.4, min: 20, max: 500, step: 2.54, unit: 'mm', description: 'Synchronized top & bottom fold flaps extension (defaults to 6 in / 152.4 mm)' },
      { key: 'leftFlap', label: 'Left & Right Flaps (Auto W / 2)', category: 'flaps', value: 100, min: 20, max: 600, step: 2.54, unit: 'mm', description: 'Synchronized left & right wrap flaps (automatically adapts to half of box width)' },
      { key: 'caliper', label: 'Board Caliper / Thickness', category: 'advanced', value: 2.5, min: 0.5, max: 7, step: 0.5, unit: 'mm', description: 'Board thickness clearance' },
      { key: 'bleed', label: 'Bleed Margin', category: 'advanced', value: 3, min: 0, max: 10, step: 0.5, unit: 'mm' }
    ]
  }
];

