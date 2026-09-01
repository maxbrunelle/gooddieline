import { TemplateDefinition } from '../models/dieline.models';

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    id: 'rsc_carton',
    name: 'Regular Slotted Carton (RSC)',
    code: 'FEFCO 0201',
    category: 'shipping',
    description: 'The standard global shipping carton with top and bottom flaps meeting at the center. Most cost-effective and structurally strong packaging box.',
    recommendedMaterial: 'mat_bflute_30',
    panelCount: 12,
    defaultParams: {
      length: 300,
      width: 200,
      height: 150,
      glueFlap: 31.75,
      slotWidth: 6.35,
      bleed: 3,
      safety: 5,
      tuckOffset: 0
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
    description: 'Industrial FEFCO 0427 roll-end tuck-front mailer carton with double roll-over side walls, snap-locking base slots, hinged cover, rounded dust flaps, and cherry lock curved front tuck flap.',
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
  }
];
