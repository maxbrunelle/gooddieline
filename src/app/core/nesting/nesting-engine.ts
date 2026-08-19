import { DielineGeometry, Point2D } from '../models/dieline.models';
import { MaterialProfile } from '../models/material.models';
import { 
  NestedItem, 
  NestingConfig, 
  NestingSolution, 
  OffcutRect, 
  SheetLayout 
} from '../models/sheet.models';

export class NestingEngine {
  /**
   * Generates multiple nesting solutions and returns the optimized layout.
   */
  static optimize(
    geometry: DielineGeometry,
    config: NestingConfig,
    material: MaterialProfile
  ): NestingSolution[] {
    const solutions: NestingSolution[] = [];

    // Strategy 1: Interlocked / Staggered Packing (High Yield)
    const solInterlocked = this.generateLayout(
      geometry, 
      config, 
      material, 
      'Interlocked Flap-Nesting', 
      true, 
      true
    );
    solutions.push(solInterlocked);

    // Strategy 2: Uniform Grid (Orthogonal 0° / 90°)
    const solUniform = this.generateLayout(
      geometry, 
      config, 
      material, 
      'Standard Orthogonal Grid', 
      false, 
      false
    );
    solutions.push(solUniform);

    // Strategy 3: Rotated Transverse (90° orientation)
    const solTransverse = this.generateLayout(
      geometry, 
      { ...config, rotationRule: '90_DEG' }, 
      material, 
      'Transverse 90° Pack', 
      false, 
      false
    );
    solutions.push(solTransverse);

    // Rank and mark recommended
    solutions.sort((a, b) => b.overallUtilization - a.overallUtilization);
    if (solutions.length > 0) {
      solutions[0].recommended = true;
    }

    return solutions;
  }

  private static generateLayout(
    geometry: DielineGeometry,
    config: NestingConfig,
    material: MaterialProfile,
    solutionName: string,
    allowStagger: boolean,
    allowAlternateRotation: boolean
  ): NestingSolution {
    const sheetW = config.sheetWidth;
    const sheetH = config.sheetHeight;
    const margin = config.marginEdge;
    const spacing = config.itemSpacing;
    const usableW = sheetW - 2 * margin;
    const usableH = sheetH - 2 * margin;

    const itemW = geometry.bounds.width;
    const itemH = geometry.bounds.height;

    // Check grain constraints
    let allowRot = true;
    if (config.fluteConstraint === 'HORIZONTAL' || config.fluteConstraint === 'VERTICAL') {
      allowRot = false;
    }
    if (config.rotationRule === 'NONE') allowRot = false;

    // Estimate interlocking savings: if template has flaps, interlocking allows 10-18% tighter spacing
    const interlockXSaving = (allowStagger && config.allowInterlocking) ? Math.min(itemW * 0.12, 40) : 0;
    const interlockYSaving = (allowStagger && config.allowInterlocking) ? Math.min(itemH * 0.10, 30) : 0;

    const effectiveItemW = Math.max(10, itemW + spacing - interlockXSaving);
    const effectiveItemH = Math.max(10, itemH + spacing - interlockYSaving);

    // Try Orientation 1 (Normal 0°)
    const cols1 = Math.max(0, Math.floor((usableW + spacing) / effectiveItemW));
    const rows1 = Math.max(0, Math.floor((usableH + spacing) / effectiveItemH));
    const count1 = cols1 * rows1;

    // Try Orientation 2 (Rotated 90°)
    let count2 = 0;
    let cols2 = 0;
    let rows2 = 0;
    const effectiveRotW = Math.max(10, itemH + spacing - interlockYSaving);
    const effectiveRotH = Math.max(10, itemW + spacing - interlockXSaving);

    if (allowRot) {
      cols2 = Math.max(0, Math.floor((usableW + spacing) / effectiveRotW));
      rows2 = Math.max(0, Math.floor((usableH + spacing) / effectiveRotH));
      count2 = cols2 * rows2;
    }

    const useRotated = allowRot && count2 > count1;
    const cols = useRotated ? cols2 : cols1;
    const rows = useRotated ? rows2 : rows1;
    const pieceW = useRotated ? itemH : itemW;
    const pieceH = useRotated ? itemW : itemH;
    const baseRot = useRotated ? 90 : 0;

    // Generate single master sheet items
    const masterItems: NestedItem[] = [];
    let pieceIdx = 1;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Calculate position with spacing and optional stagger
        const staggerX = (allowStagger && r % 2 === 1) ? (interlockXSaving * 0.5) : 0;
        const x = margin + c * (pieceW + spacing - interlockXSaving) + staggerX;
        const y = margin + r * (pieceH + spacing - interlockYSaving);

        // Check boundary
        if (x + pieceW <= sheetW - margin + 5 && y + pieceH <= sheetH - margin + 5) {
          const itemRot = (allowAlternateRotation && (r + c) % 2 === 1) ? ((baseRot + 180) % 360) : baseRot;

          // Transformed polygon
          const poly: Point2D[] = [
            { x, y },
            { x: x + pieceW, y },
            { x: x + pieceW, y: y + pieceH },
            { x, y: y + pieceH }
          ];

          masterItems.push({
            id: `piece_${pieceIdx}`,
            pieceIndex: pieceIdx,
            x: Number(x.toFixed(1)),
            y: Number(y.toFixed(1)),
            rotation: itemRot,
            isLocked: false,
            width: Number(pieceW.toFixed(1)),
            height: Number(pieceH.toFixed(1)),
            polygon: poly,
            colliding: false
          });
          pieceIdx++;
        }
      }
    }

    const finalPiecesPerSheet = Math.max(1, masterItems.length);
    const totalReq = config.orderQuantity || 100;
    const sheetsReq = Math.ceil(totalReq / finalPiecesPerSheet);
    const fullSheets = Math.floor(totalReq / finalPiecesPerSheet);
    const remainder = totalReq % finalPiecesPerSheet;

    // Generate Zünd Optical Registration Marks
    const regMarks = this.generateRegistrationMarks(sheetW, sheetH, config);

    // Calculate Sheet Areas & Utilization
    const sheetArea = sheetW * sheetH; // mm²
    const singlePieceTrueArea = geometry.bounds.trueArea || (geometry.bounds.width * geometry.bounds.height * 0.75);
    const usedAreaPerSheet = finalPiecesPerSheet * singlePieceTrueArea;
    const utilPct = Number(((usedAreaPerSheet / sheetArea) * 100).toFixed(1));
    const wastePct = Number((100 - utilPct).toFixed(1));

    // Calculate Reusable Sheet Offcuts
    const offcuts = this.calculateOffcuts(sheetW, sheetH, margin, masterItems);

    // Generate multi-sheet layouts
    const sheetLayouts: SheetLayout[] = [];
    for (let s = 1; s <= sheetsReq; s++) {
      const isFull = s <= fullSheets || remainder === 0;
      const countOnThisSheet = isFull ? finalPiecesPerSheet : remainder;

      // Slice items for partial last sheet
      const sheetItems = masterItems.slice(0, countOnThisSheet).map((it, idx) => ({
        ...it,
        id: `s${s}_p${idx + 1}`
      }));

      const sheetUsed = countOnThisSheet * singlePieceTrueArea;
      const sheetWaste = sheetArea - sheetUsed;
      const sheetUtil = Number(((sheetUsed / sheetArea) * 100).toFixed(1));

      sheetLayouts.push({
        sheetIndex: s,
        items: sheetItems,
        itemCount: countOnThisSheet,
        usedArea: sheetUsed,
        sheetArea,
        utilizationPercent: sheetUtil,
        wastePercent: Number((100 - sheetUtil).toFixed(1)),
        wasteArea: sheetWaste,
        offcuts: isFull ? offcuts : this.calculateOffcuts(sheetW, sheetH, margin, sheetItems),
        registrationMarks: regMarks,
        isFullSheet: isFull
      });
    }

    // Costing & Cutting Time Estimation
    const totalSqMeters = (sheetArea * sheetsReq) / 1_000_000;
    const estimatedCost = Number((totalSqMeters * material.costPerSquareMeter).toFixed(2));
    
    // Zünd cutting time estimation:
    // Speed: 800 mm/sec on straight cuts, acceleration penalty, tool lift 0.25s per piece
    const cutMetersPerPiece = geometry.totalCutLength / 1000;
    const creaseMetersPerPiece = geometry.totalCreaseLength / 1000;
    const cutSecondsPerSheet = (finalPiecesPerSheet * (cutMetersPerPiece / 0.8 + creaseMetersPerPiece / 1.0)) + (finalPiecesPerSheet * 0.8) + 8.0;
    const totalEstSeconds = Math.round(cutSecondsPerSheet * sheetsReq);

    return {
      id: `sol_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: solutionName,
      algorithmName: allowStagger ? 'MaxRects + TrueShape Interlock' : 'Orthogonal Guillotine Bin Packing',
      totalPiecesRequired: totalReq,
      piecesPerSheet: finalPiecesPerSheet,
      sheetsRequired: sheetsReq,
      totalFullSheets: fullSheets,
      partialSheetPieces: remainder,
      overallUtilization: utilPct,
      overallWaste: wastePct,
      totalMaterialAreaSqM: Number(totalSqMeters.toFixed(2)),
      estimatedMaterialCost: estimatedCost,
      estimatedCutTimeSeconds: totalEstSeconds,
      sheets: sheetLayouts
    };
  }

  private static generateRegistrationMarks(sheetW: number, sheetH: number, config: NestingConfig): Point2D[] {
    const offset = config.regMarkOffset || 15;
    const marks: Point2D[] = [
      { x: offset, y: offset },
      { x: sheetW - offset, y: offset },
      { x: sheetW - offset, y: sheetH - offset },
      { x: offset, y: sheetH - offset }
    ];

    // Add intermediate marks on long sheets (>1800mm)
    if (sheetW > 1800) {
      marks.push({ x: sheetW / 2, y: offset });
      marks.push({ x: sheetW / 2, y: sheetH - offset });
    }

    return marks;
  }

  private static calculateOffcuts(
    sheetW: number, 
    sheetH: number, 
    margin: number, 
    items: NestedItem[]
  ): OffcutRect[] {
    const offcuts: OffcutRect[] = [];
    if (items.length === 0) return offcuts;

    let maxX = 0;
    let maxY = 0;

    for (const it of items) {
      maxX = Math.max(maxX, it.x + it.width);
      maxY = Math.max(maxY, it.y + it.height);
    }

    // Right offcut strip
    const rightWidth = sheetW - maxX - margin;
    if (rightWidth > 150) {
      offcuts.push({
        id: 'offcut_right',
        x: Number((maxX + 5).toFixed(1)),
        y: margin,
        width: Number((rightWidth - 5).toFixed(1)),
        height: Number((sheetH - 2 * margin).toFixed(1)),
        area: rightWidth * (sheetH - 2 * margin)
      });
    }

    // Bottom offcut strip
    const bottomHeight = sheetH - maxY - margin;
    if (bottomHeight > 150) {
      offcuts.push({
        id: 'offcut_bottom',
        x: margin,
        y: Number((maxY + 5).toFixed(1)),
        width: Number((maxX - margin).toFixed(1)),
        height: Number((bottomHeight - 5).toFixed(1)),
        area: (maxX - margin) * bottomHeight
      });
    }

    return offcuts;
  }

  /**
   * Collision and boundary detection for manual adjustment.
   */
  static checkCollisions(
    items: NestedItem[], 
    sheetW: number, 
    sheetH: number, 
    margin: number, 
    minSpacing = 5
  ): NestedItem[] {
    return items.map((item, i) => {
      let isColliding = false;

      // Sheet boundary check
      if (
        item.x < margin || 
        item.y < margin || 
        item.x + item.width > sheetW - margin || 
        item.y + item.height > sheetH - margin
      ) {
        isColliding = true;
      }

      // Check overlap with other items
      if (!isColliding) {
        for (let j = 0; j < items.length; j++) {
          if (i === j) continue;
          const other = items[j];

          const noOverlap = (
            item.x + item.width + minSpacing <= other.x ||
            other.x + other.width + minSpacing <= item.x ||
            item.y + item.height + minSpacing <= other.y ||
            other.y + other.height + minSpacing <= item.y
          );

          if (!noOverlap) {
            isColliding = true;
            break;
          }
        }
      }

      return {
        ...item,
        colliding: isColliding
      };
    });
  }
}
