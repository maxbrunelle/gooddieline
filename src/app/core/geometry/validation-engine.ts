import { DielineGeometry, LineSegment } from '../models/dieline.models';
import { MaterialProfile } from '../models/material.models';
import { ProductionValidationError, ProductionValidationReport } from '../models/project.models';
import { NestingSolution, SheetPreset } from '../models/sheet.models';

export class ValidationEngine {
  static validateDieline(
    geometry: DielineGeometry, 
    material: MaterialProfile,
    sheetPreset?: SheetPreset,
    nestingSolution?: NestingSolution
  ): ProductionValidationReport {
    const errors: ProductionValidationError[] = [];
    let passedCount = 0;
    const totalChecks = 8;

    // Check 1: Zero-length lines or degenerate elements
    let zeroLengthCount = 0;
    for (const l of geometry.lines) {
      const len = Math.hypot(l.p2.x - l.p1.x, l.p2.y - l.p1.y);
      if (len < 0.05) {
        zeroLengthCount++;
      }
    }
    if (zeroLengthCount > 0) {
      errors.push({
        id: 'val_zero_length',
        severity: 'warning',
        category: 'geometry',
        message: `Found ${zeroLengthCount} micro/zero-length line segment(s) (<0.05mm).`,
        suggestedAction: 'Auto-prune redundant vertex points before sending to cutting table.'
      });
    } else {
      passedCount++;
    }

    // Check 2: Minimum Crease Spacing according to material specification
    const creases = geometry.lines.filter(l => l.type === 'CREASE');
    let minCreaseViolation = false;
    for (let i = 0; i < creases.length; i++) {
      for (let j = i + 1; j < creases.length; j++) {
        // If parallel and close
        const dist = this.minLineDistance(creases[i], creases[j]);
        if (dist > 0.01 && dist < material.minCreaseSpacing * 0.8) {
          minCreaseViolation = true;
          break;
        }
      }
      if (minCreaseViolation) break;
    }
    if (minCreaseViolation) {
      errors.push({
        id: 'val_crease_spacing',
        severity: 'warning',
        category: 'material',
        message: `Crease spacing is narrower than recommended minimum (${material.minCreaseSpacing}mm) for ${material.name}.`,
        suggestedAction: `Increase panel distance or select a thinner material/smaller crease wheel (${material.recommendedCreaseWheel}).`
      });
    } else {
      passedCount++;
    }

    // Check 3: Dimension Validity & Non-negativity
    if (geometry.bounds.width <= 10 || geometry.bounds.height <= 10) {
      errors.push({
        id: 'val_min_dim',
        severity: 'error',
        category: 'geometry',
        message: 'Dieline dimensions are too small (<10mm) for digital tool processing.',
        suggestedAction: 'Increase box length, width, or height.'
      });
    } else {
      passedCount++;
    }

    // Check 4: Check if total cut lines form closed structure
    const cutLines = geometry.lines.filter(l => l.type === 'CUT');
    if (cutLines.length < 4) {
      errors.push({
        id: 'val_cut_count',
        severity: 'error',
        category: 'geometry',
        message: 'Insufficient perimeter cut lines generated.',
        suggestedAction: 'Verify parametric variables and redraw.'
      });
    } else {
      passedCount++;
    }

    // Check 5: Sheet Fit Check (Single Package vs Sheet bed)
    if (sheetPreset) {
      if (geometry.bounds.width > sheetPreset.width || geometry.bounds.height > sheetPreset.height) {
        if (geometry.bounds.height > sheetPreset.width || geometry.bounds.width > sheetPreset.height) {
          errors.push({
            id: 'val_sheet_overflow',
            severity: 'error',
            category: 'zund_production',
            message: `Single dieline (${geometry.bounds.width.toFixed(0)} × ${geometry.bounds.height.toFixed(0)} mm) exceeds maximum sheet dimensions (${sheetPreset.width.toFixed(0)} × ${sheetPreset.height.toFixed(0)} mm).`,
            suggestedAction: 'Select a larger stock sheet preset (e.g., 48 × 96 in) or scale down package dimensions.'
          });
        } else {
          passedCount++;
        }
      } else {
        passedCount++;
      }
    } else {
      passedCount++;
    }

    // Check 6: Nesting Collisions
    if (nestingSolution && nestingSolution.sheets.length > 0) {
      const activeSheet = nestingSolution.sheets[0];
      const collidingPieces = activeSheet.items.filter(it => it.colliding);
      if (collidingPieces.length > 0) {
        errors.push({
          id: 'val_nesting_collision',
          severity: 'error',
          category: 'nesting',
          message: `${collidingPieces.length} nested piece(s) have boundary collisions or overlap adjacent items.`,
          suggestedAction: 'Click "Auto Nest" or manually drag colliding pieces inside sheet boundaries.'
        });
      } else {
        passedCount++;
      }
    } else {
      passedCount++;
    }

    // Check 7: Zünd Registration Mark Clearance
    if (nestingSolution && nestingSolution.sheets.length > 0) {
      const activeSheet = nestingSolution.sheets[0];
      if (activeSheet.registrationMarks.length < 4) {
        errors.push({
          id: 'val_reg_marks',
          severity: 'warning',
          category: 'zund_production',
          message: 'Less than 4 optical registration marks generated for Zünd ICC camera detection.',
          suggestedAction: 'Enable Zünd registration marks in the Nesting settings panel.'
        });
      } else {
        passedCount++;
      }
    } else {
      passedCount++;
    }

    // Check 8: Knife module and thickness compatibility
    if (material.thickness > 5.0 && material.zundModule === 'UCT') {
      errors.push({
        id: 'val_tool_mismatch',
        severity: 'warning',
        category: 'material',
        message: `Material thickness (${material.thickness}mm) is too high for Universal Cutting Tool (UCT).`,
        suggestedAction: 'Switch to Pneumatic Oscillating Tool (POT) or V-Cut Tool (VCT).'
      });
    } else {
      passedCount++;
    }

    const hasErrors = errors.some(e => e.severity === 'error');

    return {
      isValidForProduction: !hasErrors,
      canOverride: true,
      errors,
      passedChecksCount: passedCount,
      totalChecksCount: totalChecks
    };
  }

  private static minLineDistance(l1: LineSegment, l2: LineSegment): number {
    // Quick center-to-center distance approx
    const c1 = { x: (l1.p1.x + l1.p2.x) / 2, y: (l1.p1.y + l1.p2.y) / 2 };
    const c2 = { x: (l2.p1.x + l2.p2.x) / 2, y: (l2.p1.y + l2.p2.y) / 2 };
    return Math.hypot(c2.x - c1.x, c2.y - c1.y);
  }
}
