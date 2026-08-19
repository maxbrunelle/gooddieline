import { NestingConfig } from './sheet.models';

export interface ProductionValidationError {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category: 'geometry' | 'nesting' | 'zund_production' | 'material';
  message: string;
  suggestedAction: string;
  location?: { x: number; y: number };
}

export interface ProductionValidationReport {
  isValidForProduction: boolean;
  canOverride: boolean;
  errors: ProductionValidationError[];
  passedChecksCount: number;
  totalChecksCount: number;
}

export interface ProjectData {
  id: string;
  name: string;
  customerName: string;
  jobNumber: string;
  sku: string;
  createdDate: string;
  modifiedDate: string;
  notes: string;
  
  // Active template configuration
  templateId: string;
  params: Record<string, number>;
  
  // Active material
  materialId: string;
  
  // Sheet & Nesting
  sheetId: string;
  nestingConfig: NestingConfig;
  orderQuantity: number;
  
  // Artwork Layer
  artworkSvgData?: string;
  artworkFilename?: string;
  artworkOpacity?: number;
}

export interface SavedProjectItem {
  id: string;
  name: string;
  jobNumber: string;
  customerName: string;
  templateId: string;
  templateName: string;
  materialName: string;
  sheetDimensions: string;
  dimensionsSummary: string;
  savedAt: string;
  projectData: ProjectData;
}

export interface WorkspacePreferences {
  unit: 'mm' | 'in' | 'cm';
  isDarkMode: boolean;
  foldPercentage: number;
  autoRotate3D: boolean;
  activeTab: string;
}

export interface ExportOptions {
  format: 'PDF' | 'SVG' | 'DXF' | 'REPORT_PDF' | 'AI';
  units: 'mm' | 'in';
  scale: number; // 1.0 = 100%
  layers: {
    CUT: boolean;
    CREASE: boolean;
    PERF: boolean;
    PARTIAL_CUT: boolean;
    BLEED: boolean;
    ARTWORK: boolean;
    REGISTRATION: boolean;
    DIMENSIONS: boolean;
    SHEET_BOUNDARY: boolean;
  };
  includeZundBarcodes: boolean;
  includeJobHeader: boolean;
  commonLineOptimized: boolean;
  zundRegistrationMarks: boolean;
  selectedSheetIndex: number; // 0 for sheet 1, -1 for all sheets
}
