import { jsPDF } from 'jspdf';
import { DielineGeometry, LineSegment } from '../models/dieline.models';
import { MaterialProfile } from '../models/material.models';
import { ExportOptions, ProjectData } from '../models/project.models';
import { NestingSolution, SheetPreset } from '../models/sheet.models';

export class ExportEngine {
  /**
   * Generates production-ready SVG formatted specifically for Zünd Cut Center (ZCC) and Illustrator.
   */
  static exportSVG(
    geometry: DielineGeometry,
    project: ProjectData,
    material: MaterialProfile,
    options: ExportOptions,
    nestingSolution?: NestingSolution,
    sheetPreset?: SheetPreset
  ): string {
    const isNestingExport = options.selectedSheetIndex >= 0 && nestingSolution && sheetPreset;
    
    // Physical dimensions
    const widthMm = isNestingExport ? sheetPreset.width : geometry.bounds.width;
    const heightMm = isNestingExport ? sheetPreset.height : geometry.bounds.height;
    const minX = isNestingExport ? 0 : geometry.bounds.minX;
    const minY = isNestingExport ? 0 : geometry.bounds.minY;

    let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
    svg += `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" `;
    svg += `width="${widthMm}mm" height="${heightMm}mm" viewBox="${minX} ${minY} ${widthMm} ${heightMm}" `;
    svg += `version="1.1">\n`;

    // Metadata header
    svg += `  <metadata>\n`;
    svg += `    <zund:job xmlns:zund="http://www.zund.com">\n`;
    svg += `      <zund:jobName>${escapeXml(project.name)}</zund:jobName>\n`;
    svg += `      <zund:jobNumber>${escapeXml(project.jobNumber)}</zund:jobNumber>\n`;
    svg += `      <zund:material>${escapeXml(material.name)}</zund:material>\n`;
    svg += `      <zund:thicknessMm>${material.thickness}</zund:thicknessMm>\n`;
    svg += `      <zund:recommendedKnife>${escapeXml(material.recommendedKnife)}</zund:recommendedKnife>\n`;
    svg += `      <zund:recommendedCrease>${escapeXml(material.recommendedCreaseWheel)}</zund:recommendedCrease>\n`;
    svg += `    </zund:job>\n`;
    svg += `  </metadata>\n`;

    // Styling definitions
    svg += `  <defs>\n`;
    svg += `    <style type="text/css">\n`;
    svg += `      .layer-cut { stroke: #e11d48; stroke-width: 0.5; fill: none; stroke-linecap: round; }\n`;
    svg += `      .layer-crease { stroke: #2563eb; stroke-width: 0.4; stroke-dasharray: 4, 3; fill: none; }\n`;
    svg += `      .layer-perf { stroke: #059669; stroke-width: 0.4; stroke-dasharray: 2, 2; fill: none; }\n`;
    svg += `      .layer-partial { stroke: #9333ea; stroke-width: 0.3; stroke-dasharray: 6, 2; fill: none; }\n`;
    svg += `      .layer-bleed { stroke: #d97706; stroke-width: 0.25; stroke-dasharray: 5, 5; fill: none; }\n`;
    svg += `      .layer-reg { stroke: #000000; stroke-width: 0.4; fill: #000000; }\n`;
    svg += `      .layer-dim { stroke: #52525b; stroke-width: 0.3; font-family: monospace; font-size: 8px; fill: #52525b; }\n`;
    svg += `    </style>\n`;
    svg += `  </defs>\n\n`;

    if (isNestingExport && nestingSolution) {
      const sheet = nestingSolution.sheets[options.selectedSheetIndex] || nestingSolution.sheets[0];
      
      // Sheet Boundary Layer
      if (options.layers.SHEET_BOUNDARY) {
        svg += `  <!-- SHEET BOUNDARY -->\n`;
        svg += `  <g id="SHEET" inkscape:label="SHEET" inkscape:groupmode="layer">\n`;
        svg += `    <rect x="0" y="0" width="${sheetPreset.width}" height="${sheetPreset.height}" fill="none" stroke="#71717a" stroke-width="0.5" stroke-dasharray="10, 5"/>\n`;
        svg += `  </g>\n\n`;
      }

      // Registration Layer
      if (options.layers.REGISTRATION && sheet.registrationMarks) {
        svg += `  <!-- ZÜND OPTICAL REGISTRATION MARKS (Layer: REGISTRATION) -->\n`;
        svg += `  <g id="REGISTRATION" inkscape:label="REGISTRATION" inkscape:groupmode="layer" class="layer-reg">\n`;
        for (const mark of sheet.registrationMarks) {
          const r = 3; // 6mm diameter standard Zünd mark
          svg += `    <circle cx="${mark.x}" cy="${mark.y}" r="${r}" fill="#000000" stroke="none"/>\n`;
          svg += `    <line x1="${mark.x - r - 2}" y1="${mark.y}" x2="${mark.x + r + 2}" y2="${mark.y}" stroke="#000000" stroke-width="0.3"/>\n`;
          svg += `    <line x1="${mark.x}" y1="${mark.y - r - 2}" x2="${mark.x}" y2="${mark.y + r + 2}" stroke="#000000" stroke-width="0.3"/>\n`;
        }
        svg += `  </g>\n\n`;
      }

      // Nested Items Cuts and Creases
      const cutLines: LineSegment[] = [];
      const creaseLines: LineSegment[] = [];
      const perfLines: LineSegment[] = [];

      for (const item of sheet.items) {
        // Apply transformation (translation & rotation)
        const rad = (item.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        for (const line of geometry.lines) {
          // Local dieline origin relative
          const lx1 = line.p1.x - geometry.bounds.minX;
          const ly1 = line.p1.y - geometry.bounds.minY;
          const lx2 = line.p2.x - geometry.bounds.minX;
          const ly2 = line.p2.y - geometry.bounds.minY;

          const rx1 = lx1 * cos - ly1 * sin + item.x;
          const ry1 = lx1 * sin + ly1 * cos + item.y;
          const rx2 = lx2 * cos - ly2 * sin + item.x;
          const ry2 = lx2 * sin + ly2 * cos + item.y;

          const transformedLine: LineSegment = {
            id: `${item.id}_${line.id}`,
            type: line.type,
            p1: { x: rx1, y: ry1 },
            p2: { x: rx2, y: ry2 }
          };

          if (line.type === 'CUT') cutLines.push(transformedLine);
          else if (line.type === 'CREASE') creaseLines.push(transformedLine);
          else if (line.type === 'PERF') perfLines.push(transformedLine);
        }
      }

      if (options.layers.CUT) {
        svg += `  <!-- ZÜND THRU-CUT LAYER -->\n`;
        svg += `  <g id="CUT" inkscape:label="CUT" inkscape:groupmode="layer" class="layer-cut">\n`;
        for (const l of cutLines) {
          svg += `    <line x1="${l.p1.x.toFixed(3)}" y1="${l.p1.y.toFixed(3)}" x2="${l.p2.x.toFixed(3)}" y2="${l.p2.y.toFixed(3)}"/>\n`;
        }
        svg += `  </g>\n\n`;
      }

      if (options.layers.CREASE) {
        svg += `  <!-- ZÜND CREASE LAYER -->\n`;
        svg += `  <g id="CREASE" inkscape:label="CREASE" inkscape:groupmode="layer" class="layer-crease">\n`;
        for (const l of creaseLines) {
          svg += `    <line x1="${l.p1.x.toFixed(3)}" y1="${l.p1.y.toFixed(3)}" x2="${l.p2.x.toFixed(3)}" y2="${l.p2.y.toFixed(3)}"/>\n`;
        }
        svg += `  </g>\n\n`;
      }

    } else {
      // Single Dieline Export
      // Registration Layer (4 Optical Dots in 4 Corners of the Box)
      if (options.layers.REGISTRATION) {
        const regOffset = 15;
        const regR = 3;
        const regMarks = [
          { x: geometry.bounds.minX - regOffset, y: geometry.bounds.minY - regOffset },
          { x: geometry.bounds.maxX + regOffset, y: geometry.bounds.minY - regOffset },
          { x: geometry.bounds.minX - regOffset, y: geometry.bounds.maxY + regOffset },
          { x: geometry.bounds.maxX + regOffset, y: geometry.bounds.maxY + regOffset }
        ];

        svg += `  <!-- ZÜND OPTICAL REGISTRATION MARKS (Layer: reg) -->\n`;
        svg += `  <g id="reg" inkscape:label="reg" inkscape:groupmode="layer" class="layer-reg">\n`;
        for (const mark of regMarks) {
          svg += `    <circle cx="${mark.x}" cy="${mark.y}" r="${regR}" fill="#000000" stroke="none"/>\n`;
          svg += `    <line x1="${mark.x - regR - 2}" y1="${mark.y}" x2="${mark.x + regR + 2}" y2="${mark.y}" stroke="#000000" stroke-width="0.3"/>\n`;
          svg += `    <line x1="${mark.x}" y1="${mark.y - regR - 2}" x2="${mark.x}" y2="${mark.y + regR + 2}" stroke="#000000" stroke-width="0.3"/>\n`;
        }
        svg += `  </g>\n\n`;
      }

      if (options.layers.CREASE) {
        svg += `  <!-- ZÜND CREASE LAYER (Layer: crease) -->\n`;
        svg += `  <g id="crease" inkscape:label="crease" inkscape:groupmode="layer" class="layer-crease">\n`;
        for (const l of geometry.lines.filter(l => l.type === 'CREASE')) {
          svg += `    <line x1="${l.p1.x}" y1="${l.p1.y}" x2="${l.p2.x}" y2="${l.p2.y}"/>\n`;
        }
        svg += `  </g>\n\n`;
      }

      if (options.layers.CUT) {
        svg += `  <!-- ZÜND THRU-CUT LAYER (Layer: cut) -->\n`;
        svg += `  <g id="cut" inkscape:label="cut" inkscape:groupmode="layer" class="layer-cut">\n`;
        for (const l of geometry.lines.filter(l => l.type === 'CUT' || l.type === 'PERF' || l.type === 'PARTIAL_CUT')) {
          svg += `    <line x1="${l.p1.x}" y1="${l.p1.y}" x2="${l.p2.x}" y2="${l.p2.y}"/>\n`;
        }
        for (const arc of geometry.arcs.filter(a => a.type === 'CUT')) {
          svg += `    <circle cx="${arc.center.x}" cy="${arc.center.y}" r="${arc.radius}"/>\n`;
        }
        svg += `  </g>\n\n`;
      }

      if (options.layers.BLEED) {
        svg += `  <!-- BLEED LAYER -->\n`;
        svg += `  <g id="BLEED" inkscape:label="BLEED" inkscape:groupmode="layer" class="layer-bleed">\n`;
        for (const l of geometry.lines.filter(l => l.type === 'BLEED')) {
          svg += `    <line x1="${l.p1.x}" y1="${l.p1.y}" x2="${l.p2.x}" y2="${l.p2.y}"/>\n`;
        }
        svg += `  </g>\n\n`;
      }

      if (options.layers.DIMENSIONS) {
        svg += `  <!-- DIMENSIONS LAYER -->\n`;
        svg += `  <g id="DIMENSIONS" inkscape:label="DIMENSIONS" inkscape:groupmode="layer" class="layer-dim">\n`;
        for (const dim of geometry.dimensions) {
          const midX = (dim.p1.x + dim.p2.x) / 2;
          const midY = (dim.p1.y + dim.p2.y) / 2;
          svg += `    <line x1="${dim.p1.x}" y1="${dim.p1.y + dim.offset}" x2="${dim.p2.x}" y2="${dim.p2.y + dim.offset}"/>\n`;
          svg += `    <text x="${midX}" y="${midY + dim.offset - 4}" text-anchor="middle">${escapeXml(dim.label)}</text>\n`;
        }
        svg += `  </g>\n\n`;
      }
    }

    svg += `</svg>\n`;
    return svg;
  }

  /**
   * Generates production-ready Adobe Illustrator (.ai) format with 3 exact layers:
   * 1. 'crease' (score/crease lines)
   * 2. 'cut' (thru-cut lines)
   * 3. 'reg' (4 optical registration marks in the 4 corners of the box)
   */
  static exportAI(
    geometry: DielineGeometry,
    project: ProjectData,
    material: MaterialProfile,
    options: ExportOptions,
    nestingSolution?: NestingSolution,
    sheetPreset?: SheetPreset
  ): string {
    const isNesting = options.selectedSheetIndex >= 0 && nestingSolution && sheetPreset;
    
    // Scale: 1 mm = 72 / 25.4 pt = 2.834645669291339 pt
    const MM_TO_PT = 72 / 25.4;
    const REG_RADIUS_MM = 3; // 6mm diameter standard Zünd optical registration dot
    const REG_OFFSET_MM = 15; // 15mm standoff margin from box boundary
    const ARTBOARD_MARGIN_MM = 10; // Extra canvas padding

    let minX: number;
    let maxX: number;
    let minY: number;
    let maxY: number;
    const cutLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const creaseLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    let regMarks: { x: number; y: number }[] = [];

    if (isNesting && nestingSolution) {
      const sheet = nestingSolution.sheets[options.selectedSheetIndex] || nestingSolution.sheets[0];
      minX = 0;
      minY = 0;
      maxX = sheetPreset.width;
      maxY = sheetPreset.height;

      // Extract nested cut and crease lines
      for (const item of sheet.items) {
        const rad = (item.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        for (const line of geometry.lines) {
          const lx1 = line.p1.x - geometry.bounds.minX;
          const ly1 = line.p1.y - geometry.bounds.minY;
          const lx2 = line.p2.x - geometry.bounds.minX;
          const ly2 = line.p2.y - geometry.bounds.minY;

          const rx1 = lx1 * cos - ly1 * sin + item.x;
          const ry1 = lx1 * sin + ly1 * cos + item.y;
          const rx2 = lx2 * cos - ly2 * sin + item.x;
          const ry2 = lx2 * sin + ly2 * cos + item.y;

          if (line.type === 'CUT' || line.type === 'PERF' || line.type === 'PARTIAL_CUT') {
            cutLines.push({ x1: rx1, y1: ry1, x2: rx2, y2: ry2 });
          } else if (line.type === 'CREASE') {
            creaseLines.push({ x1: rx1, y1: ry1, x2: rx2, y2: ry2 });
          }
        }
      }

      if (sheet.registrationMarks && sheet.registrationMarks.length > 0) {
        regMarks = sheet.registrationMarks.map(m => ({ x: m.x, y: m.y }));
      } else {
        regMarks = [
          { x: minX + REG_OFFSET_MM, y: minY + REG_OFFSET_MM },
          { x: maxX - REG_OFFSET_MM, y: minY + REG_OFFSET_MM },
          { x: minX + REG_OFFSET_MM, y: maxY - REG_OFFSET_MM },
          { x: maxX - REG_OFFSET_MM, y: maxY - REG_OFFSET_MM }
        ];
      }
    } else {
      // Single Dieline Box
      minX = geometry.bounds.minX;
      maxX = geometry.bounds.maxX;
      minY = geometry.bounds.minY;
      maxY = geometry.bounds.maxY;

      for (const line of geometry.lines) {
        if (line.type === 'CUT' || line.type === 'PERF' || line.type === 'PARTIAL_CUT') {
          cutLines.push({ x1: line.p1.x, y1: line.p1.y, x2: line.p2.x, y2: line.p2.y });
        } else if (line.type === 'CREASE') {
          creaseLines.push({ x1: line.p1.x, y1: line.p1.y, x2: line.p2.x, y2: line.p2.y });
        }
      }

      // 4 Registration Dots in the 4 corners of the box (with standard standoff)
      regMarks = [
        { x: minX - REG_OFFSET_MM, y: minY - REG_OFFSET_MM }, // Top-Left
        { x: maxX + REG_OFFSET_MM, y: minY - REG_OFFSET_MM }, // Top-Right
        { x: minX - REG_OFFSET_MM, y: maxY + REG_OFFSET_MM }, // Bottom-Left
        { x: maxX + REG_OFFSET_MM, y: maxY + REG_OFFSET_MM }  // Bottom-Right
      ];
    }

    // Determine total bounding canvas (including 4 registration marks + margin)
    let boundMinX = minX;
    let boundMaxX = maxX;
    let boundMinY = minY;
    let boundMaxY = maxY;

    for (const rm of regMarks) {
      if (rm.x - REG_RADIUS_MM < boundMinX) boundMinX = rm.x - REG_RADIUS_MM;
      if (rm.x + REG_RADIUS_MM > boundMaxX) boundMaxX = rm.x + REG_RADIUS_MM;
      if (rm.y - REG_RADIUS_MM < boundMinY) boundMinY = rm.y - REG_RADIUS_MM;
      if (rm.y + REG_RADIUS_MM > boundMaxY) boundMaxY = rm.y + REG_RADIUS_MM;
    }

    const artMinX = boundMinX - ARTBOARD_MARGIN_MM;
    const artMaxX = boundMaxX + ARTBOARD_MARGIN_MM;
    const artMinY = boundMinY - ARTBOARD_MARGIN_MM;
    const artMaxY = boundMaxY + ARTBOARD_MARGIN_MM;

    const totalWidthMm = artMaxX - artMinX;
    const totalHeightMm = artMaxY - artMinY;
    const totalWidthPt = (totalWidthMm * MM_TO_PT).toFixed(3);
    const totalHeightPt = (totalHeightMm * MM_TO_PT).toFixed(3);

    // Helper to transform CAD mm (x, y) to Illustrator PostScript pt (X, Y)
    // PostScript Y is inverted (0 at bottom, increasing upwards)
    const toPtX = (x: number): string => ((x - artMinX) * MM_TO_PT).toFixed(4);
    const toPtY = (y: number): string => ((artMaxY - y) * MM_TO_PT).toFixed(4);

    let ai = `%!PS-Adobe-3.0\n`;
    ai += `%%Creator: Adobe Illustrator(R) 8.0 DielineForge ZCC Engine\n`;
    ai += `%%AI8_CreatorVersion: 8.0\n`;
    ai += `%%For: (Zund Cut Center - ${escapePs(project.name)})\n`;
    ai += `%%Title: (${escapePs(project.jobNumber)}_${escapePs(project.templateId)}_Zund.ai)\n`;
    ai += `%%CreationDate: (${new Date().toISOString()})\n`;
    ai += `%%BoundingBox: 0 0 ${Math.ceil(Number(totalWidthPt))} ${Math.ceil(Number(totalHeightPt))}\n`;
    ai += `%%HiResBoundingBox: 0 0 ${totalWidthPt} ${totalHeightPt}\n`;
    ai += `%%DocumentProcessColors: Cyan Magenta Yellow Black\n`;
    ai += `%%DocumentCustomColors: \n`;
    ai += `%%CMYKCustomColor: \n`;
    ai += `%%DocumentSuppliedResources: procset Adobe_level2_AI5 1.2 0\n`;
    ai += `%%+ procset Adobe_typography_AI5 1.0 1\n`;
    ai += `%%+ procset Adobe_Illustrator_AI5 1.3 0\n`;
    ai += `%AI5_FileFormat 3\n`;
    ai += `%%EndComments\n`;
    ai += `%%BeginProlog\n`;
    ai += `%%EndProlog\n`;
    ai += `%%BeginSetup\n`;
    ai += `%%EndSetup\n`;

    // ----------------------------------------------------
    // LAYER 1: crease
    // ----------------------------------------------------
    ai += `%AI5_BeginLayer\n`;
    ai += `1 1 1 1 0 0 0 79 128 255 Lb\n`;
    ai += `(crease) Ln\n`;
    ai += `0 J 0 j 1.0 w [] 0 d\n`; // Stroke settings
    ai += `0 0 1 0 k\n`; // Cyan / Blue crease color
    for (const l of creaseLines) {
      ai += `${toPtX(l.x1)} ${toPtY(l.y1)} m\n`;
      ai += `${toPtX(l.x2)} ${toPtY(l.y2)} l\n`;
      ai += `S\n`;
    }
    ai += `LB\n`;

    // ----------------------------------------------------
    // LAYER 2: cut
    // ----------------------------------------------------
    ai += `%AI5_BeginLayer\n`;
    ai += `1 1 1 1 0 0 0 255 79 79 Lb\n`;
    ai += `(cut) Ln\n`;
    ai += `0 J 0 j 1.0 w [] 0 d\n`;
    ai += `0 1 1 0 k\n`; // Magenta / Red cut color
    for (const l of cutLines) {
      ai += `${toPtX(l.x1)} ${toPtY(l.y1)} m\n`;
      ai += `${toPtX(l.x2)} ${toPtY(l.y2)} l\n`;
      ai += `S\n`;
    }
    ai += `LB\n`;

    // ----------------------------------------------------
    // LAYER 3: reg (4 Registration Dots in the 4 corners of the box)
    // ----------------------------------------------------
    ai += `%AI5_BeginLayer\n`;
    ai += `1 1 1 1 0 0 0 0 0 0 Lb\n`;
    ai += `(reg) Ln\n`;
    ai += `0 0 0 1 K\n`; // Solid 100% Black fill
    ai += `0 0 0 1 k\n`; // Solid 100% Black stroke
    ai += `0.5 w\n`;
    const rPt = REG_RADIUS_MM * MM_TO_PT;
    const kPt = rPt * 0.55228475; // Bezier kappa for circle

    for (const rm of regMarks) {
      const cx = (rm.x - artMinX) * MM_TO_PT;
      const cy = (artMaxY - rm.y) * MM_TO_PT;

      // Draw solid filled circle
      ai += `${(cx + rPt).toFixed(4)} ${cy.toFixed(4)} m\n`;
      ai += `${(cx + rPt).toFixed(4)} ${(cy + kPt).toFixed(4)} ${(cx + kPt).toFixed(4)} ${(cy + rPt).toFixed(4)} ${cx.toFixed(4)} ${(cy + rPt).toFixed(4)} c\n`;
      ai += `${(cx - kPt).toFixed(4)} ${(cy + rPt).toFixed(4)} ${(cx - rPt).toFixed(4)} ${(cy + kPt).toFixed(4)} ${(cx - rPt).toFixed(4)} ${cy.toFixed(4)} c\n`;
      ai += `${(cx - rPt).toFixed(4)} ${(cy - kPt).toFixed(4)} ${(cx - kPt).toFixed(4)} ${(cy - rPt).toFixed(4)} ${cx.toFixed(4)} ${(cy - rPt).toFixed(4)} c\n`;
      ai += `${(cx + kPt).toFixed(4)} ${(cy - rPt).toFixed(4)} ${(cx + rPt).toFixed(4)} ${(cy - kPt).toFixed(4)} ${(cx + rPt).toFixed(4)} ${cy.toFixed(4)} c\n`;
      ai += `f\n`; // Fill circle
    }
    ai += `LB\n`;

    ai += `%%Trailer\n`;
    ai += `%%EOF\n`;

    return ai;
  }

  /**
   * Generates standard AutoCAD R12 DXF with exact millimeter coordinates and dedicated layers.
   */
  static exportDXF(
    geometry: DielineGeometry,
    project: ProjectData,
    material: MaterialProfile,
    options: ExportOptions
  ): string {
    let dxf = '';
    
    // DXF Header
    dxf += '0\nSECTION\n2\nHEADER\n';
    dxf += '9\n$ACADVER\n1\nAC1009\n'; // AutoCAD R12 ASCII
    dxf += '9\n$INSUNITS\n70\n4\n'; // 4 = Millimeters
    dxf += '0\nENDSEC\n';

    // DXF Tables & Layers
    dxf += '0\nSECTION\n2\nTABLES\n';
    dxf += '0\nTABLE\n2\nLAYER\n70\n4\n';
    
    // Layer CUT (Color 1: Red)
    dxf += '0\nLAYER\n2\nCUT\n70\n0\n62\n1\n6\nCONTINUOUS\n';
    // Layer CREASE (Color 5: Blue)
    dxf += '0\nLAYER\n2\nCREASE\n70\n0\n62\n5\n6\nDASHED\n';
    // Layer PERF (Color 3: Green)
    dxf += '0\nLAYER\n2\nPERF\n70\n0\n62\n3\n6\nDOT\n';
    // Layer REGISTRATION (Color 7: White/Black)
    dxf += '0\nLAYER\n2\nREGISTRATION\n70\n0\n62\n7\n6\nCONTINUOUS\n';
    
    dxf += '0\nENDTAB\n';
    dxf += '0\nENDSEC\n';

    // DXF Entities
    dxf += '0\nSECTION\n2\nENTITIES\n';

    for (const l of geometry.lines) {
      if (l.type === 'CUT' && !options.layers.CUT) continue;
      if (l.type === 'CREASE' && !options.layers.CREASE) continue;
      if (l.type === 'PERF' && !options.layers.PERF) continue;

      const layerName = l.type === 'CUT' ? 'CUT' : (l.type === 'CREASE' ? 'CREASE' : 'PERF');

      dxf += '0\nLINE\n';
      dxf += `8\n${layerName}\n`;
      dxf += `10\n${l.p1.x.toFixed(4)}\n`; // X1
      dxf += `20\n${(-l.p1.y).toFixed(4)}\n`; // Y1 (CAD Y-axis inverted)
      dxf += `30\n0.0\n`;
      dxf += `11\n${l.p2.x.toFixed(4)}\n`; // X2
      dxf += `21\n${(-l.p2.y).toFixed(4)}\n`; // Y2
      dxf += `31\n0.0\n`;
    }

    dxf += '0\nENDSEC\n';
    dxf += '0\nEOF\n';

    return dxf;
  }

  /**
   * Generates layered vector PDF or production ticket PDF.
   */
  static exportPDF(
    geometry: DielineGeometry,
    project: ProjectData,
    material: MaterialProfile,
    options: ExportOptions,
    nestingSolution?: NestingSolution,
    sheetPreset?: SheetPreset
  ): Uint8Array {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a3'
    });

    const isNesting = options.selectedSheetIndex >= 0 && nestingSolution && sheetPreset;

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(20, 20, 20);
    doc.text(`DIELINEFORGE PRODUCTION SPECIFICATION — ${project.name}`, 15, 15);

    // Job specs bar
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Job #: ${project.jobNumber} | Customer: ${project.customerName} | Material: ${material.name} (${material.thickness}mm) | Tool: ${material.zundModule} / ${material.recommendedKnife}`, 15, 22);
    doc.text(`Generated: ${new Date().toLocaleString()} | Units: mm | Scale: 100% Production Vector`, 15, 27);

    // Legend
    doc.setDrawColor(225, 29, 72); // Red
    doc.setLineWidth(0.6);
    doc.line(280, 14, 295, 14);
    doc.setTextColor(40, 40, 40);
    doc.text('CUT', 298, 15);

    doc.setDrawColor(37, 99, 235); // Blue
    doc.line(320, 14, 335, 14);
    doc.text('CREASE', 338, 15);

    doc.setDrawColor(5, 150, 105); // Green
    doc.line(360, 14, 375, 14);
    doc.text('PERF', 378, 15);

    // Draw Vector Geometry
    const canvasOffsetX = 20;
    const canvasOffsetY = 38;
    const maxDrawWidth = 380;
    const maxDrawHeight = 240;

    const sourceW = isNesting ? sheetPreset.width : geometry.bounds.width;
    const sourceH = isNesting ? sheetPreset.height : geometry.bounds.height;
    const scale = Math.min(maxDrawWidth / sourceW, maxDrawHeight / sourceH) * 0.95;

    if (isNesting && nestingSolution) {
      const sheet = nestingSolution.sheets[options.selectedSheetIndex] || nestingSolution.sheets[0];

      // Draw Sheet boundary
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.4);
      doc.rect(canvasOffsetX, canvasOffsetY, sheetPreset.width * scale, sheetPreset.height * scale);

      // Draw items
      for (const item of sheet.items) {
        const rad = (item.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        for (const l of geometry.lines) {
          const lx1 = l.p1.x - geometry.bounds.minX;
          const ly1 = l.p1.y - geometry.bounds.minY;
          const lx2 = l.p2.x - geometry.bounds.minX;
          const ly2 = l.p2.y - geometry.bounds.minY;

          const rx1 = canvasOffsetX + (lx1 * cos - ly1 * sin + item.x) * scale;
          const ry1 = canvasOffsetY + (lx1 * sin + ly1 * cos + item.y) * scale;
          const rx2 = canvasOffsetX + (lx2 * cos - ly2 * sin + item.x) * scale;
          const ry2 = canvasOffsetY + (lx2 * sin + ly2 * cos + item.y) * scale;

          if (l.type === 'CUT') {
            doc.setDrawColor(225, 29, 72);
            doc.setLineWidth(0.3);
            doc.line(rx1, ry1, rx2, ry2);
          } else if (l.type === 'CREASE') {
            doc.setDrawColor(37, 99, 235);
            doc.setLineWidth(0.25);
            doc.line(rx1, ry1, rx2, ry2);
          }
        }
      }

      // Summary Card Bottom Right
      doc.setFillColor(245, 245, 247);
      doc.rect(15, 260, 390, 20, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.text(`Sheet Yield: ${sheet.itemCount} packages | Sheet Utilization: ${sheet.utilizationPercent}% | Waste: ${sheet.wastePercent}% | Sheets Required: ${nestingSolution.sheetsRequired} | Order Qty: ${nestingSolution.totalPiecesRequired}`, 20, 272);

    } else {
      // Draw single dieline
      for (const l of geometry.lines) {
        const x1 = canvasOffsetX + (l.p1.x - geometry.bounds.minX) * scale;
        const y1 = canvasOffsetY + (l.p1.y - geometry.bounds.minY) * scale;
        const x2 = canvasOffsetX + (l.p2.x - geometry.bounds.minX) * scale;
        const y2 = canvasOffsetY + (l.p2.y - geometry.bounds.minY) * scale;

        if (l.type === 'CUT') {
          doc.setDrawColor(225, 29, 72);
          doc.setLineWidth(0.4);
          doc.line(x1, y1, x2, y2);
        } else if (l.type === 'CREASE') {
          doc.setDrawColor(37, 99, 235);
          doc.setLineWidth(0.3);
          doc.line(x1, y1, x2, y2);
        }
      }

      // Stats
      doc.setFillColor(245, 245, 247);
      doc.rect(15, 260, 390, 20, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.text(`Flat Dieline Size: ${geometry.bounds.width.toFixed(1)} × ${geometry.bounds.height.toFixed(1)} mm | Total Cut Length: ${(geometry.totalCutLength / 1000).toFixed(2)} m | Total Crease Length: ${(geometry.totalCreaseLength / 1000).toFixed(2)} m`, 20, 272);
    }

    return doc.output('arraybuffer') as unknown as Uint8Array;
  }
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function escapePs(str: string): string {
  if (!str) return '';
  return str.replace(/[\\()]/g, '\\$&');
}
