export type LineType = 
  | 'CUT'
  | 'CREASE'
  | 'PERF'
  | 'PARTIAL_CUT'
  | 'BLEED'
  | 'ARTWORK'
  | 'REGISTRATION'
  | 'DIMENSION'
  | 'SAFETY'
  | 'OFFCUT';

export interface Point2D {
  x: number;
  y: number;
}

export interface LineSegment {
  id: string;
  type: LineType;
  p1: Point2D;
  p2: Point2D;
  label?: string;
  isDriving?: boolean;
}

export interface ArcSegment {
  id: string;
  type: LineType;
  center: Point2D;
  radius: number;
  startAngle: number; // in radians
  endAngle: number;
  label?: string;
}

export interface DimensionAnnotation {
  id: string;
  paramKey?: string;
  type: 'horizontal' | 'vertical' | 'aligned' | 'radius';
  p1: Point2D;
  p2: Point2D;
  offset: number;
  value: number; // in mm
  label: string;
  isDriving: boolean;
}

export interface PanelGeometry {
  id: string;
  name: string;
  polygon: Point2D[];
  creaseConnections: { targetPanelId: string; foldAngleDeg: number; foldAxis: [Point2D, Point2D] }[];
  center: Point2D;
  width: number;
  height: number;
}

export interface DielineGeometry {
  lines: LineSegment[];
  arcs: ArcSegment[];
  dimensions: DimensionAnnotation[];
  panels: PanelGeometry[];
  outerContour: Point2D[]; // For true-shape nesting collision hull
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
    area: number; // approximate bounding area mm²
    trueArea: number; // net polygon area mm²
  };
  totalCutLength: number; // mm
  totalCreaseLength: number; // mm
  totalPerfLength: number; // mm
}

export interface TemplateParam {
  key: string;
  label: string;
  category: 'primary' | 'flaps' | 'material' | 'advanced';
  value: number;
  min: number;
  max: number;
  step: number;
  unit: 'mm' | 'in' | 'deg';
  description?: string;
}

export type TemplateCategory = 
  | 'shipping'
  | 'mailer'
  | 'folding_carton'
  | 'tray'
  | 'sleeve'
  | 'novelty'
  | 'display';

export interface TemplateDefinition {
  id: string;
  name: string;
  code: string; // FEFCO or industry code e.g. FEFCO 0201
  category: TemplateCategory;
  description: string;
  recommendedMaterial: string;
  defaultParams: Record<string, number>;
  paramsList: TemplateParam[];
  previewSvgSnippet?: string;
  panelCount: number;
}

export interface LayerVisibility {
  CUT: boolean;
  CREASE: boolean;
  PERF: boolean;
  PARTIAL_CUT: boolean;
  BLEED: boolean;
  REGISTRATION: boolean;
  DIMENSIONS: boolean;
  ARTWORK: boolean;
  GRID: boolean;
  PANEL_FILL: boolean;
}
