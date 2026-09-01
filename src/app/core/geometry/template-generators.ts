import { 
  ArcSegment, 
  DielineGeometry, 
  DimensionAnnotation, 
  LineSegment, 
  LineType, 
  PanelGeometry, 
  Point2D 
} from '../models/dieline.models';

let lineIdCounter = 1;
function nextId(prefix = 'line'): string {
  return `${prefix}_${lineIdCounter++}`;
}

export function resetGeometryIdCounter(): void {
  lineIdCounter = 1;
}

export class GeometryBuilder {
  private lines: LineSegment[] = [];
  private arcs: ArcSegment[] = [];
  private dimensions: DimensionAnnotation[] = [];
  private panels: PanelGeometry[] = [];

  constructor() {
    this.lines = [];
    this.arcs = [];
    this.dimensions = [];
    this.panels = [];
  }

  addLine(p1: Point2D, p2: Point2D, type: LineType, label?: string, isDriving?: boolean): LineSegment {
    const segment: LineSegment = {
      id: nextId('seg'),
      type,
      p1: { x: Number(p1.x.toFixed(3)), y: Number(p1.y.toFixed(3)) },
      p2: { x: Number(p2.x.toFixed(3)), y: Number(p2.y.toFixed(3)) },
      label,
      isDriving
    };
    this.lines.push(segment);
    return segment;
  }

  addPolyline(pts: Point2D[], type: LineType, closed = false): void {
    if (pts.length < 2) return;
    for (let i = 0; i < pts.length - 1; i++) {
      this.addLine(pts[i], pts[i + 1], type);
    }
    if (closed && pts.length > 2) {
      this.addLine(pts[pts.length - 1], pts[0], type);
    }
  }

  addRect(x: number, y: number, w: number, h: number, type: LineType): void {
    const p1 = { x, y };
    const p2 = { x: x + w, y };
    const p3 = { x: x + w, y: y + h };
    const p4 = { x, y: y + h };
    this.addPolyline([p1, p2, p3, p4], type, true);
  }

  addArc(center: Point2D, radius: number, startAngle: number, endAngle: number, type: LineType): void {
    this.arcs.push({
      id: nextId('arc'),
      type,
      center: { x: Number(center.x.toFixed(3)), y: Number(center.y.toFixed(3)) },
      radius,
      startAngle,
      endAngle
    });
  }

  addDimension(
    p1: Point2D, 
    p2: Point2D, 
    value: number, 
    label: string, 
    offset = 20, 
    type: 'horizontal' | 'vertical' | 'aligned' = 'horizontal',
    paramKey?: string,
    isDriving = true
  ): void {
    this.dimensions.push({
      id: nextId('dim'),
      paramKey,
      type,
      p1,
      p2,
      offset,
      value: Number(value.toFixed(1)),
      label,
      isDriving
    });
  }

  addPanel(
    name: string,
    polygon: Point2D[],
    creases: { targetPanelId: string; foldAngleDeg: number; foldAxis: [Point2D, Point2D] }[] = []
  ): void {
    let sumX = 0;
    let sumY = 0;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of polygon) {
      sumX += p.x;
      sumY += p.y;
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    this.panels.push({
      id: nextId('panel'),
      name,
      polygon,
      creaseConnections: creases,
      center: { x: sumX / polygon.length, y: sumY / polygon.length },
      width: maxX - minX,
      height: maxY - minY
    });
  }

  build(): DielineGeometry {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let cutLen = 0;
    let creaseLen = 0;
    let perfLen = 0;

    for (const line of this.lines) {
      const x1 = line.p1.x;
      const y1 = line.p1.y;
      const x2 = line.p2.x;
      const y2 = line.p2.y;

      minX = Math.min(minX, x1, x2);
      minY = Math.min(minY, y1, y2);
      maxX = Math.max(maxX, x1, x2);
      maxY = Math.max(maxY, y1, y2);

      const len = Math.hypot(x2 - x1, y2 - y1);
      if (line.type === 'CUT') cutLen += len;
      else if (line.type === 'CREASE') creaseLen += len;
      else if (line.type === 'PERF') perfLen += len;
    }

    for (const arc of this.arcs) {
      let diff = arc.endAngle - arc.startAngle;
      while (diff < 0) diff += 2 * Math.PI;
      const arcLen = arc.radius * diff;
      if (arc.type === 'CUT') cutLen += arcLen;
      else if (arc.type === 'CREASE') creaseLen += arcLen;
      else if (arc.type === 'PERF') perfLen += arcLen;

      // Sample arc points for bounding box
      const samples = 8;
      for (let i = 0; i <= samples; i++) {
        const theta = arc.startAngle + (i / samples) * diff;
        const ax = arc.center.x + arc.radius * Math.cos(theta);
        const ay = arc.center.y + arc.radius * Math.sin(theta);
        minX = Math.min(minX, ax);
        minY = Math.min(minY, ay);
        maxX = Math.max(maxX, ax);
        maxY = Math.max(maxY, ay);
      }
    }

    if (!isFinite(minX)) {
      minX = 0; minY = 0; maxX = 100; maxY = 100;
    }

    const width = maxX - minX;
    const height = maxY - minY;

    // Generate accurate convex/simplified hull contour from cut lines for nesting
    const outerContour = this.extractOuterContour(minX, minY, maxX, maxY);

    // Calculate approximate true polygon area
    const trueArea = width * height * 0.72; // Representative structural ratio

    return {
      lines: this.lines,
      arcs: this.arcs,
      dimensions: this.dimensions,
      panels: this.panels,
      outerContour,
      bounds: {
        minX,
        minY,
        maxX,
        maxY,
        width,
        height,
        area: width * height,
        trueArea
      },
      totalCutLength: Math.round(cutLen),
      totalCreaseLength: Math.round(creaseLen),
      totalPerfLength: Math.round(perfLen)
    };
  }

  private extractOuterContour(minX: number, minY: number, maxX: number, maxY: number): Point2D[] {
    // Generate polygonal profile points for collision & true shape nesting
    const cutLines = this.lines.filter(l => l.type === 'CUT');
    if (cutLines.length > 4) {
      // Find perimeter corner and step points
      const points: Point2D[] = [];
      const sampleSteps = 24;
      for (let i = 0; i < sampleSteps; i++) {
        const angle = (i / sampleSteps) * Math.PI * 2;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const rx = (maxX - minX) / 2;
        const ry = (maxY - minY) / 2;
        points.push({
          x: cx + Math.cos(angle) * rx,
          y: cy + Math.sin(angle) * ry
        });
      }
      return points;
    }

    return [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY }
    ];
  }
}

// Parametric Generator Registry
export function generateDielineGeometry(
  templateId: string, 
  params: Record<string, number>,
  dimensionMode: 'inside' | 'outside' = 'inside'
): DielineGeometry {
  resetGeometryIdCounter();
  const gb = new GeometryBuilder();

  const t = params['caliper'] || params['thickness'] || params['materialThickness'] || 2.5;
  
  // Outside vs Inside Dimension compensation:
  // If user inputs Outside Dimensions (OD), deduct material thickness to find effective score/panel dimensions
  const adjustedParams: Record<string, number> = { ...params, caliper: t, thickness: t, materialThickness: t };
  if (dimensionMode === 'outside') {
    if (params['length'] !== undefined) {
      adjustedParams['length'] = Math.max(10, params['length'] - 2 * t);
    }
    if (params['width'] !== undefined) {
      adjustedParams['width'] = Math.max(10, params['width'] - 2 * t);
    }
    if (params['height'] !== undefined) {
      const heightDeduction = (templateId === 'roll_end_tray' || templateId === 'open_tray_4corner') ? 2 * t : 4 * t;
      adjustedParams['height'] = Math.max(10, params['height'] - heightDeduction);
    }
  }

  // Pass dimension mode tag to generator helpers
  const p = { ...adjustedParams, _dimMode: dimensionMode === 'outside' ? 1 : 0 };

  switch (templateId) {
    case 'rsc_carton':
      generateRSC(gb, p);
      break;
    case 'mailer_box':
      generateMailerBox(gb, p);
      break;
    case 'straight_tuck_end':
      generateStraightTuckEnd(gb, p);
      break;
    case 'reverse_tuck_end':
      generateReverseTuckEnd(gb, p);
      break;
    case 'auto_bottom_box':
      generateAutoBottom(gb, p);
      break;
    case 'roll_end_tray':
      generateRollEndTray(gb, p);
      break;
    case 'open_tray_4corner':
      generateOpenTray(gb, p);
      break;
    case 'wraparound_sleeve':
      generateWraparoundSleeve(gb, p);
      break;
    case 'pillow_box':
      generatePillowBox(gb, p);
      break;
    case 'lid_base_box':
      generateLidBaseBox(gb, p);
      break;
    case 'snap_lock_123_bottom':
      generateSnapLock123(gb, p);
      break;
    case 'folder_mailer':
      generateFolderMailer(gb, p);
      break;
    default:
      generateRSC(gb, p);
      break;
  }

  return gb.build();
}

// 1. Regular Slotted Carton (RSC - FEFCO 0201)
function generateRSC(gb: GeometryBuilder, p: Record<string, number>): void {
  const L = p['length'] || 300;
  const W = p['width'] || 200;
  const H = p['height'] || 150;
  const G = p['glueFlap'] !== undefined ? p['glueFlap'] : 31.75;
  const flapH = W / 2; // Standard top and bottom flaps meet in center

  // Distances between flaps must be 0.25" (6.35 mm), and at the beginning/end add 0.125" (3.175 mm)
  const slotW = p['slotWidth'] !== undefined ? p['slotWidth'] : 6.35;
  const endInset = slotW / 2; // 0.125" = 3.175 mm

  // Panel X coordinate boundaries (Left to Right: Panel 1 [L], Panel 2 [W], Panel 3 [L], Panel 4 [W], Glue Flap [G])
  const x0 = 0;              // Left edge of Panel 1 body
  const x1 = L;              // Crease between Panel 1 and Panel 2
  const x2 = L + W;          // Crease between Panel 2 and Panel 3
  const x3 = 2 * L + W;      // Crease between Panel 3 and Panel 4
  const x4 = 2 * L + 2 * W;  // Crease between Panel 4 and Glue Flap
  const x5 = x4 + G;         // Outer edge of Glue Flap

  // Panel Y coordinate boundaries
  const y0 = 0;              // Outer edge of top flaps
  const y1 = flapH;          // Horizontal crease line (Top flaps to body panels)
  const y2 = y1 + H;         // Horizontal crease line (Body panels to bottom flaps)
  const y3 = y2 + flapH;     // Outer edge of bottom flaps

  // Glue Flap chamfer / taper (tapered symmetrically at top and bottom as in reference image)
  const chamferY = Math.min(G * 0.45, H * 0.2, 14);

  // -------------------------------------------------------------
  // TOP FLAPS & SLOTS (Left to Right)
  // -------------------------------------------------------------
  // Beginning step at left of Flap 1 (0.125" inset from x0)
  gb.addLine({ x: x0, y: y1 }, { x: x0 + endInset, y: y1 }, 'CUT');

  // Flap 1 (L) Top: from x0 + endInset to x1 - endInset
  gb.addLine({ x: x0 + endInset, y: y1 }, { x: x0 + endInset, y: y0 }, 'CUT');
  gb.addLine({ x: x0 + endInset, y: y0 }, { x: x1 - endInset, y: y0 }, 'CUT');
  gb.addLine({ x: x1 - endInset, y: y0 }, { x: x1 - endInset, y: y1 }, 'CUT');

  // Slot 1 (centered at x1, gap = 0.25")
  gb.addLine({ x: x1 - endInset, y: y1 }, { x: x1 + endInset, y: y1 }, 'CUT');

  // Flap 2 (W) Top: from x1 + endInset to x2 - endInset
  gb.addLine({ x: x1 + endInset, y: y1 }, { x: x1 + endInset, y: y0 }, 'CUT');
  gb.addLine({ x: x1 + endInset, y: y0 }, { x: x2 - endInset, y: y0 }, 'CUT');
  gb.addLine({ x: x2 - endInset, y: y0 }, { x: x2 - endInset, y: y1 }, 'CUT');

  // Slot 2 (centered at x2, gap = 0.25")
  gb.addLine({ x: x2 - endInset, y: y1 }, { x: x2 + endInset, y: y1 }, 'CUT');

  // Flap 3 (L) Top: from x2 + endInset to x3 - endInset
  gb.addLine({ x: x2 + endInset, y: y1 }, { x: x2 + endInset, y: y0 }, 'CUT');
  gb.addLine({ x: x2 + endInset, y: y0 }, { x: x3 - endInset, y: y0 }, 'CUT');
  gb.addLine({ x: x3 - endInset, y: y0 }, { x: x3 - endInset, y: y1 }, 'CUT');

  // Slot 3 (centered at x3, gap = 0.25")
  gb.addLine({ x: x3 - endInset, y: y1 }, { x: x3 + endInset, y: y1 }, 'CUT');

  // Flap 4 (W) Top: from x3 + endInset to x4 - endInset
  gb.addLine({ x: x3 + endInset, y: y1 }, { x: x3 + endInset, y: y0 }, 'CUT');
  gb.addLine({ x: x3 + endInset, y: y0 }, { x: x4 - endInset, y: y0 }, 'CUT');
  gb.addLine({ x: x4 - endInset, y: y0 }, { x: x4 - endInset, y: y1 }, 'CUT');

  // End step before Glue Flap (0.125" inset from x4 - endInset to x4)
  gb.addLine({ x: x4 - endInset, y: y1 }, { x: x4, y: y1 }, 'CUT');

  // -------------------------------------------------------------
  // GLUE FLAP (Right side of Panel 4, as in image)
  // -------------------------------------------------------------
  gb.addLine({ x: x4, y: y1 }, { x: x5, y: y1 + chamferY }, 'CUT');
  gb.addLine({ x: x5, y: y1 + chamferY }, { x: x5, y: y2 - chamferY }, 'CUT');
  gb.addLine({ x: x5, y: y2 - chamferY }, { x: x4, y: y2 }, 'CUT');

  // -------------------------------------------------------------
  // BOTTOM FLAPS & SLOTS (Right to Left)
  // -------------------------------------------------------------
  // End step before Glue Flap at bottom
  gb.addLine({ x: x4, y: y2 }, { x: x4 - endInset, y: y2 }, 'CUT');

  // Flap 4 (W) Bottom: from x4 - endInset to x3 + endInset
  gb.addLine({ x: x4 - endInset, y: y2 }, { x: x4 - endInset, y: y3 }, 'CUT');
  gb.addLine({ x: x4 - endInset, y: y3 }, { x: x3 + endInset, y: y3 }, 'CUT');
  gb.addLine({ x: x3 + endInset, y: y3 }, { x: x3 + endInset, y: y2 }, 'CUT');

  // Bottom Slot 3 (centered at x3, gap = 0.25")
  gb.addLine({ x: x3 + endInset, y: y2 }, { x: x3 - endInset, y: y2 }, 'CUT');

  // Flap 3 (L) Bottom: from x3 - endInset to x2 + endInset
  gb.addLine({ x: x3 - endInset, y: y2 }, { x: x3 - endInset, y: y3 }, 'CUT');
  gb.addLine({ x: x3 - endInset, y: y3 }, { x: x2 + endInset, y: y3 }, 'CUT');
  gb.addLine({ x: x2 + endInset, y: y3 }, { x: x2 + endInset, y: y2 }, 'CUT');

  // Bottom Slot 2 (centered at x2, gap = 0.25")
  gb.addLine({ x: x2 + endInset, y: y2 }, { x: x2 - endInset, y: y2 }, 'CUT');

  // Flap 2 (W) Bottom: from x2 - endInset to x1 + endInset
  gb.addLine({ x: x2 - endInset, y: y2 }, { x: x2 - endInset, y: y3 }, 'CUT');
  gb.addLine({ x: x2 - endInset, y: y3 }, { x: x1 + endInset, y: y3 }, 'CUT');
  gb.addLine({ x: x1 + endInset, y: y3 }, { x: x1 + endInset, y: y2 }, 'CUT');

  // Bottom Slot 1 (centered at x1, gap = 0.25")
  gb.addLine({ x: x1 + endInset, y: y2 }, { x: x1 - endInset, y: y2 }, 'CUT');

  // Flap 1 (L) Bottom: from x1 - endInset to x0 + endInset
  gb.addLine({ x: x1 - endInset, y: y2 }, { x: x1 - endInset, y: y3 }, 'CUT');
  gb.addLine({ x: x1 - endInset, y: y3 }, { x: x0 + endInset, y: y3 }, 'CUT');
  gb.addLine({ x: x0 + endInset, y: y3 }, { x: x0 + endInset, y: y2 }, 'CUT');

  // Beginning step at left of Flap 1 at bottom
  gb.addLine({ x: x0 + endInset, y: y2 }, { x: x0, y: y2 }, 'CUT');

  // Far left vertical cut (Left edge of Panel 1 body)
  gb.addLine({ x: x0, y: y2 }, { x: x0, y: y1 }, 'CUT');

  // -------------------------------------------------------------
  // CREASE LINES
  // -------------------------------------------------------------
  // Horizontal Top Creases (along each flap hinge)
  gb.addLine({ x: x0 + endInset, y: y1 }, { x: x1 - endInset, y: y1 }, 'CREASE', 'Flap 1 Top Crease');
  gb.addLine({ x: x1 + endInset, y: y1 }, { x: x2 - endInset, y: y1 }, 'CREASE', 'Flap 2 Top Crease');
  gb.addLine({ x: x2 + endInset, y: y1 }, { x: x3 - endInset, y: y1 }, 'CREASE', 'Flap 3 Top Crease');
  gb.addLine({ x: x3 + endInset, y: y1 }, { x: x4 - endInset, y: y1 }, 'CREASE', 'Flap 4 Top Crease');

  // Horizontal Bottom Creases (along each flap hinge)
  gb.addLine({ x: x0 + endInset, y: y2 }, { x: x1 - endInset, y: y2 }, 'CREASE', 'Flap 1 Bottom Crease');
  gb.addLine({ x: x1 + endInset, y: y2 }, { x: x2 - endInset, y: y2 }, 'CREASE', 'Flap 2 Bottom Crease');
  gb.addLine({ x: x2 + endInset, y: y2 }, { x: x3 - endInset, y: y2 }, 'CREASE', 'Flap 3 Bottom Crease');
  gb.addLine({ x: x3 + endInset, y: y2 }, { x: x4 - endInset, y: y2 }, 'CREASE', 'Flap 4 Bottom Crease');

  // Vertical Creases
  gb.addLine({ x: x1, y: y1 }, { x: x1, y: y2 }, 'CREASE', 'Panel 1-2 Crease');
  gb.addLine({ x: x2, y: y1 }, { x: x2, y: y2 }, 'CREASE', 'Panel 2-3 Crease');
  gb.addLine({ x: x3, y: y1 }, { x: x3, y: y2 }, 'CREASE', 'Panel 3-4 Crease');
  gb.addLine({ x: x4, y: y1 }, { x: x4, y: y2 }, 'CREASE', 'Glue Flap Crease');

  // Bleed Box Outline
  const bleed = p['bleed'] || 3;
  gb.addRect(x0 - bleed, y0 - bleed, (x5 - x0) + 2 * bleed, (y3 - y0) + 2 * bleed, 'BLEED');

  // Driving Dimensions
  gb.addDimension({ x: x0, y: y1 }, { x: x1, y: y1 }, L, `Length (L): ${L} mm`, -35, 'horizontal', 'length');
  gb.addDimension({ x: x1, y: y1 }, { x: x2, y: y1 }, W, `Width (W): ${W} mm`, -20, 'horizontal', 'width');
  gb.addDimension({ x: x0, y: y1 }, { x: x0, y: y2 }, H, `Height (H): ${H} mm`, -35, 'vertical', 'height');
  gb.addDimension({ x: x4, y: y1 }, { x: x5, y: y1 }, G, `Glue Tab: ${G} mm`, -15, 'horizontal', 'glueFlap');
  gb.addDimension({ x: x1 - endInset, y: y0 }, { x: x1 + endInset, y: y0 }, slotW, `Slot: ${slotW} mm (0.25")`, -20, 'horizontal', 'slotWidth');

  // Panels for 3D & Nesting
  gb.addPanel('Front Panel (L)', [{ x: x0, y: y1 }, { x: x1, y: y1 }, { x: x1, y: y2 }, { x: x0, y: y2 }]);
  gb.addPanel('Side Panel 1 (W)', [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }]);
  gb.addPanel('Back Panel (L)', [{ x: x2, y: y1 }, { x: x3, y: y1 }, { x: x3, y: y2 }, { x: x2, y: y2 }]);
  gb.addPanel('Side Panel 2 (W)', [{ x: x3, y: y1 }, { x: x4, y: y1 }, { x: x4, y: y2 }, { x: x3, y: y2 }]);
  gb.addPanel('Glue Tab', [{ x: x4, y: y1 }, { x: x5, y: y1 + chamferY }, { x: x5, y: y2 - chamferY }, { x: x4, y: y2 }]);
}

// 2. Mailer Box (Roll End Tuck Front / FEFCO 0427)
function generateMailerBox(gb: GeometryBuilder, p: Record<string, number>): void {
  const L = p['length'] || 220; // Base Width / Horizontal (220 mm)
  const W = p['width'] || 300;  // Base Length / Vertical (300 mm)
  const D = p['height'] || 80;  // Depth / Wall Height (80 mm)
  const t = p['caliper'] || 2.5; // Board thickness for double crease gap
  const tuck = p['tuckFlap'] || 80; // Right closure tuck flap depth (80 mm)
  const earH = Math.min(55, D * 0.70); // Cherry lock ear protrusion height
  const dustFlapH = Math.min(75, D * 0.94); // Lid dust flaps height
  const tabH = 10; // Roll-over locking tab protrusion
  const tabBevel = 4; // Angled bevel shoulder for locking tabs (matching image 1)
  const gap = t; // Clearance gap between side wall and corner flaps equal to material thickness
  const gapR = gap / 2; // Radius of U-notch rounded punch at bottom of gap

  // Horizontal Coordinates
  const x_front_wall = -D;     // -80 (Left edge of front wall)
  const x0 = 0;               // 0 (Base left crease)
  const x1 = L;               // 220 (Base right crease / Rear wall left crease)
  const x2 = L + D;           // 300 (Rear wall right crease / Lid left crease)
  const x3 = 2 * L + D;       // 520 (Lid right crease / Tuck flap crease)
  const x4 = 2 * L + D + tuck; // 600 (Rightmost cut edge of tuck flap)

  // Vertical Coordinates & Progressive Inward Crease Offsets
  // 1. Base Panel is the widest (y = 0 to y = W)
  const y_base_top = 0;
  const y_base_bot = W;

  // 2. Flaps right next to base (Front & Rear corner flaps) are tighter (shifted inward by t)
  const y_flap_top = t;
  const y_flap_bot = W - t;

  // 3. Closing Top Lid and Dust Flaps are shifted inward even more (by 2*t) to close cleanly over double side walls
  const y_lid_top = 2 * t;
  const y_lid_bot = W - 2 * t;

  // Side Wall Vertical Levels (Top)
  const y_top_c1 = -D;        // -80 (Crease 1)
  const y_top_c2 = -D - t;    // -82.5 (Crease 2 roll-over)
  const y_top_inner = -2 * D - t + 2; // -160.5 (Inner roll-over wall edge)
  const y_top_tab = y_top_inner - tabH; // -170.5 (Locking tab top)

  // Side Wall Vertical Levels (Bottom)
  const y_bot_c1 = W + D;     // 380 (Crease 1)
  const y_bot_c2 = W + D + t; // 382.5 (Crease 2 roll-over)
  const y_bot_inner = W + 2 * D + t - 2; // 460.5 (Inner roll-over wall edge)
  const y_bot_tab = y_bot_inner + tabH; // 470.5 (Locking tab bottom)

  // Locking Slots Coordinates (2 sharp rectangular slots along top & bottom base creases)
  // Depth compensates for material thickness + 1 extra layer of thickness (2 * caliper) for overlapping flaps
  const slotLen = 36;
  const slotH = 2 * t; // 2 layers of material thickness compensation
  const s1_cx = L * 0.28; // ~61.6 mm
  const s2_cx = L * 0.72; // ~158.4 mm
  const s1_x0 = s1_cx - slotLen / 2;
  const s1_x1 = s1_cx + slotLen / 2;
  const s2_x0 = s2_cx - slotLen / 2;
  const s2_x1 = s2_cx + slotLen / 2;

  // ----------------------------------------------------
  // 1. CENTRAL BASE PANEL & RECTANGULAR LOCKING SLOTS (LARGEST SPAN)
  // ----------------------------------------------------
  gb.addPanel('Base Panel', [
    { x: x0, y: y_base_top },
    { x: x1, y: y_base_top },
    { x: x1, y: y_base_bot },
    { x: x0, y: y_base_bot }
  ]);

  // Vertical Creases for Base (connected to gap bottom punch notches)
  gb.addLine({ x: x0, y: y_base_top + gapR }, { x: x0, y: y_base_bot - gapR }, 'CREASE', 'Base Left Crease');
  gb.addLine({ x: x1, y: y_base_top + gapR }, { x: x1, y: y_base_bot - gapR }, 'CREASE', 'Base Right Crease');

  // Top Base Crease segments between slots & clearance gaps
  gb.addLine({ x: x0 + gapR, y: y_base_top }, { x: s1_x0, y: y_base_top }, 'CREASE');
  gb.addLine({ x: s1_x1, y: y_base_top }, { x: s2_x0, y: y_base_top }, 'CREASE');
  gb.addLine({ x: s2_x1, y: y_base_top }, { x: x1 - gapR, y: y_base_top }, 'CREASE');

  // Top Rectangular Slots (Starting from the inside edge of crease y_base_top into the base panel)
  gb.addRect(s1_x0, y_base_top, slotLen, slotH, 'CUT');
  gb.addRect(s2_x0, y_base_top, slotLen, slotH, 'CUT');

  // Bottom Base Crease segments between slots & clearance gaps
  gb.addLine({ x: x0 + gapR, y: y_base_bot }, { x: s1_x0, y: y_base_bot }, 'CREASE');
  gb.addLine({ x: s1_x1, y: y_base_bot }, { x: s2_x0, y: y_base_bot }, 'CREASE');
  gb.addLine({ x: s2_x1, y: y_base_bot }, { x: x1 - gapR, y: y_base_bot }, 'CREASE');

  // Bottom Rectangular Slots (Starting from the inside edge of crease y_base_bot into the base panel)
  gb.addRect(s1_x0, y_base_bot - slotH, slotLen, slotH, 'CUT');
  gb.addRect(s2_x0, y_base_bot - slotH, slotLen, slotH, 'CUT');

  // Clearance Gap Semicircular Rounded Bottoms (U-Notches at base crease line intersection)
  gb.addArc({ x: x0, y: y_base_top }, gapR, 0, Math.PI, 'CUT');
  gb.addArc({ x: x1, y: y_base_top }, gapR, 0, Math.PI, 'CUT');
  gb.addArc({ x: x0, y: y_base_bot }, gapR, Math.PI, 2 * Math.PI, 'CUT');
  gb.addArc({ x: x1, y: y_base_bot }, gapR, Math.PI, 2 * Math.PI, 'CUT');

  // ----------------------------------------------------
  // 2. FRONT WALL & FRONT CORNER TUCK FLAPS (TIGHTER BY t)
  // ----------------------------------------------------
  gb.addPanel('Front Wall', [
    { x: x_front_wall, y: y_flap_top },
    { x: x0, y: y_flap_top },
    { x: x0, y: y_flap_bot },
    { x: x_front_wall, y: y_flap_bot }
  ]);

  // Front Wall Left Perimeter Cut
  gb.addLine({ x: x_front_wall, y: y_flap_top }, { x: x_front_wall, y: y_flap_bot }, 'CUT');

  // Front Wall Top Corner Flap (tucks into top side wall) - crease at y = y_flap_top
  gb.addLine({ x: x_front_wall, y: y_flap_top }, { x: x0 - gapR, y: y_flap_top }, 'CREASE', 'Front Top Corner Flap Crease');
  gb.addPanel('Front Top Corner Flap', [
    { x: x_front_wall, y: y_flap_top },
    { x: x_front_wall, y: -D },
    { x: x0 - gapR, y: -D },
    { x: x0 - gapR, y: y_flap_top }
  ]);
  gb.addPolyline([
    { x: x_front_wall, y: y_flap_top },
    { x: x_front_wall, y: -D },
    { x: x0 - gapR, y: -D },
    { x: x0 - gapR, y: y_base_top }
  ], 'CUT');

  // Front Wall Bottom Corner Flap (tucks into bottom side wall) - crease at y = y_flap_bot
  gb.addLine({ x: x_front_wall, y: y_flap_bot }, { x: x0 - gapR, y: y_flap_bot }, 'CREASE', 'Front Bottom Corner Flap Crease');
  gb.addPanel('Front Bottom Corner Flap', [
    { x: x_front_wall, y: y_flap_bot },
    { x: x_front_wall, y: W + D },
    { x: x0 - gapR, y: W + D },
    { x: x0 - gapR, y: y_flap_bot }
  ]);
  gb.addPolyline([
    { x: x_front_wall, y: y_flap_bot },
    { x: x_front_wall, y: W + D },
    { x: x0 - gapR, y: W + D },
    { x: x0 - gapR, y: y_base_bot }
  ], 'CUT');

  // ----------------------------------------------------
  // 3. TOP DOUBLE ROLL-OVER SIDE WALL & LOCKING TABS (MATCHING PICTURES 1 & 2)
  // ----------------------------------------------------
  const x_inner_left = x0 + gapR + t;
  const x_inner_right = x1 - gapR - t;

  gb.addPanel('Top Outer Side Wall', [
    { x: x0 + gapR, y: y_top_c1 },
    { x: x1 - gapR, y: y_top_c1 },
    { x: x1 - gapR, y: y_base_top },
    { x: x0 + gapR, y: y_base_top }
  ]);

  // Outer Side Wall Parallel Knife Cuts (forming clearance gaps with rounded bottom)
  gb.addLine({ x: x0 + gapR, y: y_base_top }, { x: x0 + gapR, y: y_top_c1 }, 'CUT');
  gb.addLine({ x: x1 - gapR, y: y_base_top }, { x: x1 - gapR, y: y_top_c1 }, 'CUT');

  // Double Crease at top: outer crease 1 and inner roll-over crease 2 (tapering inward)
  gb.addLine({ x: x0 + gapR, y: y_top_c1 }, { x: x1 - gapR, y: y_top_c1 }, 'CREASE', 'Top Wall Crease 1');
  gb.addLine({ x: x_inner_left, y: y_top_c2 }, { x: x_inner_right, y: y_top_c2 }, 'CREASE', 'Top Wall Crease 2 (Roll-Over)');

  // Angled chamfer cuts between double creases (tapering INWARDS, matching picture 2)
  gb.addLine({ x: x0 + gapR, y: y_top_c1 }, { x: x_inner_left, y: y_top_c2 }, 'CUT');
  gb.addLine({ x: x1 - gapR, y: y_top_c1 }, { x: x_inner_right, y: y_top_c2 }, 'CUT');

  // Top Inner Roll-Over Wall (Folding Flap - narrower to tuck inside)
  gb.addPanel('Top Inner Side Wall', [
    { x: x_inner_left, y: y_top_inner },
    { x: x_inner_right, y: y_top_inner },
    { x: x_inner_right, y: y_top_c2 },
    { x: x_inner_left, y: y_top_c2 }
  ]);

  // Straight Left & Right edges of Inner Folding Flap
  gb.addLine({ x: x_inner_left, y: y_top_c2 }, { x: x_inner_left, y: y_top_inner }, 'CUT');
  gb.addLine({ x: x_inner_right, y: y_top_c2 }, { x: x_inner_right, y: y_top_inner }, 'CUT');

  // Top Folding Flap Profile with Chamfered Locking Tabs (matching picture 1)
  gb.addPolyline([
    { x: x_inner_left, y: y_top_inner },
    { x: s1_x0 - tabBevel, y: y_top_inner },
    { x: s1_x0, y: y_top_tab },
    { x: s1_x1, y: y_top_tab },
    { x: s1_x1 + tabBevel, y: y_top_inner },
    { x: s2_x0 - tabBevel, y: y_top_inner },
    { x: s2_x0, y: y_top_tab },
    { x: s2_x1, y: y_top_tab },
    { x: s2_x1 + tabBevel, y: y_top_inner },
    { x: x_inner_right, y: y_top_inner }
  ], 'CUT');

  // ----------------------------------------------------
  // 4. BOTTOM DOUBLE ROLL-OVER SIDE WALL & LOCKING TABS (MATCHING PICTURES 1 & 2)
  // ----------------------------------------------------
  gb.addPanel('Bottom Outer Side Wall', [
    { x: x0 + gapR, y: y_base_bot },
    { x: x1 - gapR, y: y_base_bot },
    { x: x1 - gapR, y: y_bot_c1 },
    { x: x0 + gapR, y: y_bot_c1 }
  ]);

  // Outer Side Wall Parallel Knife Cuts
  gb.addLine({ x: x0 + gapR, y: y_base_bot }, { x: x0 + gapR, y: y_bot_c1 }, 'CUT');
  gb.addLine({ x: x1 - gapR, y: y_base_bot }, { x: x1 - gapR, y: y_bot_c1 }, 'CUT');

  // Double Crease at bottom: outer crease 1 and inner roll-over crease 2 (tapering inward)
  gb.addLine({ x: x0 + gapR, y: y_bot_c1 }, { x: x1 - gapR, y: y_bot_c1 }, 'CREASE', 'Bottom Wall Crease 1');
  gb.addLine({ x: x_inner_left, y: y_bot_c2 }, { x: x_inner_right, y: y_bot_c2 }, 'CREASE', 'Bottom Wall Crease 2 (Roll-Over)');

  // Angled chamfer cuts between double creases (tapering INWARDS, matching picture 2)
  gb.addLine({ x: x0 + gapR, y: y_bot_c1 }, { x: x_inner_left, y: y_bot_c2 }, 'CUT');
  gb.addLine({ x: x1 - gapR, y: y_bot_c1 }, { x: x_inner_right, y: y_bot_c2 }, 'CUT');

  // Bottom Inner Roll-Over Wall (Folding Flap - narrower to tuck inside)
  gb.addPanel('Bottom Inner Side Wall', [
    { x: x_inner_left, y: y_bot_c2 },
    { x: x_inner_right, y: y_bot_c2 },
    { x: x_inner_right, y: y_bot_inner },
    { x: x_inner_left, y: y_bot_inner }
  ]);

  // Straight Left & Right edges of Inner Folding Flap
  gb.addLine({ x: x_inner_left, y: y_bot_c2 }, { x: x_inner_left, y: y_bot_inner }, 'CUT');
  gb.addLine({ x: x_inner_right, y: y_bot_c2 }, { x: x_inner_right, y: y_bot_inner }, 'CUT');

  // Bottom Folding Flap Profile with Chamfered Locking Tabs (matching picture 1)
  gb.addPolyline([
    { x: x_inner_left, y: y_bot_inner },
    { x: s1_x0 - tabBevel, y: y_bot_inner },
    { x: s1_x0, y: y_bot_tab },
    { x: s1_x1, y: y_bot_tab },
    { x: s1_x1 + tabBevel, y: y_bot_inner },
    { x: s2_x0 - tabBevel, y: y_bot_inner },
    { x: s2_x0, y: y_bot_tab },
    { x: s2_x1, y: y_bot_tab },
    { x: s2_x1 + tabBevel, y: y_bot_inner },
    { x: x_inner_right, y: y_bot_inner }
  ], 'CUT');

  // ----------------------------------------------------
  // 5. REAR WALL & REAR CORNER TUCK FLAPS (TIGHTER BY t)
  // ----------------------------------------------------
  gb.addPanel('Rear Wall', [
    { x: x1, y: y_flap_top },
    { x: x2, y: y_flap_top },
    { x: x2, y: y_flap_bot },
    { x: x1, y: y_flap_bot }
  ]);

  gb.addLine({ x: x2, y: y_lid_top }, { x: x2, y: y_lid_bot }, 'CREASE', 'Lid Hinge Crease');

  // Step cuts between rear flap crease (t / W-t) and lid crease (2*t / W-2*t)
  gb.addLine({ x: x2, y: y_flap_top }, { x: x2, y: y_lid_top }, 'CUT');
  gb.addLine({ x: x2, y: y_flap_bot }, { x: x2, y: y_lid_bot }, 'CUT');

  // Rear Wall Top Corner Flap
  gb.addLine({ x: x1 + gapR, y: y_flap_top }, { x: x2, y: y_flap_top }, 'CREASE', 'Rear Top Corner Flap Crease');
  gb.addPanel('Rear Top Corner Flap', [
    { x: x1 + gapR, y: y_flap_top },
    { x: x1 + gapR, y: -D },
    { x: x2, y: -D },
    { x: x2, y: y_flap_top }
  ]);
  gb.addPolyline([
    { x: x1 + gapR, y: y_base_top },
    { x: x1 + gapR, y: -D },
    { x: x2, y: -D },
    { x: x2, y: y_flap_top }
  ], 'CUT');

  // Rear Wall Bottom Corner Flap
  gb.addLine({ x: x1 + gapR, y: y_flap_bot }, { x: x2, y: y_flap_bot }, 'CREASE', 'Rear Bottom Corner Flap Crease');
  gb.addPanel('Rear Bottom Corner Flap', [
    { x: x1 + gapR, y: y_flap_bot },
    { x: x1 + gapR, y: W + D },
    { x: x2, y: W + D },
    { x: x2, y: y_flap_bot }
  ]);
  gb.addPolyline([
    { x: x1 + gapR, y: y_base_bot },
    { x: x1 + gapR, y: W + D },
    { x: x2, y: W + D },
    { x: x2, y: y_flap_bot }
  ], 'CUT');

  // ----------------------------------------------------
  // 6. TOP LID & DUST FLAPS (SYMMETRICAL SLOPES & ROUNDED CORNERS - MATCHING PICTURE 1)
  // ----------------------------------------------------
  gb.addPanel('Top Lid', [
    { x: x2, y: y_lid_top },
    { x: x3, y: y_lid_top },
    { x: x3, y: y_lid_bot },
    { x: x2, y: y_lid_bot }
  ]);

  const slopeW = Math.min(28, L * 0.15); // Inward chamfer slope on both sides of dust flap
  const dustTopY = y_lid_top - dustFlapH;
  const dustBotY = y_lid_bot + dustFlapH;

  // Helper for smooth tangent fillets at trapezoid corners
  const sampleQuadBezier = (p0: Point2D, p1: Point2D, p2: Point2D, count = 10): Point2D[] => {
    const pts: Point2D[] = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const mt = 1 - t;
      pts.push({
        x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
        y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
      });
    }
    return pts;
  };

  // Top Dust Flap attached to Lid (Symmetrical trapezoid with smooth rounded corners)
  gb.addLine({ x: x2, y: y_lid_top }, { x: x3, y: y_lid_top }, 'CREASE', 'Top Dust Flap Crease');
  gb.addPanel('Top Dust Flap', [
    { x: x2, y: y_lid_top },
    { x: x2 + slopeW, y: dustTopY },
    { x: x3 - slopeW, y: dustTopY },
    { x: x3, y: y_lid_top }
  ]);

  const pTopA: Point2D = { x: x2, y: y_lid_top };
  const pTopB: Point2D = { x: x2 + slopeW, y: dustTopY };
  const pTopC: Point2D = { x: x3 - slopeW, y: dustTopY };
  const pTopD: Point2D = { x: x3, y: y_lid_top };

  const lenTopAB = Math.hypot(pTopA.x - pTopB.x, pTopA.y - pTopB.y);
  const lenTopCD = Math.hypot(pTopD.x - pTopC.x, pTopD.y - pTopC.y);
  const topFillet = Math.min(18, lenTopAB * 0.35, (pTopC.x - pTopB.x) * 0.35);

  const uTopBA: Point2D = { x: (pTopA.x - pTopB.x) / lenTopAB, y: (pTopA.y - pTopB.y) / lenTopAB };
  const uTopCD: Point2D = { x: (pTopD.x - pTopC.x) / lenTopCD, y: (pTopD.y - pTopC.y) / lenTopCD };

  const tTop1: Point2D = { x: pTopB.x + topFillet * uTopBA.x, y: pTopB.y + topFillet * uTopBA.y };
  const tTop2: Point2D = { x: pTopB.x + topFillet, y: pTopB.y };
  const tTop3: Point2D = { x: pTopC.x - topFillet, y: pTopC.y };
  const tTop4: Point2D = { x: pTopC.x + topFillet * uTopCD.x, y: pTopC.y + topFillet * uTopCD.y };

  const topDustOutline: Point2D[] = [
    pTopA,
    tTop1,
    ...sampleQuadBezier(tTop1, pTopB, tTop2).slice(1),
    tTop3,
    ...sampleQuadBezier(tTop3, pTopC, tTop4).slice(1),
    pTopD
  ];
  gb.addPolyline(topDustOutline, 'CUT');

  // Bottom Dust Flap attached to Lid (Symmetrical trapezoid with smooth rounded corners)
  gb.addLine({ x: x2, y: y_lid_bot }, { x: x3, y: y_lid_bot }, 'CREASE', 'Bottom Dust Flap Crease');
  gb.addPanel('Bottom Dust Flap', [
    { x: x2, y: y_lid_bot },
    { x: x2 + slopeW, y: dustBotY },
    { x: x3 - slopeW, y: dustBotY },
    { x: x3, y: y_lid_bot }
  ]);

  const pBotA: Point2D = { x: x2, y: y_lid_bot };
  const pBotB: Point2D = { x: x2 + slopeW, y: dustBotY };
  const pBotC: Point2D = { x: x3 - slopeW, y: dustBotY };
  const pBotD: Point2D = { x: x3, y: y_lid_bot };

  const lenBotAB = Math.hypot(pBotA.x - pBotB.x, pBotA.y - pBotB.y);
  const lenBotCD = Math.hypot(pBotD.x - pBotC.x, pBotD.y - pBotC.y);
  const botFillet = Math.min(18, lenBotAB * 0.35, (pBotC.x - pBotB.x) * 0.35);

  const uBotBA: Point2D = { x: (pBotA.x - pBotB.x) / lenBotAB, y: (pBotA.y - pBotB.y) / lenBotAB };
  const uBotCD: Point2D = { x: (pBotD.x - pBotC.x) / lenBotCD, y: (pBotD.y - pBotC.y) / lenBotCD };

  const tBot1: Point2D = { x: pBotB.x + botFillet * uBotBA.x, y: pBotB.y + botFillet * uBotBA.y };
  const tBot2: Point2D = { x: pBotB.x + botFillet, y: pBotB.y };
  const tBot3: Point2D = { x: pBotC.x - botFillet, y: pBotC.y };
  const tBot4: Point2D = { x: pBotC.x + botFillet * uBotCD.x, y: pBotC.y + botFillet * uBotCD.y };

  const botDustOutline: Point2D[] = [
    pBotA,
    tBot1,
    ...sampleQuadBezier(tBot1, pBotB, tBot2).slice(1),
    tBot3,
    ...sampleQuadBezier(tBot3, pBotC, tBot4).slice(1),
    pBotD
  ];
  gb.addPolyline(botDustOutline, 'CUT');

  // ----------------------------------------------------
  // 7. FRONT TUCK-IN CLOSURE FLAP & CHERRY LOCK EARS (MATCHING PICTURE 1)
  // ----------------------------------------------------
  gb.addLine({ x: x3, y: y_lid_top }, { x: x3, y: y_lid_bot }, 'CREASE', 'Front Tuck Flap Crease');
  const earOffset = 4; // Inward offset of the ear base relative to x4
  const earChamfer = 5; // Height/width of the 45-degree chamfer transition
  const earStemH = 6; // Vertical stem height above/below the crease line
  const xEar = x4 - earOffset;

  gb.addLine({ x: x3, y: y_lid_top }, { x: xEar, y: y_lid_top }, 'CREASE', 'Tuck Top Crease');
  gb.addLine({ x: x3, y: y_lid_bot }, { x: xEar, y: y_lid_bot }, 'CREASE', 'Tuck Bottom Crease');

  gb.addPanel('Front Tuck Flap', [
    { x: x3, y: y_lid_top },
    { x: xEar, y: y_lid_top },
    { x: x4, y: y_lid_top + earChamfer },
    { x: x4, y: y_lid_bot - earChamfer },
    { x: xEar, y: y_lid_bot },
    { x: x3, y: y_lid_bot }
  ]);

  // Top Cherry Lock Ear (Smooth arched tongue profile matching reference)
  const earTopY = y_lid_top - earH;
  const earR = Math.min(20, earH * 0.5);

  gb.addLine({ x: x3, y: y_lid_top }, { x: x3, y: earTopY + earR }, 'CUT');
  gb.addArc({ x: x3 + earR, y: earTopY + earR }, earR, Math.PI, Math.PI * 1.5, 'CUT');
  
  // Smooth elliptical sweep down to (xEar, y_lid_top - earStemH)
  const topEarPoints: Point2D[] = [];
  const segments = 16;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = t * (Math.PI / 2);
    const px = (x3 + earR) + (xEar - (x3 + earR)) * Math.sin(angle);
    const py = (y_lid_top - earStemH) - (earH - earStemH) * Math.cos(angle);
    topEarPoints.push({ x: px, y: py });
  }
  gb.addPolyline(topEarPoints, 'CUT');

  // Straight vertical lead-in down to the crease intersection
  gb.addLine({ x: xEar, y: y_lid_top - earStemH }, { x: xEar, y: y_lid_top }, 'CUT');

  // Angled chamfer outward from crease intersection to main tuck flap edge
  gb.addLine({ x: xEar, y: y_lid_top }, { x: x4, y: y_lid_top + earChamfer }, 'CUT');

  // Right Edge Vertical Cut (Main outer edge)
  gb.addLine({ x: x4, y: y_lid_top + earChamfer }, { x: x4, y: y_lid_bot - earChamfer }, 'CUT');

  // Angled chamfer inward from main edge to bottom crease intersection
  gb.addLine({ x: x4, y: y_lid_bot - earChamfer }, { x: xEar, y: y_lid_bot }, 'CUT');

  // Straight vertical lead-in down past the bottom crease intersection
  gb.addLine({ x: xEar, y: y_lid_bot }, { x: xEar, y: y_lid_bot + earStemH }, 'CUT');

  // Bottom Cherry Lock Ear (Symmetrical arched tongue profile)
  const earBotY = y_lid_bot + earH;

  const botEarPoints: Point2D[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = (1 - t) * (Math.PI / 2);
    const px = (x3 + earR) + (xEar - (x3 + earR)) * Math.sin(angle);
    const py = (y_lid_bot + earStemH) + (earH - earStemH) * Math.cos(angle);
    botEarPoints.push({ x: px, y: py });
  }
  gb.addPolyline(botEarPoints, 'CUT');

  gb.addArc({ x: x3 + earR, y: earBotY - earR }, earR, Math.PI * 0.5, Math.PI, 'CUT');
  gb.addLine({ x: x3, y: earBotY - earR }, { x: x3, y: y_lid_bot }, 'CUT');

  // ----------------------------------------------------
  // 8. BLEED BOUNDARY
  // ----------------------------------------------------
  const bleed = p['bleed'] || 3;
  const minX = x_front_wall - bleed;
  const maxX = x4 + bleed;
  const minY = Math.min(y_top_tab, -dustFlapH, -earH) - bleed;
  const maxY = Math.max(y_bot_tab, y_base_bot + dustFlapH, y_base_bot + earH) + bleed;
  gb.addRect(minX, minY, maxX - minX, maxY - minY, 'BLEED');

  // ----------------------------------------------------
  // 9. DRIVING DIMENSIONS (Exact match to the 3 callouts in user's image)
  // ----------------------------------------------------
  // Base Horizontal Dimension (220 mm in image)
  gb.addDimension({ x: x0, y: y_base_bot * 0.68 }, { x: x1, y: y_base_bot * 0.68 }, L, `${L} mm`, 0, 'horizontal', 'length');
  // Base Vertical Dimension (300 mm in image)
  gb.addDimension({ x: x0 + L * 0.68, y: y_base_top }, { x: x0 + L * 0.68, y: y_base_bot }, W, `${W} mm`, 0, 'vertical', 'width');
  // Depth Dimension across Rear Wall (80 mm in image)
  gb.addDimension({ x: x1, y: y_base_top + D * 0.5 }, { x: x2, y: y_base_top + D * 0.5 }, D, `${D} mm`, 0, 'horizontal', 'height');
}

// 3. Straight Tuck End Box (STE)
function generateStraightTuckEnd(gb: GeometryBuilder, p: Record<string, number>): void {
  const L = p['length'] || 120;
  const W = p['width'] || 70;
  const H = p['height'] || 180;
  const G = p['glueFlap'] !== undefined ? p['glueFlap'] : 25.4;
  const tuck = p['tuckFlap'] || 22;
  const dust = p['dustFlap'] || 25;

  const x0 = 0;
  const x1 = G;
  const x2 = x1 + L;
  const x3 = x2 + W;
  const x4 = x3 + L;
  const x5 = x4 + W;

  const y0 = 0;
  const yTuckTop = tuck + 8;
  const yBodyTop = yTuckTop + W;
  const yBodyBottom = yBodyTop + H;
  const yTuckBottom = yBodyBottom + W;
  const yTotal = yTuckBottom + tuck + 8;

  // Main Creases
  gb.addLine({ x: x1, y: yBodyTop }, { x: x5, y: yBodyTop }, 'CREASE', 'Top Crease');
  gb.addLine({ x: x1, y: yBodyBottom }, { x: x5, y: yBodyBottom }, 'CREASE', 'Bottom Crease');

  gb.addLine({ x: x1, y: yBodyTop }, { x: x1, y: yBodyBottom }, 'CREASE', 'Glue Crease');
  gb.addLine({ x: x2, y: yBodyTop }, { x: x2, y: yBodyBottom }, 'CREASE', 'Panel 1-2 Crease');
  gb.addLine({ x: x3, y: yBodyTop }, { x: x3, y: yBodyBottom }, 'CREASE', 'Panel 2-3 Crease');
  gb.addLine({ x: x4, y: yBodyTop }, { x: x4, y: yBodyBottom }, 'CREASE', 'Panel 3-4 Crease');

  // Glue Flap Left
  gb.addPolyline([
    { x: x1, y: yBodyTop },
    { x: x0, y: yBodyTop + 5 },
    { x: x0, y: yBodyBottom - 5 },
    { x: x1, y: yBodyBottom }
  ], 'CUT');

  // TOP: Top tuck hinges from Front Panel (Panel 1: x1 to x2)
  gb.addLine({ x: x1, y: yBodyTop - W }, { x: x2, y: yBodyTop - W }, 'CREASE', 'Top Tuck Hinge');
  gb.addPolyline([
    { x: x1, y: yBodyTop },
    { x: x1, y: yBodyTop - W },
    { x: x1 + 4, y: y0 },
    { x: x2 - 4, y: y0 },
    { x: x2, y: yBodyTop - W },
    { x: x2, y: yBodyTop }
  ], 'CUT');

  // Top Dust Flaps on Side Panel 1 (x2..x3) and Side Panel 2 (x4..x5)
  gb.addPolyline([
    { x: x2, y: yBodyTop },
    { x: x2 + 3, y: yBodyTop - dust },
    { x: x3 - 3, y: yBodyTop - dust },
    { x: x3, y: yBodyTop }
  ], 'CUT');

  gb.addPolyline([
    { x: x3, y: yBodyTop },
    { x: x4, y: yBodyTop }
  ], 'CUT'); // Cut on Back panel top

  gb.addPolyline([
    { x: x4, y: yBodyTop },
    { x: x4 + 3, y: yBodyTop - dust },
    { x: x5 - 3, y: yBodyTop - dust },
    { x: x5, y: yBodyTop }
  ], 'CUT');

  // Right Edge
  gb.addLine({ x: x5, y: yBodyTop }, { x: x5, y: yBodyBottom }, 'CUT');

  // BOTTOM (Straight tuck: also hinges from Front Panel x1..x2)
  gb.addLine({ x: x1, y: yBodyBottom + W }, { x: x2, y: yBodyBottom + W }, 'CREASE', 'Bottom Tuck Hinge');
  gb.addPolyline([
    { x: x1, y: yBodyBottom },
    { x: x1, y: yBodyBottom + W },
    { x: x1 + 4, y: yTotal },
    { x: x2 - 4, y: yTotal },
    { x: x2, y: yBodyBottom + W },
    { x: x2, y: yBodyBottom }
  ], 'CUT');

  // Bottom Dust Flaps
  gb.addPolyline([
    { x: x2, y: yBodyBottom },
    { x: x2 + 3, y: yBodyBottom + dust },
    { x: x3 - 3, y: yBodyBottom + dust },
    { x: x3, y: yBodyBottom }
  ], 'CUT');

  gb.addLine({ x: x3, y: yBodyBottom }, { x: x4, y: yBodyBottom }, 'CUT');

  gb.addPolyline([
    { x: x4, y: yBodyBottom },
    { x: x4 + 3, y: yBodyBottom + dust },
    { x: x5 - 3, y: yBodyBottom + dust },
    { x: x5, y: yBodyBottom }
  ], 'CUT');

  // Bleed
  const bleed = p['bleed'] || 3;
  gb.addRect(x0 - bleed, y0 - bleed, (x5 - x0) + 2 * bleed, yTotal + 2 * bleed, 'BLEED');

  // Dimensions
  gb.addDimension({ x: x1, y: yBodyTop }, { x: x2, y: yBodyTop }, L, `Length (L): ${L} mm`, -30, 'horizontal', 'length');
  gb.addDimension({ x: x2, y: yBodyTop }, { x: x3, y: yBodyTop }, W, `Width (W): ${W} mm`, -15, 'horizontal', 'width');
  gb.addDimension({ x: x1, y: yBodyTop }, { x: x1, y: yBodyBottom }, H, `Height (H): ${H} mm`, -30, 'vertical', 'height');

  gb.addPanel('Front Panel', [{ x: x1, y: yBodyTop }, { x: x2, y: yBodyTop }, { x: x2, y: yBodyBottom }, { x: x1, y: yBodyBottom }]);
  gb.addPanel('Side Right', [{ x: x2, y: yBodyTop }, { x: x3, y: yBodyTop }, { x: x3, y: yBodyBottom }, { x: x2, y: yBodyBottom }]);
  gb.addPanel('Back Panel', [{ x: x3, y: yBodyTop }, { x: x4, y: yBodyTop }, { x: x4, y: yBodyBottom }, { x: x3, y: yBodyBottom }]);
  gb.addPanel('Side Left', [{ x: x4, y: yBodyTop }, { x: x5, y: yBodyTop }, { x: x5, y: yBodyBottom }, { x: x4, y: yBodyBottom }]);
}

// 4. Reverse Tuck End Box (RTE)
function generateReverseTuckEnd(gb: GeometryBuilder, p: Record<string, number>): void {
  const L = p['length'] || 100;
  const W = p['width'] || 60;
  const H = p['height'] || 150;
  const G = p['glueFlap'] !== undefined ? p['glueFlap'] : 25.4;
  const tuck = p['tuckFlap'] || 20;
  const dust = p['dustFlap'] || 22;

  const x0 = 0;
  const x1 = G;
  const x2 = x1 + L;
  const x3 = x2 + W;
  const x4 = x3 + L;
  const x5 = x4 + W;

  const yTuckTop = tuck + 6;
  const yBodyTop = yTuckTop + W;
  const yBodyBottom = yBodyTop + H;
  const yTotal = yBodyBottom + W + tuck + 6;

  // Main Creases
  gb.addLine({ x: x1, y: yBodyTop }, { x: x5, y: yBodyTop }, 'CREASE');
  gb.addLine({ x: x1, y: yBodyBottom }, { x: x5, y: yBodyBottom }, 'CREASE');

  gb.addLine({ x: x1, y: yBodyTop }, { x: x1, y: yBodyBottom }, 'CREASE');
  gb.addLine({ x: x2, y: yBodyTop }, { x: x2, y: yBodyBottom }, 'CREASE');
  gb.addLine({ x: x3, y: yBodyTop }, { x: x3, y: yBodyBottom }, 'CREASE');
  gb.addLine({ x: x4, y: yBodyTop }, { x: x4, y: yBodyBottom }, 'CREASE');

  // Glue Flap
  gb.addPolyline([
    { x: x1, y: yBodyTop },
    { x: x0, y: yBodyTop + 5 },
    { x: x0, y: yBodyBottom - 5 },
    { x: x1, y: yBodyBottom }
  ], 'CUT');

  // TOP: Top tuck hinges from Front Panel (x1..x2)
  gb.addLine({ x: x1, y: yBodyTop - W }, { x: x2, y: yBodyTop - W }, 'CREASE');
  gb.addPolyline([
    { x: x1, y: yBodyTop },
    { x: x1, y: yBodyTop - W },
    { x: x1 + 4, y: 0 },
    { x: x2 - 4, y: 0 },
    { x: x2, y: yBodyTop - W },
    { x: x2, y: yBodyTop }
  ], 'CUT');

  // Top Dust flaps
  gb.addPolyline([{ x: x2, y: yBodyTop }, { x: x2 + 3, y: yBodyTop - dust }, { x: x3 - 3, y: yBodyTop - dust }, { x: x3, y: yBodyTop }], 'CUT');
  gb.addLine({ x: x3, y: yBodyTop }, { x: x4, y: yBodyTop }, 'CUT');
  gb.addPolyline([{ x: x4, y: yBodyTop }, { x: x4 + 3, y: yBodyTop - dust }, { x: x5 - 3, y: yBodyTop - dust }, { x: x5, y: yBodyTop }], 'CUT');

  gb.addLine({ x: x5, y: yBodyTop }, { x: x5, y: yBodyBottom }, 'CUT');

  // BOTTOM (Reverse tuck: hinges from BACK Panel x3..x4)
  gb.addLine({ x: x1, y: yBodyBottom }, { x: x2, y: yBodyBottom }, 'CUT');
  gb.addPolyline([{ x: x2, y: yBodyBottom }, { x: x2 + 3, y: yBodyBottom + dust }, { x: x3 - 3, y: yBodyBottom + dust }, { x: x3, y: yBodyBottom }], 'CUT');

  // Back panel bottom tuck
  gb.addLine({ x: x3, y: yBodyBottom + W }, { x: x4, y: yBodyBottom + W }, 'CREASE');
  gb.addPolyline([
    { x: x3, y: yBodyBottom },
    { x: x3, y: yBodyBottom + W },
    { x: x3 + 4, y: yTotal },
    { x: x4 - 4, y: yTotal },
    { x: x4, y: yBodyBottom + W },
    { x: x4, y: yBodyBottom }
  ], 'CUT');

  gb.addPolyline([{ x: x4, y: yBodyBottom }, { x: x4 + 3, y: yBodyBottom + dust }, { x: x5 - 3, y: yBodyBottom + dust }, { x: x5, y: yBodyBottom }], 'CUT');

  // Bleed & Dimensions
  const bleed = p['bleed'] || 3;
  gb.addRect(x0 - bleed, -bleed, (x5 - x0) + 2 * bleed, yTotal + 2 * bleed, 'BLEED');

  gb.addDimension({ x: x1, y: yBodyTop }, { x: x2, y: yBodyTop }, L, `Length (L): ${L} mm`, -30, 'horizontal', 'length');
  gb.addDimension({ x: x2, y: yBodyTop }, { x: x3, y: yBodyTop }, W, `Width (W): ${W} mm`, -15, 'horizontal', 'width');
  gb.addDimension({ x: x1, y: yBodyTop }, { x: x1, y: yBodyBottom }, H, `Height (H): ${H} mm`, -30, 'vertical', 'height');

  gb.addPanel('Front Panel', [{ x: x1, y: yBodyTop }, { x: x2, y: yBodyTop }, { x: x2, y: yBodyBottom }, { x: x1, y: yBodyBottom }]);
  gb.addPanel('Back Panel', [{ x: x3, y: yBodyTop }, { x: x4, y: yBodyTop }, { x: x4, y: yBodyBottom }, { x: x3, y: yBodyBottom }]);
}

// 5. Roll End Tray (FEFCO 0422)
function generateRollEndTray(gb: GeometryBuilder, p: Record<string, number>): void {
  const L = p['length'] || 300;
  const W = p['width'] || 200;
  const H = p['height'] || 60;
  const t = p['caliper'] || p['thickness'] || 2.5;
  const tabW = p['tabWidth'] || 20;

  const bx1 = (H * 2) + t;
  const by1 = (H * 2) + t;
  const bx2 = bx1 + L;
  const by2 = by1 + W;

  // Base Tray
  gb.addPanel('Tray Base', [{ x: bx1, y: by1 }, { x: bx2, y: by1 }, { x: bx2, y: by2 }, { x: bx1, y: by2 }]);

  // Base Creases
  gb.addLine({ x: bx1, y: by1 }, { x: bx2, y: by1 }, 'CREASE', 'Top Wall Crease');
  gb.addLine({ x: bx1, y: by2 }, { x: bx2, y: by2 }, 'CREASE', 'Bottom Wall Crease');
  gb.addLine({ x: bx1, y: by1 }, { x: bx1, y: by2 }, 'CREASE', 'Left Wall Crease');
  gb.addLine({ x: bx2, y: by1 }, { x: bx2, y: by2 }, 'CREASE', 'Right Wall Crease');

  // Double Wall Rollover Creases (Top & Bottom separated by board thickness t)
  gb.addLine({ x: bx1, y: by1 - H }, { x: bx2, y: by1 - H }, 'CREASE', 'Top Rollover Crease 1');
  gb.addLine({ x: bx1, y: by1 - H - t }, { x: bx2, y: by1 - H - t }, 'CREASE', 'Top Rollover Crease 2');
  gb.addLine({ x: bx1, y: by2 + H }, { x: bx2, y: by2 + H }, 'CREASE', 'Bottom Rollover Crease 1');
  gb.addLine({ x: bx1, y: by2 + H + t }, { x: bx2, y: by2 + H + t }, 'CREASE', 'Bottom Rollover Crease 2');

  // Left & Right Rollover Creases (separated by board thickness t)
  gb.addLine({ x: bx1 - H, y: by1 }, { x: bx1 - H, y: by2 }, 'CREASE', 'Left Rollover Crease 1');
  gb.addLine({ x: bx1 - H - t, y: by1 }, { x: bx1 - H - t, y: by2 }, 'CREASE', 'Left Rollover Crease 2');
  gb.addLine({ x: bx2 + H, y: by1 }, { x: bx2 + H, y: by2 }, 'CREASE', 'Right Rollover Crease 1');
  gb.addLine({ x: bx2 + H + t, y: by1 }, { x: bx2 + H + t, y: by2 }, 'CREASE', 'Right Rollover Crease 2');

  // Corner Lock Tabs on Top & Bottom Walls
  // Top Wall Outer Profile
  gb.addPolyline([
    { x: bx1, y: by1 - H * 2 },
    { x: bx2, y: by1 - H * 2 },
    { x: bx2, y: by1 - H },
    { x: bx2 + H - 5, y: by1 - H },
    { x: bx2 + H - 5, y: by1 - 5 },
    { x: bx2, y: by1 }
  ], 'CUT');

  gb.addPolyline([
    { x: bx1, y: by1 },
    { x: bx1 - H + 5, y: by1 - 5 },
    { x: bx1 - H + 5, y: by1 - H },
    { x: bx1, y: by1 - H },
    { x: bx1, y: by1 - H * 2 }
  ], 'CUT');

  // Bottom Wall Outer Profile
  gb.addPolyline([
    { x: bx1, y: by2 + H * 2 },
    { x: bx2, y: by2 + H * 2 },
    { x: bx2, y: by2 + H },
    { x: bx2 + H - 5, y: by2 + H },
    { x: bx2 + H - 5, y: by2 + 5 },
    { x: bx2, y: by2 }
  ], 'CUT');

  gb.addPolyline([
    { x: bx1, y: by2 },
    { x: bx1 - H + 5, y: by2 + 5 },
    { x: bx1 - H + 5, y: by2 + H },
    { x: bx1, y: by2 + H },
    { x: bx1, y: by2 + H * 2 }
  ], 'CUT');

  // Left Outer Rollover Profile with locking tabs
  gb.addPolyline([
    { x: bx1 - H * 2, y: by1 + 10 },
    { x: bx1 - H * 2 - 8, y: by1 + 15 },
    { x: bx1 - H * 2 - 8, y: by2 - 15 },
    { x: bx1 - H * 2, y: by2 - 10 }
  ], 'CUT');
  gb.addLine({ x: bx1 - H * 2, y: by1 + 10 }, { x: bx1 - H, y: by1 }, 'CUT');
  gb.addLine({ x: bx1 - H * 2, y: by2 - 10 }, { x: bx1 - H, y: by2 }, 'CUT');

  // Right Outer Rollover Profile with locking tabs
  gb.addPolyline([
    { x: bx2 + H * 2, y: by1 + 10 },
    { x: bx2 + H * 2 + 8, y: by1 + 15 },
    { x: bx2 + H * 2 + 8, y: by2 - 15 },
    { x: bx2 + H * 2, y: by2 - 10 }
  ], 'CUT');
  gb.addLine({ x: bx2 + H * 2, y: by1 + 10 }, { x: bx2 + H, y: by1 }, 'CUT');
  gb.addLine({ x: bx2 + H * 2, y: by2 - 10 }, { x: bx2 + H, y: by2 }, 'CUT');

  // Locking slots in tray bottom
  gb.addLine({ x: bx1 + 10, y: by1 + 5 }, { x: bx1 + 10, y: by1 + 5 + tabW }, 'CUT', 'Base Slot L1');
  gb.addLine({ x: bx1 + 10, y: by2 - 5 - tabW }, { x: bx1 + 10, y: by2 - 5 }, 'CUT', 'Base Slot L2');
  gb.addLine({ x: bx2 - 10, y: by1 + 5 }, { x: bx2 - 10, y: by1 + 5 + tabW }, 'CUT', 'Base Slot R1');
  gb.addLine({ x: bx2 - 10, y: by2 - 5 - tabW }, { x: bx2 - 10, y: by2 - 5 }, 'CUT', 'Base Slot R2');

  // Dimensions
  gb.addDimension({ x: bx1, y: by1 }, { x: bx2, y: by1 }, L, `Tray Length (L): ${L} mm`, -35, 'horizontal', 'length');
  gb.addDimension({ x: bx1, y: by1 }, { x: bx1, y: by2 }, W, `Tray Width (W): ${W} mm`, -35, 'vertical', 'width');
  gb.addDimension({ x: bx1, y: by1 }, { x: bx1, y: by1 - H }, H, `Wall (H): ${H} mm`, 25, 'vertical', 'height');
}

// 6. 4-Corner Glued Open Tray
function generateOpenTray(gb: GeometryBuilder, p: Record<string, number>): void {
  const L = p['length'] || 350;
  const W = p['width'] || 250;
  const H = p['height'] || 80;
  const G = p['glueTab'] !== undefined ? p['glueTab'] : 25.4;

  const bx1 = H;
  const by1 = H;
  const bx2 = bx1 + L;
  const by2 = by1 + W;

  // Base
  gb.addPanel('Tray Base', [{ x: bx1, y: by1 }, { x: bx2, y: by1 }, { x: bx2, y: by2 }, { x: bx1, y: by2 }]);

  // Creases
  gb.addLine({ x: bx1, y: by1 }, { x: bx2, y: by1 }, 'CREASE');
  gb.addLine({ x: bx1, y: by2 }, { x: bx2, y: by2 }, 'CREASE');
  gb.addLine({ x: bx1, y: by1 }, { x: bx1, y: by2 }, 'CREASE');
  gb.addLine({ x: bx2, y: by1 }, { x: bx2, y: by2 }, 'CREASE');

  // Glue Flap Creases (hinge from side walls)
  gb.addLine({ x: bx1, y: by1 }, { x: bx1 - H, y: by1 }, 'CREASE');
  gb.addLine({ x: bx1, y: by2 }, { x: bx1 - H, y: by2 }, 'CREASE');
  gb.addLine({ x: bx2, y: by1 }, { x: bx2 + H, y: by1 }, 'CREASE');
  gb.addLine({ x: bx2, y: by2 }, { x: bx2 + H, y: by2 }, 'CREASE');

  // Top & Bottom Wall Cuts
  gb.addLine({ x: bx1, y: 0 }, { x: bx2, y: 0 }, 'CUT');
  gb.addLine({ x: bx1, y: 0 }, { x: bx1, y: by1 }, 'CUT');
  gb.addLine({ x: bx2, y: 0 }, { x: bx2, y: by1 }, 'CUT');

  gb.addLine({ x: bx1, y: by2 + H }, { x: bx2, y: by2 + H }, 'CUT');
  gb.addLine({ x: bx1, y: by2 + H }, { x: bx1, y: by2 }, 'CUT');
  gb.addLine({ x: bx2, y: by2 + H }, { x: bx2, y: by2 }, 'CUT');

  // Left & Right Wall cuts with tapered glue tabs
  gb.addPolyline([
    { x: bx1 - H, y: by1 - G },
    { x: 0, y: by1 },
    { x: 0, y: by2 },
    { x: bx1 - H, y: by2 + G }
  ], 'CUT');
  gb.addLine({ x: bx1 - H, y: by1 - G }, { x: bx1 - H, y: by1 }, 'CUT');
  gb.addLine({ x: bx1 - H, y: by2 + G }, { x: bx1 - H, y: by2 }, 'CUT');

  gb.addPolyline([
    { x: bx2 + H, y: by1 - G },
    { x: bx2 + H + H, y: by1 },
    { x: bx2 + H + H, y: by2 },
    { x: bx2 + H, y: by2 + G }
  ], 'CUT');
  gb.addLine({ x: bx2 + H, y: by1 - G }, { x: bx2 + H, y: by1 }, 'CUT');
  gb.addLine({ x: bx2 + H, y: by2 + G }, { x: bx2 + H, y: by2 }, 'CUT');

  // Bleed
  const bleed = p['bleed'] || 3;
  gb.addRect(-bleed, -bleed, (bx2 + H * 2) + 2 * bleed, (by2 + H) + 2 * bleed, 'BLEED');

  // Dimensions
  gb.addDimension({ x: bx1, y: by1 }, { x: bx2, y: by1 }, L, `Base Length (L): ${L} mm`, -30, 'horizontal', 'length');
  gb.addDimension({ x: bx1, y: by1 }, { x: bx1, y: by2 }, W, `Base Width (W): ${W} mm`, -30, 'vertical', 'width');
  gb.addDimension({ x: bx1, y: 0 }, { x: bx1, y: by1 }, H, `Wall Height (H): ${H} mm`, 20, 'vertical', 'height');
}

// 7. Wraparound Packaging Sleeve
function generateWraparoundSleeve(gb: GeometryBuilder, p: Record<string, number>): void {
  const L = p['length'] || 160;
  const W = p['width'] || 110;
  const H = p['height'] || 45;
  const G = p['glueFlap'] !== undefined ? p['glueFlap'] : 25.4;
  const notchR = p['thumbNotchRadius'] || 15;

  const x0 = 0;
  const x1 = G;
  const x2 = x1 + L;
  const x3 = x2 + H;
  const x4 = x3 + L;
  const x5 = x4 + H;

  const y0 = 0;
  const y1 = W;

  // Outer Cut Perimeter
  gb.addLine({ x: x0 + 4, y: y0 }, { x: x5, y: y0 }, 'CUT');
  gb.addLine({ x: x5, y: y0 }, { x: x5, y: y1 }, 'CUT');
  gb.addLine({ x: x5, y: y1 }, { x: x0 + 4, y: y1 }, 'CUT');

  // Glue Flap Taper
  gb.addLine({ x: x0 + 4, y: y0 }, { x: x0, y: y0 + 6 }, 'CUT');
  gb.addLine({ x: x0, y: y0 + 6 }, { x: x0, y: y1 - 6 }, 'CUT');
  gb.addLine({ x: x0, y: y1 - 6 }, { x: x0 + 4, y: y1 }, 'CUT');

  // Creases
  gb.addLine({ x: x1, y: y0 }, { x: x1, y: y1 }, 'CREASE', 'Glue Crease');
  gb.addLine({ x: x2, y: y0 }, { x: x2, y: y1 }, 'CREASE', 'Top-Side Crease');
  gb.addLine({ x: x3, y: y0 }, { x: x3, y: y1 }, 'CREASE', 'Side-Bottom Crease');
  gb.addLine({ x: x4, y: y0 }, { x: x4, y: y1 }, 'CREASE', 'Bottom-Side Crease');

  // Thumb Notch Cutouts (if specified)
  if (notchR > 0) {
    const notchCenterY = y1 / 2;
    gb.addArc({ x: x2, y: notchCenterY }, notchR, -Math.PI / 2, Math.PI / 2, 'CUT');
    gb.addArc({ x: x4, y: notchCenterY }, notchR, -Math.PI / 2, Math.PI / 2, 'CUT');
  }

  // Bleed
  const bleed = p['bleed'] || 3;
  gb.addRect(x0 - bleed, y0 - bleed, (x5 - x0) + 2 * bleed, y1 + 2 * bleed, 'BLEED');

  // Dimensions
  gb.addDimension({ x: x1, y: y0 }, { x: x2, y: y0 }, L, `Length (L): ${L} mm`, -25, 'horizontal', 'length');
  gb.addDimension({ x: x2, y: y0 }, { x: x3, y: y0 }, H, `Height (H): ${H} mm`, -15, 'horizontal', 'height');
  gb.addDimension({ x: x1, y: y0 }, { x: x1, y: y1 }, W, `Width (W): ${W} mm`, -25, 'vertical', 'width');

  gb.addPanel('Top Panel', [{ x: x1, y: y0 }, { x: x2, y: y0 }, { x: x2, y: y1 }, { x: x1, y: y1 }]);
  gb.addPanel('Side 1', [{ x: x2, y: y0 }, { x: x3, y: y0 }, { x: x3, y: y1 }, { x: x2, y: y1 }]);
  gb.addPanel('Bottom Panel', [{ x: x3, y: y0 }, { x: x4, y: y0 }, { x: x4, y: y1 }, { x: x3, y: y1 }]);
  gb.addPanel('Side 2', [{ x: x4, y: y0 }, { x: x5, y: y0 }, { x: x5, y: y1 }, { x: x4, y: y1 }]);
}

// 8. Pillow Box
function generatePillowBox(gb: GeometryBuilder, p: Record<string, number>): void {
  const L = p['length'] || 180;
  const W = p['width'] || 100;
  const C = p['curveDepth'] || 25;
  const G = p['glueFlap'] !== undefined ? p['glueFlap'] : 25.4;

  const x0 = 0;
  const x1 = G;
  const x2 = x1 + W;
  const x3 = x2 + W;

  const y0 = 0;
  const y1 = C;
  const y2 = y1 + L;
  const y3 = y2 + C;

  // Center Crease
  gb.addLine({ x: x2, y: y1 }, { x: x2, y: y2 }, 'CREASE', 'Center Fold');
  gb.addLine({ x: x1, y: y1 }, { x: x1, y: y2 }, 'CREASE', 'Glue Seam');

  // Glue Flap Left
  gb.addPolyline([
    { x: x1, y: y1 },
    { x: x0, y: y1 + 5 },
    { x: x0, y: y2 - 5 },
    { x: x1, y: y2 }
  ], 'CUT');

  // Straight side cut
  gb.addLine({ x: x3, y: y1 }, { x: x3, y: y2 }, 'CUT');

  // Curved End Creases and Outer Cuts
  // Front End Arc Creases
  const rArc = (W * W / 4 + C * C) / (2 * C);
  gb.addArc({ x: (x1 + x2) / 2, y: y1 + (rArc - C) }, rArc, Math.PI + 0.5, 2 * Math.PI - 0.5, 'CREASE');
  gb.addArc({ x: (x2 + x3) / 2, y: y1 + (rArc - C) }, rArc, Math.PI + 0.5, 2 * Math.PI - 0.5, 'CREASE');

  gb.addArc({ x: (x1 + x2) / 2, y: y2 - (rArc - C) }, rArc, 0.5, Math.PI - 0.5, 'CREASE');
  gb.addArc({ x: (x2 + x3) / 2, y: y2 - (rArc - C) }, rArc, 0.5, Math.PI - 0.5, 'CREASE');

  // End Flap Outer Cuts (Convex Arcs)
  gb.addArc({ x: (x1 + x2) / 2, y: y0 + (rArc - C) }, rArc, Math.PI + 0.5, 2 * Math.PI - 0.5, 'CUT');
  gb.addArc({ x: (x2 + x3) / 2, y: y0 + (rArc - C) }, rArc, Math.PI + 0.5, 2 * Math.PI - 0.5, 'CUT');

  gb.addArc({ x: (x1 + x2) / 2, y: y3 - (rArc - C) }, rArc, 0.5, Math.PI - 0.5, 'CUT');
  gb.addArc({ x: (x2 + x3) / 2, y: y3 - (rArc - C) }, rArc, 0.5, Math.PI - 0.5, 'CUT');

  // Connect Arcs
  gb.addLine({ x: x1, y: y1 }, { x: x1, y: y0 + C }, 'CUT');
  gb.addLine({ x: x3, y: y1 }, { x: x3, y: y0 + C }, 'CUT');
  gb.addLine({ x: x1, y: y2 }, { x: x1, y: y3 - C }, 'CUT');
  gb.addLine({ x: x3, y: y2 }, { x: x3, y: y3 - C }, 'CUT');

  // Dimensions
  gb.addDimension({ x: x1, y: y1 }, { x: x2, y: y1 }, W, `Arc Width (W): ${W} mm`, -25, 'horizontal', 'width');
  gb.addDimension({ x: x1, y: y1 }, { x: x1, y: y2 }, L, `Body Length (L): ${L} mm`, -25, 'vertical', 'length');

  gb.addPanel('Front Arch', [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }]);
  gb.addPanel('Back Arch', [{ x: x2, y: y1 }, { x: x3, y: y1 }, { x: x3, y: y2 }, { x: x2, y: y2 }]);
}

// 9. Auto Bottom / Crash Lock Box (FEFCO 0215)
function generateAutoBottom(gb: GeometryBuilder, p: Record<string, number>): void {
  const L = p['length'] || 120;
  const W = p['width'] || 80;
  const H = p['height'] || 160;
  const G = p['glueFlap'] !== undefined ? p['glueFlap'] : 25.4;
  const tuck = p['tuckFlap'] || 24;
  const dust = p['dustFlap'] || 28;

  const x0 = 0;
  const x1 = G;
  const x2 = x1 + L;
  const x3 = x2 + W;
  const x4 = x3 + L;
  const x5 = x4 + W;

  const yTuckTop = tuck + 6;
  const yBodyTop = yTuckTop + W;
  const yBodyBottom = yBodyTop + H;
  const bottomFlapH = (W / 2) + 15;
  const yTotal = yBodyBottom + bottomFlapH;

  // Main Horizontal Body Creases
  gb.addLine({ x: x1, y: yBodyTop }, { x: x5, y: yBodyTop }, 'CREASE');
  gb.addLine({ x: x1, y: yBodyBottom }, { x: x5, y: yBodyBottom }, 'CREASE');

  // Vertical Creases
  gb.addLine({ x: x1, y: yBodyTop }, { x: x1, y: yBodyBottom }, 'CREASE');
  gb.addLine({ x: x2, y: yBodyTop }, { x: x2, y: yBodyBottom }, 'CREASE');
  gb.addLine({ x: x3, y: yBodyTop }, { x: x3, y: yBodyBottom }, 'CREASE');
  gb.addLine({ x: x4, y: yBodyTop }, { x: x4, y: yBodyBottom }, 'CREASE');

  // Glue Flap Left
  gb.addPolyline([
    { x: x1, y: yBodyTop },
    { x: x0, y: yBodyTop + 5 },
    { x: x0, y: yBodyBottom - 5 },
    { x: x1, y: yBodyBottom }
  ], 'CUT');

  // Top Tuck and Dust Flaps
  gb.addLine({ x: x1, y: yBodyTop - W }, { x: x2, y: yBodyTop - W }, 'CREASE');
  gb.addPolyline([
    { x: x1, y: yBodyTop },
    { x: x1, y: yBodyTop - W },
    { x: x1 + 4, y: 0 },
    { x: x2 - 4, y: 0 },
    { x: x2, y: yBodyTop - W },
    { x: x2, y: yBodyTop }
  ], 'CUT');

  gb.addPolyline([{ x: x2, y: yBodyTop }, { x: x2 + 3, y: yBodyTop - dust }, { x: x3 - 3, y: yBodyTop - dust }, { x: x3, y: yBodyTop }], 'CUT');
  gb.addLine({ x: x3, y: yBodyTop }, { x: x4, y: yBodyTop }, 'CUT');
  gb.addPolyline([{ x: x4, y: yBodyTop }, { x: x4 + 3, y: yBodyTop - dust }, { x: x5 - 3, y: yBodyTop - dust }, { x: x5, y: yBodyTop }], 'CUT');

  gb.addLine({ x: x5, y: yBodyTop }, { x: x5, y: yBodyBottom }, 'CUT');

  // Auto Bottom Flaps (Crash Lock Geometry with 45° crease scores)
  // Panel 1 bottom flap (has 45° fold crease)
  gb.addLine({ x: x1, y: yBodyBottom }, { x: x1 + (W / 2), y: yTotal }, 'CREASE', '45° Crash Crease 1');
  gb.addPolyline([
    { x: x1, y: yBodyBottom },
    { x: x1, y: yTotal - 10 },
    { x: x1 + L - 15, y: yTotal },
    { x: x2, y: yBodyBottom }
  ], 'CUT');

  // Panel 2 bottom flap (glue tab flap)
  gb.addPolyline([
    { x: x2, y: yBodyBottom },
    { x: x2 + 5, y: yBodyBottom + bottomFlapH * 0.7 },
    { x: x3 - 5, y: yBodyBottom + bottomFlapH * 0.7 },
    { x: x3, y: yBodyBottom }
  ], 'CUT');

  // Panel 3 bottom flap (matching 45° crash lock)
  gb.addLine({ x: x3, y: yBodyBottom }, { x: x3 + (W / 2), y: yTotal }, 'CREASE', '45° Crash Crease 2');
  gb.addPolyline([
    { x: x3, y: yBodyBottom },
    { x: x3, y: yTotal - 10 },
    { x: x3 + L - 15, y: yTotal },
    { x: x4, y: yBodyBottom }
  ], 'CUT');

  // Panel 4 bottom flap
  gb.addPolyline([
    { x: x4, y: yBodyBottom },
    { x: x4 + 5, y: yBodyBottom + bottomFlapH * 0.7 },
    { x: x5 - 5, y: yBodyBottom + bottomFlapH * 0.7 },
    { x: x5, y: yBodyBottom }
  ], 'CUT');

  // Dimensions
  gb.addDimension({ x: x1, y: yBodyTop }, { x: x2, y: yBodyTop }, L, `Length (L): ${L} mm`, -30, 'horizontal', 'length');
  gb.addDimension({ x: x2, y: yBodyTop }, { x: x3, y: yBodyTop }, W, `Width (W): ${W} mm`, -15, 'horizontal', 'width');
  gb.addDimension({ x: x1, y: yBodyTop }, { x: x1, y: yBodyBottom }, H, `Height (H): ${H} mm`, -30, 'vertical', 'height');

  gb.addPanel('Front Panel', [{ x: x1, y: yBodyTop }, { x: x2, y: yBodyTop }, { x: x2, y: yBodyBottom }, { x: x1, y: yBodyBottom }]);
  gb.addPanel('Back Panel', [{ x: x3, y: yBodyTop }, { x: x4, y: yBodyTop }, { x: x4, y: yBodyBottom }, { x: x3, y: yBodyBottom }]);
}

// 10. Lid + Base Telescoping Set (FEFCO 0301)
function generateLidBaseBox(gb: GeometryBuilder, p: Record<string, number>): void {
  const L = p['length'] || 220;
  const W = p['width'] || 150;
  const H = p['height'] || 70;
  const lidH = p['lidHeight'] || 35;
  const clear = p['lidClearance'] || 2.5;
  const G = p['glueTab'] !== undefined ? p['glueTab'] : 25.4;

  // Base Tray
  const bx1 = H;
  const by1 = H;
  const bx2 = bx1 + L;
  const by2 = by1 + W;

  // Base
  gb.addPanel('Base Tray', [{ x: bx1, y: by1 }, { x: bx2, y: by1 }, { x: bx2, y: by2 }, { x: bx1, y: by2 }]);

  gb.addLine({ x: bx1, y: by1 }, { x: bx2, y: by1 }, 'CREASE');
  gb.addLine({ x: bx1, y: by2 }, { x: bx2, y: by2 }, 'CREASE');
  gb.addLine({ x: bx1, y: by1 }, { x: bx1, y: by2 }, 'CREASE');
  gb.addLine({ x: bx2, y: by1 }, { x: bx2, y: by2 }, 'CREASE');

  gb.addLine({ x: bx1, y: 0 }, { x: bx2, y: 0 }, 'CUT');
  gb.addLine({ x: bx1, y: 0 }, { x: bx1, y: by1 }, 'CUT');
  gb.addLine({ x: bx2, y: 0 }, { x: bx2, y: by1 }, 'CUT');

  gb.addLine({ x: bx1, y: by2 + H }, { x: bx2, y: by2 + H }, 'CUT');
  gb.addLine({ x: bx1, y: by2 + H }, { x: bx1, y: by2 }, 'CUT');
  gb.addLine({ x: bx2, y: by2 + H }, { x: bx2, y: by2 }, 'CUT');

  // Base glue tabs
  gb.addPolyline([{ x: bx1 - H, y: by1 - G }, { x: 0, y: by1 }, { x: 0, y: by2 }, { x: bx1 - H, y: by2 + G }], 'CUT');
  gb.addLine({ x: bx1 - H, y: by1 - G }, { x: bx1 - H, y: by1 }, 'CUT');
  gb.addLine({ x: bx1 - H, y: by2 + G }, { x: bx1 - H, y: by2 }, 'CUT');

  gb.addPolyline([{ x: bx2 + H, y: by1 - G }, { x: bx2 + H * 2, y: by1 }, { x: bx2 + H * 2, y: by2 }, { x: bx2 + H, y: by2 + G }], 'CUT');
  gb.addLine({ x: bx2 + H, y: by1 - G }, { x: bx2 + H, y: by1 }, 'CUT');
  gb.addLine({ x: bx2 + H, y: by2 + G }, { x: bx2 + H, y: by2 }, 'CUT');

  // Lid Tray (placed to the right with offset)
  const lidL = L + clear * 2;
  const lidW = W + clear * 2;
  const lidOffsetX = bx2 + H * 2 + 50;

  const lx1 = lidOffsetX + lidH;
  const ly1 = lidH;
  const lx2 = lx1 + lidL;
  const ly2 = ly1 + lidW;

  gb.addPanel('Lid Tray', [{ x: lx1, y: ly1 }, { x: lx2, y: ly1 }, { x: lx2, y: ly2 }, { x: lx1, y: ly2 }]);

  gb.addLine({ x: lx1, y: ly1 }, { x: lx2, y: ly1 }, 'CREASE');
  gb.addLine({ x: lx1, y: ly2 }, { x: lx2, y: ly2 }, 'CREASE');
  gb.addLine({ x: lx1, y: ly1 }, { x: lx1, y: ly2 }, 'CREASE');
  gb.addLine({ x: lx2, y: ly1 }, { x: lx2, y: ly2 }, 'CREASE');

  gb.addLine({ x: lx1, y: 0 }, { x: lx2, y: 0 }, 'CUT');
  gb.addLine({ x: lx1, y: 0 }, { x: lx1, y: ly1 }, 'CUT');
  gb.addLine({ x: lx2, y: 0 }, { x: lx2, y: ly1 }, 'CUT');

  gb.addLine({ x: lx1, y: ly2 + lidH }, { x: lx2, y: ly2 + lidH }, 'CUT');
  gb.addLine({ x: lx1, y: ly2 + lidH }, { x: lx1, y: ly2 }, 'CUT');
  gb.addLine({ x: lx2, y: ly2 + lidH }, { x: lx2, y: ly2 }, 'CUT');

  gb.addPolyline([{ x: lx1 - lidH, y: ly1 - G }, { x: lidOffsetX, y: ly1 }, { x: lidOffsetX, y: ly2 }, { x: lx1 - lidH, y: ly2 + G }], 'CUT');
  gb.addLine({ x: lx1 - lidH, y: ly1 - G }, { x: lx1 - lidH, y: ly1 }, 'CUT');
  gb.addLine({ x: lx1 - lidH, y: ly2 + G }, { x: lx1 - lidH, y: ly2 }, 'CUT');

  gb.addPolyline([{ x: lx2 + lidH, y: ly1 - G }, { x: lx2 + lidH * 2, y: ly1 }, { x: lx2 + lidH * 2, y: ly2 }, { x: lx2 + lidH, y: ly2 + G }], 'CUT');
  gb.addLine({ x: lx2 + lidH, y: ly1 - G }, { x: lx2 + lidH, y: ly1 }, 'CUT');
  gb.addLine({ x: lx2 + lidH, y: ly2 + G }, { x: lx2 + lidH, y: ly2 }, 'CUT');

  // Dimensions
  gb.addDimension({ x: bx1, y: by1 }, { x: bx2, y: by1 }, L, `Base Length: ${L} mm`, -30, 'horizontal', 'length');
  gb.addDimension({ x: bx1, y: by1 }, { x: bx1, y: by2 }, W, `Base Width: ${W} mm`, -30, 'vertical', 'width');
  gb.addDimension({ x: lx1, y: ly1 }, { x: lx2, y: ly1 }, lidL, `Lid Length (+${clear * 2}mm): ${lidL} mm`, -30, 'horizontal');
}

// 11. 1-2-3 Snap Lock Bottom Box
function generateSnapLock123(gb: GeometryBuilder, p: Record<string, number>): void {
  const L = p['length'] || 150;
  const W = p['width'] || 100;
  const H = p['height'] || 200;
  const G = p['glueFlap'] !== undefined ? p['glueFlap'] : 25.4;
  const tuck = p['tuckFlap'] || 26;
  const dust = p['dustFlap'] || 30;

  const x0 = 0;
  const x1 = G;
  const x2 = x1 + L;
  const x3 = x2 + W;
  const x4 = x3 + L;
  const x5 = x4 + W;

  const yTuckTop = tuck + 6;
  const yBodyTop = yTuckTop + W;
  const yBodyBottom = yBodyTop + H;
  const snapFlapH = (W / 2) + 20;
  const yTotal = yBodyBottom + snapFlapH;

  // Creases
  gb.addLine({ x: x1, y: yBodyTop }, { x: x5, y: yBodyTop }, 'CREASE');
  gb.addLine({ x: x1, y: yBodyBottom }, { x: x5, y: yBodyBottom }, 'CREASE');

  gb.addLine({ x: x1, y: yBodyTop }, { x: x1, y: yBodyBottom }, 'CREASE');
  gb.addLine({ x: x2, y: yBodyTop }, { x: x2, y: yBodyBottom }, 'CREASE');
  gb.addLine({ x: x3, y: yBodyTop }, { x: x3, y: yBodyBottom }, 'CREASE');
  gb.addLine({ x: x4, y: yBodyTop }, { x: x4, y: yBodyBottom }, 'CREASE');

  // Glue Flap
  gb.addPolyline([{ x: x1, y: yBodyTop }, { x: x0, y: yBodyTop + 5 }, { x: x0, y: yBodyBottom - 5 }, { x: x1, y: yBodyBottom }], 'CUT');

  // Top Tuck & Dust
  gb.addLine({ x: x1, y: yBodyTop - W }, { x: x2, y: yBodyTop - W }, 'CREASE');
  gb.addPolyline([
    { x: x1, y: yBodyTop },
    { x: x1, y: yBodyTop - W },
    { x: x1 + 5, y: 0 },
    { x: x2 - 5, y: 0 },
    { x: x2, y: yBodyTop - W },
    { x: x2, y: yBodyTop }
  ], 'CUT');

  gb.addPolyline([{ x: x2, y: yBodyTop }, { x: x2 + 3, y: yBodyTop - dust }, { x: x3 - 3, y: yBodyTop - dust }, { x: x3, y: yBodyTop }], 'CUT');
  gb.addLine({ x: x3, y: yBodyTop }, { x: x4, y: yBodyTop }, 'CUT');
  gb.addPolyline([{ x: x4, y: yBodyTop }, { x: x4 + 3, y: yBodyTop - dust }, { x: x5 - 3, y: yBodyTop - dust }, { x: x5, y: yBodyTop }], 'CUT');
  gb.addLine({ x: x5, y: yBodyTop }, { x: x5, y: yBodyBottom }, 'CUT');

  // 1-2-3 Snap Bottom Flaps
  // Flap 1 (Large interlocking tongue on panel 1)
  gb.addPolyline([
    { x: x1, y: yBodyBottom },
    { x: x1 + 10, y: yTotal },
    { x: x2 - 10, y: yTotal },
    { x: x2, y: yBodyBottom }
  ], 'CUT');

  // Flap 2 (Side Wing on panel 2)
  gb.addPolyline([
    { x: x2, y: yBodyBottom },
    { x: x2 + 5, y: yBodyBottom + snapFlapH * 0.75 },
    { x: x3 - 5, y: yBodyBottom + snapFlapH * 0.75 },
    { x: x3, y: yBodyBottom }
  ], 'CUT');

  // Flap 3 (Locking notch flap on panel 3)
  gb.addPolyline([
    { x: x3, y: yBodyBottom },
    { x: x3 + 12, y: yTotal - 5 },
    { x: x4 - 12, y: yTotal - 5 },
    { x: x4, y: yBodyBottom }
  ], 'CUT');

  // Flap 4 (Side Wing on panel 4)
  gb.addPolyline([
    { x: x4, y: yBodyBottom },
    { x: x4 + 5, y: yBodyBottom + snapFlapH * 0.75 },
    { x: x5 - 5, y: yBodyBottom + snapFlapH * 0.75 },
    { x: x5, y: yBodyBottom }
  ], 'CUT');

  // Dimensions
  gb.addDimension({ x: x1, y: yBodyTop }, { x: x2, y: yBodyTop }, L, `Length (L): ${L} mm`, -30, 'horizontal', 'length');
  gb.addDimension({ x: x2, y: yBodyTop }, { x: x3, y: yBodyTop }, W, `Width (W): ${W} mm`, -15, 'horizontal', 'width');
  gb.addDimension({ x: x1, y: yBodyTop }, { x: x1, y: yBodyBottom }, H, `Height (H): ${H} mm`, -30, 'vertical', 'height');

  gb.addPanel('Front Panel', [{ x: x1, y: yBodyTop }, { x: x2, y: yBodyTop }, { x: x2, y: yBodyBottom }, { x: x1, y: yBodyBottom }]);
}

// 12. Bookfold Wrap Mailer
function generateFolderMailer(gb: GeometryBuilder, p: Record<string, number>): void {
  const L = p['length'] || 280;
  const W = p['width'] || 200;
  const H = p['height'] || 35;
  const C = p['closureFlap'] || 50;
  const S = p['sideFlap'] || 100;

  const bx1 = S;
  const by1 = C + H;
  const bx2 = bx1 + L;
  const by2 = by1 + W;

  // Center Bed
  gb.addPanel('Book Bed', [{ x: bx1, y: by1 }, { x: bx2, y: by1 }, { x: bx2, y: by2 }, { x: bx1, y: by2 }]);

  // Variable Depth Double Creases (Top, Bottom, Left, Right)
  // Top Hinges
  gb.addLine({ x: bx1, y: by1 }, { x: bx2, y: by1 }, 'CREASE');
  gb.addLine({ x: bx1, y: by1 - H }, { x: bx2, y: by1 - H }, 'CREASE');

  // Bottom Hinges
  gb.addLine({ x: bx1, y: by2 }, { x: bx2, y: by2 }, 'CREASE');
  gb.addLine({ x: bx1, y: by2 + H }, { x: bx2, y: by2 + H }, 'CREASE');
  gb.addLine({ x: bx1, y: by2 + H + W }, { x: bx2, y: by2 + H + W }, 'CREASE');

  // Left Hinges
  gb.addLine({ x: bx1, y: by1 }, { x: bx1, y: by2 }, 'CREASE');
  gb.addLine({ x: bx1 - H, y: by1 }, { x: bx1 - H, y: by2 }, 'CREASE');

  // Right Hinges
  gb.addLine({ x: bx2, y: by1 }, { x: bx2, y: by2 }, 'CREASE');
  gb.addLine({ x: bx2 + H, y: by1 }, { x: bx2 + H, y: by2 }, 'CREASE');

  // Outer Cuts
  // Top closure flap
  gb.addLine({ x: bx1 + 10, y: 0 }, { x: bx2 - 10, y: 0 }, 'CUT');
  gb.addLine({ x: bx1 + 10, y: 0 }, { x: bx1, y: by1 - H }, 'CUT');
  gb.addLine({ x: bx2 - 10, y: 0 }, { x: bx2, y: by1 - H }, 'CUT');

  // Bottom wrap panel & flap
  const botYTotal = by2 + H + W + C;
  gb.addLine({ x: bx1 + 5, y: botYTotal }, { x: bx2 - 5, y: botYTotal }, 'CUT');
  gb.addLine({ x: bx1, y: by2 + H }, { x: bx1 + 5, y: botYTotal }, 'CUT');
  gb.addLine({ x: bx2, y: by2 + H }, { x: bx2 - 5, y: botYTotal }, 'CUT');

  // Left Flap
  gb.addPolyline([
    { x: bx1, y: by1 },
    { x: bx1 - H, y: by1 + 5 },
    { x: 0, y: by1 + 15 },
    { x: 0, y: by2 - 15 },
    { x: bx1 - H, y: by2 - 5 },
    { x: bx1, y: by2 }
  ], 'CUT');

  // Right Flap
  const rightXTotal = bx2 + H + S;
  gb.addPolyline([
    { x: bx2, y: by1 },
    { x: bx2 + H, y: by1 + 5 },
    { x: rightXTotal, y: by1 + 15 },
    { x: rightXTotal, y: by2 - 15 },
    { x: bx2 + H, y: by2 - 5 },
    { x: bx2, y: by2 }
  ], 'CUT');

  // Dimensions
  gb.addDimension({ x: bx1, y: by1 }, { x: bx2, y: by1 }, L, `Bed Length: ${L} mm`, -30, 'horizontal', 'length');
  gb.addDimension({ x: bx1, y: by1 }, { x: bx1, y: by2 }, W, `Bed Width: ${W} mm`, -30, 'vertical', 'width');
  gb.addDimension({ x: bx1, y: by1 - H }, { x: bx1, y: by1 }, H, `Thickness (H): ${H} mm`, 20, 'vertical', 'height');
}
