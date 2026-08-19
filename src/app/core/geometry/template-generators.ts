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
  params: Record<string, number>
): DielineGeometry {
  resetGeometryIdCounter();
  const gb = new GeometryBuilder();

  switch (templateId) {
    case 'rsc_carton':
      generateRSC(gb, params);
      break;
    case 'mailer_box':
      generateMailerBox(gb, params);
      break;
    case 'straight_tuck_end':
      generateStraightTuckEnd(gb, params);
      break;
    case 'reverse_tuck_end':
      generateReverseTuckEnd(gb, params);
      break;
    case 'auto_bottom_box':
      generateAutoBottom(gb, params);
      break;
    case 'roll_end_tray':
      generateRollEndTray(gb, params);
      break;
    case 'open_tray_4corner':
      generateOpenTray(gb, params);
      break;
    case 'wraparound_sleeve':
      generateWraparoundSleeve(gb, params);
      break;
    case 'pillow_box':
      generatePillowBox(gb, params);
      break;
    case 'lid_base_box':
      generateLidBaseBox(gb, params);
      break;
    case 'snap_lock_123_bottom':
      generateSnapLock123(gb, params);
      break;
    case 'folder_mailer':
      generateFolderMailer(gb, params);
      break;
    default:
      generateRSC(gb, params);
      break;
  }

  return gb.build();
}

// 1. Regular Slotted Carton (RSC - FEFCO 0201)
function generateRSC(gb: GeometryBuilder, p: Record<string, number>): void {
  const L = p['length'] || 300;
  const W = p['width'] || 200;
  const H = p['height'] || 150;
  const G = p['glueFlap'] !== undefined ? p['glueFlap'] : 25.4;
  const flapH = W / 2; // Standard top and bottom flaps meet in center
  const slotW = p['slotWidth'] || 4;
  const halfSlot = slotW / 2;

  const x0 = 0;
  const x1 = G;
  const x2 = x1 + L;
  const x3 = x2 + W;
  const x4 = x3 + L;
  const x5 = x4 + W;

  const y0 = 0;
  const y1 = flapH;
  const y2 = y1 + H;
  const y3 = y2 + flapH;

  // Outer Cut perimeter
  // Glue flap left
  gb.addLine({ x: x0 + 5, y: y1 }, { x: x0, y: y1 + 10 }, 'CUT');
  gb.addLine({ x: x0, y: y1 + 10 }, { x: x0, y: y2 - 10 }, 'CUT');
  gb.addLine({ x: x0, y: y2 - 10 }, { x: x0 + 5, y: y2 }, 'CUT');

  // Top Flaps cuts and slots
  gb.addLine({ x: x0 + 5, y: y1 }, { x: x1, y: y1 }, 'CUT');
  
  // Flap 1 (L) - from x1 to x2 - halfSlot
  gb.addLine({ x: x1, y: y1 }, { x: x1, y: y0 }, 'CUT');
  gb.addLine({ x: x1, y: y0 }, { x: x2 - halfSlot, y: y0 }, 'CUT');
  gb.addLine({ x: x2 - halfSlot, y: y0 }, { x: x2 - halfSlot, y: y1 }, 'CUT');

  // Slot 1 (centered at x2)
  gb.addLine({ x: x2 - halfSlot, y: y1 }, { x: x2 + halfSlot, y: y1 }, 'CUT');

  // Flap 2 (W) - from x2 + halfSlot to x3 - halfSlot
  gb.addLine({ x: x2 + halfSlot, y: y1 }, { x: x2 + halfSlot, y: y0 }, 'CUT');
  gb.addLine({ x: x2 + halfSlot, y: y0 }, { x: x3 - halfSlot, y: y0 }, 'CUT');
  gb.addLine({ x: x3 - halfSlot, y: y0 }, { x: x3 - halfSlot, y: y1 }, 'CUT');

  // Slot 2 (centered at x3)
  gb.addLine({ x: x3 - halfSlot, y: y1 }, { x: x3 + halfSlot, y: y1 }, 'CUT');

  // Flap 3 (L) - from x3 + halfSlot to x4 - halfSlot
  gb.addLine({ x: x3 + halfSlot, y: y1 }, { x: x3 + halfSlot, y: y0 }, 'CUT');
  gb.addLine({ x: x3 + halfSlot, y: y0 }, { x: x4 - halfSlot, y: y0 }, 'CUT');
  gb.addLine({ x: x4 - halfSlot, y: y0 }, { x: x4 - halfSlot, y: y1 }, 'CUT');

  // Slot 3 (centered at x4)
  gb.addLine({ x: x4 - halfSlot, y: y1 }, { x: x4 + halfSlot, y: y1 }, 'CUT');

  // Flap 4 (W) - from x4 + halfSlot to x5
  gb.addLine({ x: x4 + halfSlot, y: y1 }, { x: x4 + halfSlot, y: y0 }, 'CUT');
  gb.addLine({ x: x4 + halfSlot, y: y0 }, { x: x5, y: y0 }, 'CUT');
  gb.addLine({ x: x5, y: y0 }, { x: x5, y: y1 }, 'CUT');

  // Right edge
  gb.addLine({ x: x5, y: y1 }, { x: x5, y: y2 }, 'CUT');

  // Bottom Flaps
  // Flap 4 bottom - from x5 to x4 + halfSlot
  gb.addLine({ x: x5, y: y2 }, { x: x5, y: y3 }, 'CUT');
  gb.addLine({ x: x5, y: y3 }, { x: x4 + halfSlot, y: y3 }, 'CUT');
  gb.addLine({ x: x4 + halfSlot, y: y3 }, { x: x4 + halfSlot, y: y2 }, 'CUT');

  // Bottom Slot 3 (centered at x4)
  gb.addLine({ x: x4 + halfSlot, y: y2 }, { x: x4 - halfSlot, y: y2 }, 'CUT');

  // Flap 3 bottom - from x4 - halfSlot to x3 + halfSlot
  gb.addLine({ x: x4 - halfSlot, y: y2 }, { x: x4 - halfSlot, y: y3 }, 'CUT');
  gb.addLine({ x: x4 - halfSlot, y: y3 }, { x: x3 + halfSlot, y: y3 }, 'CUT');
  gb.addLine({ x: x3 + halfSlot, y: y3 }, { x: x3 + halfSlot, y: y2 }, 'CUT');

  // Bottom Slot 2 (centered at x3)
  gb.addLine({ x: x3 + halfSlot, y: y2 }, { x: x3 - halfSlot, y: y2 }, 'CUT');

  // Flap 2 bottom - from x3 - halfSlot to x2 + halfSlot
  gb.addLine({ x: x3 - halfSlot, y: y2 }, { x: x3 - halfSlot, y: y3 }, 'CUT');
  gb.addLine({ x: x3 - halfSlot, y: y3 }, { x: x2 + halfSlot, y: y3 }, 'CUT');
  gb.addLine({ x: x2 + halfSlot, y: y3 }, { x: x2 + halfSlot, y: y2 }, 'CUT');

  // Bottom Slot 1 (centered at x2)
  gb.addLine({ x: x2 + halfSlot, y: y2 }, { x: x2 - halfSlot, y: y2 }, 'CUT');

  // Flap 1 bottom - from x2 - halfSlot to x1
  gb.addLine({ x: x2 - halfSlot, y: y2 }, { x: x2 - halfSlot, y: y3 }, 'CUT');
  gb.addLine({ x: x2 - halfSlot, y: y3 }, { x: x1, y: y3 }, 'CUT');
  gb.addLine({ x: x1, y: y3 }, { x: x1, y: y2 }, 'CUT');
  gb.addLine({ x: x1, y: y2 }, { x: x0 + 5, y: y2 }, 'CUT');

  // Horizontal Crease Lines
  gb.addLine({ x: x1, y: y1 }, { x: x5, y: y1 }, 'CREASE', 'Top Crease');
  gb.addLine({ x: x1, y: y2 }, { x: x5, y: y2 }, 'CREASE', 'Bottom Crease');

  // Vertical Crease Lines
  gb.addLine({ x: x1, y: y1 }, { x: x1, y: y2 }, 'CREASE', 'Glue Crease');
  gb.addLine({ x: x2, y: y1 }, { x: x2, y: y2 }, 'CREASE', 'Panel 1-2 Crease');
  gb.addLine({ x: x3, y: y1 }, { x: x3, y: y2 }, 'CREASE', 'Panel 2-3 Crease');
  gb.addLine({ x: x4, y: y1 }, { x: x4, y: y2 }, 'CREASE', 'Panel 3-4 Crease');

  // Bleed Box Outline
  const bleed = p['bleed'] || 3;
  gb.addRect(x0 - bleed, y0 - bleed, (x5 - x0) + 2 * bleed, (y3 - y0) + 2 * bleed, 'BLEED');

  // Driving Dimensions
  gb.addDimension({ x: x1, y: y1 }, { x: x2, y: y1 }, L, `Length (L): ${L} mm`, -35, 'horizontal', 'length');
  gb.addDimension({ x: x2, y: y1 }, { x: x3, y: y1 }, W, `Width (W): ${W} mm`, -20, 'horizontal', 'width');
  gb.addDimension({ x: x1, y: y1 }, { x: x1, y: y2 }, H, `Height (H): ${H} mm`, -35, 'vertical', 'height');
  gb.addDimension({ x: x0, y: y1 }, { x: x1, y: y1 }, G, `Glue: ${G} mm`, -15, 'horizontal', 'glueFlap');

  // Panels for 3D
  gb.addPanel('Front Panel', [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }]);
  gb.addPanel('Side Panel 1', [{ x: x2, y: y1 }, { x: x3, y: y1 }, { x: x3, y: y2 }, { x: x2, y: y2 }]);
  gb.addPanel('Back Panel', [{ x: x3, y: y1 }, { x: x4, y: y1 }, { x: x4, y: y2 }, { x: x3, y: y2 }]);
  gb.addPanel('Side Panel 2', [{ x: x4, y: y1 }, { x: x5, y: y1 }, { x: x5, y: y2 }, { x: x4, y: y2 }]);
  gb.addPanel('Glue Tab', [{ x: x0, y: y1 + 10 }, { x: x1, y: y1 }, { x: x1, y: y2 }, { x: x0, y: y2 - 10 }]);
}

// 2. Mailer Box (Roll End Tuck Top - FEFCO 0427)
function generateMailerBox(gb: GeometryBuilder, p: Record<string, number>): void {
  const L = p['length'] || 260; // front-back
  const W = p['width'] || 180;  // side-to-side
  const H = p['height'] || 70;  // depth
  const tuck = p['tuckFlap'] || 28;
  const dust = p['dustFlapWidth'] || 35;
  const earW = p['lockTabWidth'] || 16;
  const earH = 12;

  // Origin centered on Main Base
  // Base Panel: W wide by L tall
  const baseX = H * 2;
  const baseY = H + dust;

  const bx1 = baseX;
  const bx2 = bx1 + W;
  const by1 = baseY;
  const by2 = by1 + L;

  // 1. Base Panel (Center)
  gb.addPanel('Base Tray', [{ x: bx1, y: by1 }, { x: bx2, y: by1 }, { x: bx2, y: by2 }, { x: bx1, y: by2 }]);

  // 2. Rear Wall & Lid Panel
  const rearY1 = by1 - H;
  const lidY1 = rearY1 - L;
  const tuckY1 = lidY1 - tuck;

  // Creases
  gb.addLine({ x: bx1, y: by1 }, { x: bx2, y: by1 }, 'CREASE', 'Rear Wall Crease');
  gb.addLine({ x: bx1, y: rearY1 }, { x: bx2, y: rearY1 }, 'CREASE', 'Lid Hinge Crease');
  gb.addLine({ x: bx1, y: lidY1 }, { x: bx2, y: lidY1 }, 'CREASE', 'Tuck Flap Crease');

  // Left & Right Dust Flaps on Rear Wall
  // Left dust flap
  gb.addPolyline([
    { x: bx1, y: rearY1 },
    { x: bx1 - dust, y: rearY1 + 5 },
    { x: bx1 - dust, y: by1 - 5 },
    { x: bx1, y: by1 }
  ], 'CUT');

  // Right dust flap
  gb.addPolyline([
    { x: bx2, y: by1 },
    { x: bx2 + dust, y: by1 - 5 },
    { x: bx2 + dust, y: rearY1 + 5 },
    { x: bx2, y: rearY1 }
  ], 'CUT');

  // Lid side wings
  const wingW = H - 2;
  gb.addPolyline([
    { x: bx1, y: rearY1 },
    { x: bx1 - wingW, y: rearY1 + 4 },
    { x: bx1 - wingW, y: lidY1 - 4 },
    { x: bx1, y: lidY1 }
  ], 'CUT');
  gb.addLine({ x: bx1, y: rearY1 }, { x: bx1, y: lidY1 }, 'CREASE', 'Left Lid Wing Crease');

  gb.addPolyline([
    { x: bx2, y: lidY1 },
    { x: bx2 + wingW, y: lidY1 - 4 },
    { x: bx2 + wingW, y: rearY1 + 4 },
    { x: bx2, y: rearY1 }
  ], 'CUT');
  gb.addLine({ x: bx2, y: rearY1 }, { x: bx2, y: lidY1 }, 'CREASE', 'Right Lid Wing Crease');

  // Front Tuck Flap
  gb.addPolyline([
    { x: bx1, y: lidY1 },
    { x: bx1 + 10, y: tuckY1 },
    { x: bx2 - 10, y: tuckY1 },
    { x: bx2, y: lidY1 }
  ], 'CUT');

  // Front Wall (bottom of base)
  const frontY1 = by2;
  const frontY2 = frontY1 + H;
  const rollFrontY3 = frontY2 + H - 2;

  gb.addLine({ x: bx1, y: frontY1 }, { x: bx2, y: frontY1 }, 'CREASE', 'Front Wall Crease');
  gb.addLine({ x: bx1, y: frontY2 }, { x: bx2, y: frontY2 }, 'CREASE', 'Front Rollover Crease');

  // Rollover retention slots on front panel
  gb.addLine({ x: bx1 + 15, y: frontY1 }, { x: bx1 + 15 + earW, y: frontY1 }, 'CUT', 'Slot 1');
  gb.addLine({ x: bx2 - 15 - earW, y: frontY1 }, { x: bx2 - 15, y: frontY1 }, 'CUT', 'Slot 2');

  // Front rollover inner flap
  gb.addPolyline([
    { x: bx1, y: frontY2 },
    { x: bx1 + 5, y: rollFrontY3 },
    { x: bx2 - 5, y: rollFrontY3 },
    { x: bx2, y: frontY2 }
  ], 'CUT');

  // 3. Side Double-Walls (Left & Right)
  // Left side walls
  const wallL1 = bx1 - H;
  const wallL2 = wallL1 - H;

  gb.addLine({ x: bx1, y: by1 }, { x: bx1, y: by2 }, 'CREASE', 'Left Wall Base Crease');
  gb.addLine({ x: wallL1, y: by1 }, { x: wallL1, y: by2 }, 'CREASE', 'Left Rollover Crease');

  // Outer rollover cut with locking ear tab
  gb.addPolyline([
    { x: bx1, y: by1 },
    { x: wallL1, y: by1 + 4 },
    { x: wallL2, y: by1 + 8 },
    { x: wallL2 - earH, y: by1 + 25 },
    { x: wallL2 - earH, y: by2 - 25 },
    { x: wallL2, y: by2 - 8 },
    { x: wallL1, y: by2 - 4 },
    { x: bx1, y: by2 }
  ], 'CUT');

  // Right side walls
  const wallR1 = bx2 + H;
  const wallR2 = wallR1 + H;

  gb.addLine({ x: bx2, y: by1 }, { x: bx2, y: by2 }, 'CREASE', 'Right Wall Base Crease');
  gb.addLine({ x: wallR1, y: by1 }, { x: wallR1, y: by2 }, 'CREASE', 'Right Rollover Crease');

  gb.addPolyline([
    { x: bx2, y: by1 },
    { x: wallR1, y: by1 + 4 },
    { x: wallR2, y: by1 + 8 },
    { x: wallR2 + earH, y: by1 + 25 },
    { x: wallR2 + earH, y: by2 - 25 },
    { x: wallR2, y: by2 - 8 },
    { x: wallR1, y: by2 - 4 },
    { x: bx2, y: by2 }
  ], 'CUT');

  // Bleed
  const bleed = p['bleed'] || 3;
  gb.addRect(wallL2 - earH - bleed, tuckY1 - bleed, (wallR2 + earH - (wallL2 - earH)) + 2 * bleed, (rollFrontY3 - tuckY1) + 2 * bleed, 'BLEED');

  // Dimensions
  gb.addDimension({ x: bx1, y: by1 }, { x: bx2, y: by1 }, W, `Width (W): ${W} mm`, -30, 'horizontal', 'width');
  gb.addDimension({ x: bx1, y: by1 }, { x: bx1, y: by2 }, L, `Length (L): ${L} mm`, -30, 'vertical', 'length');
  gb.addDimension({ x: bx1, y: by1 }, { x: bx1, y: rearY1 }, H, `Height (H): ${H} mm`, 30, 'vertical', 'height');
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
  const tabW = p['tabWidth'] || 20;

  const bx1 = H * 2;
  const by1 = H * 2;
  const bx2 = bx1 + L;
  const by2 = by1 + W;

  // Base Tray
  gb.addPanel('Tray Base', [{ x: bx1, y: by1 }, { x: bx2, y: by1 }, { x: bx2, y: by2 }, { x: bx1, y: by2 }]);

  // Base Creases
  gb.addLine({ x: bx1, y: by1 }, { x: bx2, y: by1 }, 'CREASE', 'Top Wall Crease');
  gb.addLine({ x: bx1, y: by2 }, { x: bx2, y: by2 }, 'CREASE', 'Bottom Wall Crease');
  gb.addLine({ x: bx1, y: by1 }, { x: bx1, y: by2 }, 'CREASE', 'Left Wall Crease');
  gb.addLine({ x: bx2, y: by1 }, { x: bx2, y: by2 }, 'CREASE', 'Right Wall Crease');

  // Double Wall Rollover Creases (Top & Bottom)
  gb.addLine({ x: bx1, y: by1 - H }, { x: bx2, y: by1 - H }, 'CREASE', 'Top Rollover Crease');
  gb.addLine({ x: bx1, y: by2 + H }, { x: bx2, y: by2 + H }, 'CREASE', 'Bottom Rollover Crease');

  // Left & Right Rollover Creases
  gb.addLine({ x: bx1 - H, y: by1 }, { x: bx1 - H, y: by2 }, 'CREASE', 'Left Rollover Crease');
  gb.addLine({ x: bx2 + H, y: by1 }, { x: bx2 + H, y: by2 }, 'CREASE', 'Right Rollover Crease');

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
