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
      glueFlap: 25.4,
      slotWidth: 4,
      bleed: 3,
      safety: 5,
      tuckOffset: 0
    },
    paramsList: [
      { key: 'length', label: 'Box Length (L)', category: 'primary', value: 300, min: 50, max: 1500, step: 5, unit: 'mm', description: 'Longer dimension of box opening' },
      { key: 'width', label: 'Box Width (W)', category: 'primary', value: 200, min: 50, max: 1200, step: 5, unit: 'mm', description: 'Shorter dimension of box opening' },
      { key: 'height', label: 'Box Depth / Height (H)', category: 'primary', value: 150, min: 40, max: 1200, step: 5, unit: 'mm', description: 'Internal height from base to top opening' },
      { key: 'glueFlap', label: 'Manufacturer Glue Flap', category: 'flaps', value: 25.4, min: 10, max: 80, step: 0.1, unit: 'mm', description: 'Side seam glue joint width' },
      { key: 'slotWidth', label: 'Slot Cutting Clearance', category: 'advanced', value: 4, min: 2, max: 10, step: 0.5, unit: 'mm', description: 'Slot gap between adjacent folding flaps' },
      { key: 'bleed', label: 'Print Bleed Margin', category: 'advanced', value: 3, min: 0, max: 15, step: 0.5, unit: 'mm', description: 'Artwork bleed boundary extension' },
      { key: 'safety', label: 'Inner Safety Margin', category: 'advanced', value: 5, min: 2, max: 20, step: 0.5, unit: 'mm', description: 'Safe artwork printing clearance' }
    ]
  },
  {
    id: 'mailer_box',
    name: 'Roll End Tuck Top Mailer (RETT)',
    code: 'FEFCO 0427',
    category: 'mailer',
    description: 'Standard FEFCO 0427 roll-end tuck-top mailer carton with double roll-over side walls, snap-locking base tabs, hinged cover, side tuck wings, and front locking flap with thumb notch.',
    recommendedMaterial: 'mat_eflute_15',
    panelCount: 16,
    defaultParams: {
      length: 260,
      width: 180,
      height: 70,
      tuckFlap: 50,
      thumbNotchRadius: 10,
      caliper: 2.5,
      bleed: 3,
      safety: 5
    },
    paramsList: [
      { key: 'length', label: 'Base Length (L*)', category: 'primary', value: 260, min: 80, max: 800, step: 5, unit: 'mm', description: 'Internal length of the base tray (horizontal dimension)' },
      { key: 'width', label: 'Base Width (W*)', category: 'primary', value: 180, min: 60, max: 600, step: 5, unit: 'mm', description: 'Internal width of the base tray (vertical dimension)' },
      { key: 'height', label: 'Box Depth (D*)', category: 'primary', value: 70, min: 25, max: 250, step: 2, unit: 'mm', description: 'Internal wall depth/height' },
      { key: 'tuckFlap', label: 'Front Tuck Flap', category: 'flaps', value: 50, min: 20, max: 100, step: 1, unit: 'mm', description: 'Front cover tuck-in depth' },
      { key: 'thumbNotchRadius', label: 'Thumb Notch Radius', category: 'flaps', value: 10, min: 4, max: 20, step: 1, unit: 'mm', description: 'Semi-circular thumb opening radius' },
      { key: 'caliper', label: 'Board Caliper / Gap', category: 'advanced', value: 2.5, min: 1, max: 7, step: 0.5, unit: 'mm', description: 'Board thickness clearance for double roll-over crease' },
      { key: 'bleed', label: 'Bleed Margin', category: 'advanced', value: 3, min: 0, max: 10, step: 0.5, unit: 'mm' }
    ]
  },
  {
    id: 'straight_tuck_end',
    name: 'Straight Tuck End Box (STE)',
    code: 'ECMA A20.20.01.01',
    category: 'folding_carton',
    description: 'Retail folding carton where both top and bottom tuck flaps hinge from the front panel and fold toward the back. Clean seamless front display.',
    recommendedMaterial: 'mat_sbs_18pt',
    panelCount: 10,
    defaultParams: {
      length: 120,
      width: 70,
      height: 180,
      glueFlap: 25.4,
      tuckFlap: 22,
      dustFlap: 25,
      frictionNotch: 2,
      bleed: 3,
      safety: 4
    },
    paramsList: [
      { key: 'length', label: 'Carton Length (L)', category: 'primary', value: 120, min: 30, max: 400, step: 2, unit: 'mm' },
      { key: 'width', label: 'Carton Depth / Width (W)', category: 'primary', value: 70, min: 20, max: 300, step: 2, unit: 'mm' },
      { key: 'height', label: 'Carton Height (H)', category: 'primary', value: 180, min: 40, max: 600, step: 5, unit: 'mm' },
      { key: 'glueFlap', label: 'Side Glue Seam', category: 'flaps', value: 25.4, min: 8, max: 50, step: 0.1, unit: 'mm' },
      { key: 'tuckFlap', label: 'Tuck-in Flap Depth', category: 'flaps', value: 22, min: 10, max: 45, step: 1, unit: 'mm' },
      { key: 'dustFlap', label: 'Dust Flap Extension', category: 'flaps', value: 25, min: 10, max: 50, step: 1, unit: 'mm' }
    ]
  },
  {
    id: 'reverse_tuck_end',
    name: 'Reverse Tuck End Box (RTE)',
    code: 'ECMA A20.20.01.02',
    category: 'folding_carton',
    description: 'Standard retail box with top flap hinging from rear panel and bottom flap hinging from front panel. Compact dieline with excellent sheet nesting density.',
    recommendedMaterial: 'mat_fbb_24pt',
    panelCount: 10,
    defaultParams: {
      length: 100,
      width: 60,
      height: 150,
      glueFlap: 25.4,
      tuckFlap: 20,
      dustFlap: 22,
      bleed: 3,
      safety: 4
    },
    paramsList: [
      { key: 'length', label: 'Carton Length (L)', category: 'primary', value: 100, min: 30, max: 400, step: 2, unit: 'mm' },
      { key: 'width', label: 'Carton Width (W)', category: 'primary', value: 60, min: 20, max: 300, step: 2, unit: 'mm' },
      { key: 'height', label: 'Carton Height (H)', category: 'primary', value: 150, min: 40, max: 500, step: 5, unit: 'mm' },
      { key: 'glueFlap', label: 'Side Glue Seam', category: 'flaps', value: 25.4, min: 8, max: 50, step: 0.1, unit: 'mm' },
      { key: 'tuckFlap', label: 'Tuck Flap Depth', category: 'flaps', value: 20, min: 10, max: 40, step: 1, unit: 'mm' }
    ]
  },
  {
    id: 'auto_bottom_box',
    name: 'Crash Lock / Auto Bottom Box',
    code: 'FEFCO 0215 / ECMA A55.20.02.01',
    category: 'folding_carton',
    description: 'High-speed assembly carton with pre-glued diagonal fold bottom flaps that instantly snap into a rigid locked base when popped open.',
    recommendedMaterial: 'mat_fbb_24pt',
    panelCount: 12,
    defaultParams: {
      length: 120,
      width: 80,
      height: 160,
      glueFlap: 25.4,
      tuckFlap: 24,
      dustFlap: 28,
      lockAngle: 45,
      bleed: 3
    },
    paramsList: [
      { key: 'length', label: 'Box Length (L)', category: 'primary', value: 120, min: 40, max: 500, step: 5, unit: 'mm' },
      { key: 'width', label: 'Box Width (W)', category: 'primary', value: 80, min: 30, max: 400, step: 5, unit: 'mm' },
      { key: 'height', label: 'Box Height (H)', category: 'primary', value: 160, min: 50, max: 600, step: 5, unit: 'mm' },
      { key: 'glueFlap', label: 'Side Glue Seam', category: 'flaps', value: 25.4, min: 10, max: 50, step: 0.1, unit: 'mm' },
      { key: 'tuckFlap', label: 'Top Tuck Flap', category: 'flaps', value: 24, min: 12, max: 45, step: 1, unit: 'mm' }
    ]
  },
  {
    id: 'roll_end_tray',
    name: 'Roll End Self-Locking Tray',
    code: 'FEFCO 0422',
    category: 'tray',
    description: 'Sturdy tray with double-wall rolled side panels locking into base cutouts. Ideal for bakery, produce, retail presentation, and shelf organizers.',
    recommendedMaterial: 'mat_eflute_15',
    panelCount: 9,
    defaultParams: {
      length: 300,
      width: 200,
      height: 60,
      rollOverFlap: 58,
      tabWidth: 20,
      bleed: 3
    },
    paramsList: [
      { key: 'length', label: 'Tray Length (L)', category: 'primary', value: 300, min: 80, max: 800, step: 5, unit: 'mm' },
      { key: 'width', label: 'Tray Width (W)', category: 'primary', value: 200, min: 60, max: 600, step: 5, unit: 'mm' },
      { key: 'height', label: 'Tray Depth / Wall (H)', category: 'primary', value: 60, min: 20, max: 200, step: 2, unit: 'mm' },
      { key: 'tabWidth', label: 'Corner Lock Tab Width', category: 'flaps', value: 20, min: 10, max: 40, step: 1, unit: 'mm' }
    ]
  },
  {
    id: 'open_tray_4corner',
    name: '4-Corner Glued Open Tray',
    code: 'FEFCO 0401',
    category: 'tray',
    description: 'Simple 4-wall open top tray with 4 tapered corner glue tabs for rapid assembly and high stackability.',
    recommendedMaterial: 'mat_bflute_30',
    panelCount: 9,
    defaultParams: {
      length: 350,
      width: 250,
      height: 80,
      glueTab: 25.4,
      taperAngle: 10,
      bleed: 3
    },
    paramsList: [
      { key: 'length', label: 'Tray Base Length', category: 'primary', value: 350, min: 80, max: 1000, step: 5, unit: 'mm' },
      { key: 'width', label: 'Tray Base Width', category: 'primary', value: 250, min: 60, max: 800, step: 5, unit: 'mm' },
      { key: 'height', label: 'Wall Height', category: 'primary', value: 80, min: 20, max: 300, step: 2, unit: 'mm' },
      { key: 'glueTab', label: 'Corner Glue Flap', category: 'flaps', value: 25.4, min: 10, max: 60, step: 0.1, unit: 'mm' }
    ]
  },
  {
    id: 'wraparound_sleeve',
    name: 'Wraparound Packaging Sleeve',
    code: 'ECMA C10.10.00.00',
    category: 'sleeve',
    description: 'Sliding wrap sleeve with 4 panels and glue seam, with optional thumb access cutouts. Perfect for meal boxes, soap, books, and promotional bundling.',
    recommendedMaterial: 'mat_kraftboard_10',
    panelCount: 5,
    defaultParams: {
      length: 160,
      width: 110,
      height: 45,
      glueFlap: 25.4,
      thumbNotchRadius: 15,
      bleed: 3
    },
    paramsList: [
      { key: 'length', label: 'Product Length (L)', category: 'primary', value: 160, min: 40, max: 600, step: 5, unit: 'mm' },
      { key: 'width', label: 'Sleeve Depth / Width (W)', category: 'primary', value: 110, min: 30, max: 500, step: 5, unit: 'mm' },
      { key: 'height', label: 'Product Height (H)', category: 'primary', value: 45, min: 15, max: 250, step: 2, unit: 'mm' },
      { key: 'glueFlap', label: 'Overlap Glue Flap', category: 'flaps', value: 25.4, min: 10, max: 50, step: 0.1, unit: 'mm' },
      { key: 'thumbNotchRadius', label: 'Finger Notch Radius', category: 'advanced', value: 15, min: 0, max: 30, step: 1, unit: 'mm' }
    ]
  },
  {
    id: 'pillow_box',
    name: 'Pillow Box with Curved Creases',
    code: 'FEFCO 0460 / Novelty',
    category: 'novelty',
    description: 'Elegant elliptical gift packaging box with curved folding end flaps and finger notches. Popular for apparel, jewelry, and luxury retail giftware.',
    recommendedMaterial: 'mat_fbb_24pt',
    panelCount: 6,
    defaultParams: {
      length: 180,
      width: 100,
      curveDepth: 25,
      glueFlap: 25.4,
      thumbNotch: 12,
      bleed: 3
    },
    paramsList: [
      { key: 'length', label: 'Body Length (L)', category: 'primary', value: 180, min: 60, max: 500, step: 5, unit: 'mm' },
      { key: 'width', label: 'Arc Width (W)', category: 'primary', value: 100, min: 40, max: 350, step: 5, unit: 'mm' },
      { key: 'curveDepth', label: 'End Curve Crown Depth', category: 'flaps', value: 25, min: 10, max: 60, step: 2, unit: 'mm' },
      { key: 'glueFlap', label: 'Side Seam Flap', category: 'flaps', value: 25.4, min: 8, max: 50, step: 0.1, unit: 'mm' }
    ]
  },
  {
    id: 'lid_base_box',
    name: 'Lid + Base 2-Piece Telescoping Box',
    code: 'FEFCO 0301',
    category: 'display',
    description: 'Classic luxury 2-piece rigid presentation set with base tray and matching telescoping slip lid with automatic tolerance offset.',
    recommendedMaterial: 'mat_eflute_15',
    panelCount: 18,
    defaultParams: {
      length: 220,
      width: 150,
      height: 70,
      lidHeight: 35,
      lidClearance: 2.5,
      glueTab: 25.4,
      bleed: 3
    },
    paramsList: [
      { key: 'length', label: 'Base Length (L)', category: 'primary', value: 220, min: 60, max: 600, step: 5, unit: 'mm' },
      { key: 'width', label: 'Base Width (W)', category: 'primary', value: 150, min: 50, max: 500, step: 5, unit: 'mm' },
      { key: 'height', label: 'Base Depth (H)', category: 'primary', value: 70, min: 20, max: 250, step: 2, unit: 'mm' },
      { key: 'lidHeight', label: 'Lid Wall Height', category: 'flaps', value: 35, min: 15, max: 200, step: 2, unit: 'mm' },
      { key: 'lidClearance', label: 'Lid Fit Clearance Offset', category: 'advanced', value: 2.5, min: 1, max: 6, step: 0.5, unit: 'mm' }
    ]
  },
  {
    id: 'snap_lock_123_bottom',
    name: '1-2-3 Snap Lock Bottom Box',
    code: 'FEFCO 0216',
    category: 'folding_carton',
    description: 'Interlocking 4-flap base that snaps firmly together by hand without adhesive, paired with a standard top tuck flap. High weight bearing capacity.',
    recommendedMaterial: 'mat_bflute_30',
    panelCount: 12,
    defaultParams: {
      length: 150,
      width: 100,
      height: 200,
      glueFlap: 25.4,
      tuckFlap: 26,
      dustFlap: 30,
      bleed: 3
    },
    paramsList: [
      { key: 'length', label: 'Box Length (L)', category: 'primary', value: 150, min: 50, max: 500, step: 5, unit: 'mm' },
      { key: 'width', label: 'Box Width (W)', category: 'primary', value: 100, min: 40, max: 400, step: 5, unit: 'mm' },
      { key: 'height', label: 'Box Height (H)', category: 'primary', value: 200, min: 60, max: 600, step: 5, unit: 'mm' },
      { key: 'glueFlap', label: 'Side Seam Flap', category: 'flaps', value: 25.4, min: 10, max: 50, step: 0.1, unit: 'mm' },
      { key: 'tuckFlap', label: 'Top Tuck Flap', category: 'flaps', value: 26, min: 15, max: 50, step: 1, unit: 'mm' }
    ]
  },
  {
    id: 'folder_mailer',
    name: 'Bookfold Wrap Mailer',
    code: 'FEFCO 0401 Wrap',
    category: 'mailer',
    description: 'Single-sheet variable depth wraparound book and media mailer with multi-score crease lines and adhesive peel-and-seal closure flap.',
    recommendedMaterial: 'mat_eflute_15',
    panelCount: 8,
    defaultParams: {
      length: 280,
      width: 200,
      height: 35,
      closureFlap: 50,
      sideFlap: 100,
      bleed: 3
    },
    paramsList: [
      { key: 'length', label: 'Book/Product Length (L)', category: 'primary', value: 280, min: 80, max: 700, step: 5, unit: 'mm' },
      { key: 'width', label: 'Book/Product Width (W)', category: 'primary', value: 200, min: 60, max: 500, step: 5, unit: 'mm' },
      { key: 'height', label: 'Thickness / Depth (H)', category: 'primary', value: 35, min: 10, max: 120, step: 2, unit: 'mm' },
      { key: 'closureFlap', label: 'Top Closure Overlap', category: 'flaps', value: 50, min: 25, max: 100, step: 2, unit: 'mm' }
    ]
  }
];
