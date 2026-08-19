import { Point2D } from './dieline.models';

export interface SheetPreset {
  id: string;
  name: string;
  width: number; // in mm
  height: number; // in mm
  displayDimensions: string; // e.g. "48 × 96 in (1219 × 2438 mm)"
  costPerSheet?: number;
  isCustom?: boolean;
}

export const SEED_SHEETS: SheetPreset[] = [
  {
    id: 'sheet_48x96',
    name: 'Standard Industrial Sheet 48 × 96 in',
    width: 2438.4,
    height: 1219.2,
    displayDimensions: '48 × 96 in (1219 × 2438 mm)',
    costPerSheet: 12.50
  },
  {
    id: 'sheet_40x60',
    name: 'Display Sheet 40 × 60 in',
    width: 1524.0,
    height: 1016.0,
    displayDimensions: '40 × 60 in (1016 × 1524 mm)',
    costPerSheet: 7.80
  },
  {
    id: 'sheet_32x48',
    name: 'Medium Bed 32 × 48 in',
    width: 1219.2,
    height: 812.8,
    displayDimensions: '32 × 48 in (813 × 1219 mm)',
    costPerSheet: 5.20
  },
  {
    id: 'sheet_24x36',
    name: 'Compact Cut Bed 24 × 36 in',
    width: 914.4,
    height: 609.6,
    displayDimensions: '24 × 36 in (610 × 914 mm)',
    costPerSheet: 3.40
  },
  {
    id: 'sheet_54x96',
    name: 'Wide Format 54 × 96 in',
    width: 2438.4,
    height: 1371.6,
    displayDimensions: '54 × 96 in (1372 × 2438 mm)',
    costPerSheet: 14.80
  },
  {
    id: 'sheet_b1_plus',
    name: 'B1+ Packaging Sheet (720 × 1020 mm)',
    width: 1020.0,
    height: 720.0,
    displayDimensions: '720 × 1020 mm (28.3 × 40.2 in)',
    costPerSheet: 4.10
  },
  {
    id: 'sheet_b0',
    name: 'B0 Press Sheet (1000 × 1414 mm)',
    width: 1414.0,
    height: 1000.0,
    displayDimensions: '1000 × 1414 mm (39.4 × 55.7 in)',
    costPerSheet: 6.90
  }
];

export type RotationRule = 'NONE' | '90_DEG' | '180_DEG' | 'ANY' | 'GRAIN_ALIGNED';
export type FluteConstraint = 'HORIZONTAL' | 'VERTICAL' | 'UNCONSTRAINED';

export interface NestingConfig {
  sheetWidth: number; // mm
  sheetHeight: number; // mm
  marginEdge: number; // mm from sheet perimeter
  itemSpacing: number; // mm between adjacent dielines
  rotationRule: RotationRule;
  fluteConstraint: FluteConstraint;
  allowInterlocking: boolean;
  enableCommonLineCutting: boolean;
  orderQuantity: number;
  includeRegistrationMarks: boolean;
  regMarkSize: number; // mm (typically 6mm for Zünd ICC camera)
  regMarkOffset: number; // mm from sheet edge
  regMarkCount: number; // typically 4 or 6
}

export interface NestedItem {
  id: string;
  pieceIndex: number;
  x: number; // in sheet mm (top-left or center based)
  y: number;
  rotation: number; // in degrees: 0, 90, 180, 270
  isLocked: boolean;
  isMirrored?: boolean;
  width: number;
  height: number;
  polygon: Point2D[];
  colliding?: boolean;
}

export interface OffcutRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  area: number; // mm²
}

export interface SheetLayout {
  sheetIndex: number;
  items: NestedItem[];
  itemCount: number;
  usedArea: number; // mm²
  sheetArea: number; // mm²
  utilizationPercent: number; // %
  wastePercent: number; // %
  wasteArea: number; // mm²
  offcuts: OffcutRect[];
  registrationMarks: Point2D[];
  isFullSheet: boolean;
}

export interface NestingSolution {
  id: string;
  name: string;
  algorithmName: string;
  totalPiecesRequired: number;
  piecesPerSheet: number;
  sheetsRequired: number;
  totalFullSheets: number;
  partialSheetPieces: number;
  overallUtilization: number;
  overallWaste: number;
  totalMaterialAreaSqM: number;
  estimatedMaterialCost: number;
  estimatedCutTimeSeconds: number;
  sheets: SheetLayout[];
  recommended?: boolean;
}
