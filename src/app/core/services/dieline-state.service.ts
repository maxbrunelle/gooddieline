import { computed, inject, Injectable, signal } from '@angular/core';
import { ExportEngine } from '../export/export-engine';
import { generateDielineGeometry } from '../geometry/template-generators';
import { TEMPLATE_DEFINITIONS } from '../geometry/template-definitions';
import { ValidationEngine } from '../geometry/validation-engine';
import { DielineGeometry, LayerVisibility, TemplateDefinition } from '../models/dieline.models';
import { MaterialProfile, SEED_MATERIALS } from '../models/material.models';
import { ExportOptions, ProductionValidationReport, ProjectData, SavedProjectItem, WorkspacePreferences } from '../models/project.models';
import { 
  NestedItem, 
  NestingConfig, 
  NestingSolution, 
  SEED_SHEETS, 
  SheetPreset 
} from '../models/sheet.models';
import { NestingEngine } from '../nesting/nesting-engine';
import { StorageService } from './storage.service';

export type WorkspaceTab = 'editor_2d' | 'viewer_3d' | 'nesting' | 'templates' | 'materials' | 'sheets' | 'reports';

const DEFAULT_PROJECT: ProjectData = {
  id: 'proj_default_01',
  name: 'Standard RSC Corrugated Shipping Carton',
  customerName: 'AeroGoods Logistics',
  jobNumber: 'JOB-2026-904',
  sku: 'PKG-BX-300-200',
  createdDate: new Date().toISOString().split('T')[0],
  modifiedDate: new Date().toISOString().split('T')[0],
  notes: 'High yield Zünd cut layout on 48x96 in B-flute. Standard FEFCO 0201 Regular Slotted Carton with 25.4mm glue tab.',
  templateId: 'rsc_carton',
  params: { ...TEMPLATE_DEFINITIONS[0].defaultParams },
  materialId: 'mat_bflute_30',
  sheetId: 'sheet_48x96',
  nestingConfig: {
    sheetWidth: 2438.4,
    sheetHeight: 1219.2,
    marginEdge: 20,
    itemSpacing: 10,
    rotationRule: 'ANY',
    fluteConstraint: 'UNCONSTRAINED',
    allowInterlocking: true,
    enableCommonLineCutting: false,
    orderQuantity: 250,
    includeRegistrationMarks: true,
    regMarkSize: 6,
    regMarkOffset: 25,
    regMarkCount: 4
  },
  orderQuantity: 250
};

@Injectable({
  providedIn: 'root'
})
export class DielineStateService {
  private storage = inject(StorageService);

  // Navigation & UI State
  activeTab = signal<WorkspaceTab>('editor_2d');
  unit = signal<'mm' | 'in' | 'cm'>('mm');
  isDarkMode = signal<boolean>(true);
  isOptimizingNesting = signal<boolean>(false);
  nestingProgress = signal<number>(100);
  
  // 2D Canvas State
  zoom = signal<number>(1.0);
  panOffset = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  selectedPieceId = signal<string | null>(null);
  selectedDimensionKey = signal<string | null>(null);
  activeTool = signal<'select' | 'measure' | 'pan' | 'dimension'>('select');
  layerVisibility = signal<LayerVisibility>({
    CUT: true,
    CREASE: true,
    PERF: true,
    PARTIAL_CUT: true,
    BLEED: true,
    REGISTRATION: true,
    DIMENSIONS: true,
    ARTWORK: true,
    GRID: true,
    PANEL_FILL: true
  });

  // 3D Folding State
  foldPercentage = signal<number>(90); // 0 = flat, 100 = folded box
  autoRotate3D = signal<boolean>(false);

  // Template Catalog
  templates = signal<TemplateDefinition[]>(TEMPLATE_DEFINITIONS);
  activeTemplateId = signal<string>('rsc_carton');

  // Material Library
  materials = signal<MaterialProfile[]>(SEED_MATERIALS);
  activeMaterialId = signal<string>('mat_bflute_30');

  // Sheet Presets
  sheets = signal<SheetPreset[]>(SEED_SHEETS);
  activeSheetId = signal<string>('sheet_48x96');

  // Active Project Data
  project = signal<ProjectData>({ ...DEFAULT_PROJECT });

  // LocalStorage & Projects Library State
  savedProjects = signal<SavedProjectItem[]>([]);
  lastSavedTimestamp = signal<string>('Auto-saved to Browser');
  storageStatus = signal<'saved' | 'saving' | 'idle'>('saved');

  // Nesting State
  selectedSheetIndex = signal<number>(0);
  nestingSolutions = signal<NestingSolution[]>([]);
  activeNestingSolutionIndex = signal<number>(0);
  manualItemsOverride = signal<NestedItem[] | null>(null);

  // History Stack for Undo/Redo
  private history: string[] = [];
  private historyIndex = -1;

  constructor() {
    this.hydrateFromStorage();
    this.pushHistoryState('Initial Project Creation');
    this.recalculateNesting();
  }

  private hydrateFromStorage(): void {
    // 1. Hydrate Custom Materials
    const customMats = this.storage.loadCustomMaterials();
    if (customMats.length > 0) {
      this.materials.set([...SEED_MATERIALS, ...customMats]);
    }

    // 2. Hydrate Custom Sheets
    const customSheets = this.storage.loadCustomSheets();
    if (customSheets.length > 0) {
      this.sheets.set([...SEED_SHEETS, ...customSheets]);
    }

    // 3. Hydrate Preferences
    const prefs = this.storage.loadPreferences();
    if (prefs) {
      if (prefs.unit) this.unit.set(prefs.unit);
      if (prefs.isDarkMode !== undefined) this.isDarkMode.set(prefs.isDarkMode);
      if (prefs.foldPercentage !== undefined) this.foldPercentage.set(prefs.foldPercentage);
      if (prefs.autoRotate3D !== undefined) this.autoRotate3D.set(prefs.autoRotate3D);
      if (prefs.activeTab) {
        if (prefs.activeTab === 'viewer_3d' || prefs.activeTab === 'sheets') {
          this.activeTab.set('editor_2d');
        } else {
          this.activeTab.set(prefs.activeTab as WorkspaceTab);
        }
      }
    }

    // 4. Hydrate Layer Visibility
    const layers = this.storage.loadLayerVisibility();
    if (layers) {
      this.layerVisibility.set({
        ...this.layerVisibility(),
        ...layers
      });
    }

    // 5. Hydrate Saved Projects Library
    const library = this.storage.getSavedProjects();
    this.savedProjects.set(library);

    // 6. Hydrate Current Active Project
    const savedProj = this.storage.loadCurrentProject();
    if (savedProj && savedProj.templateId && savedProj.params) {
      this.project.set(savedProj);
      this.activeTemplateId.set(savedProj.templateId);
      if (savedProj.materialId) this.activeMaterialId.set(savedProj.materialId);
      if (savedProj.sheetId) this.activeSheetId.set(savedProj.sheetId);
      this.lastSavedTimestamp.set('Loaded from Browser Storage');
    }
  }

  private autoSave(): void {
    this.storageStatus.set('saving');
    const proj = this.project();
    const success = this.storage.saveCurrentProject(proj);
    if (success) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      this.lastSavedTimestamp.set(`Saved at ${timeStr}`);
      this.storageStatus.set('saved');
    } else {
      this.storageStatus.set('idle');
    }
  }

  saveWorkspacePreferences(): void {
    const prefs: WorkspacePreferences = {
      unit: this.unit(),
      isDarkMode: this.isDarkMode(),
      foldPercentage: this.foldPercentage(),
      autoRotate3D: this.autoRotate3D(),
      activeTab: this.activeTab()
    };
    this.storage.savePreferences(prefs);
    this.storage.saveLayerVisibility(this.layerVisibility());
  }

  toggleDarkMode(): void {
    this.isDarkMode.update(dark => !dark);
    this.saveWorkspacePreferences();
  }

  // Computed Properties
  activeTemplate = computed(() => {
    return this.templates().find(t => t.id === this.activeTemplateId()) || this.templates()[0];
  });

  activeMaterial = computed(() => {
    return this.materials().find(m => m.id === this.activeMaterialId()) || this.materials()[0];
  });

  activeSheetPreset = computed(() => {
    return this.sheets().find(s => s.id === this.activeSheetId()) || this.sheets()[0];
  });

  geometry = computed<DielineGeometry>(() => {
    const tId = this.activeTemplateId();
    const params = this.project().params;
    const mat = this.activeMaterial();
    const t = mat ? mat.thickness : (params['caliper'] || 2.5);
    return generateDielineGeometry(tId, {
      ...params,
      caliper: t,
      thickness: t,
      materialThickness: t
    });
  });

  activeNestingSolution = computed<NestingSolution | null>(() => {
    const sols = this.nestingSolutions();
    if (sols.length === 0) return null;
    const idx = Math.min(this.activeNestingSolutionIndex(), sols.length - 1);
    const sol = { ...sols[idx] };

    // Apply manual items override if user dragged pieces
    const override = this.manualItemsOverride();
    if (override && sol.sheets.length > 0) {
      sol.sheets = sol.sheets.map((sh, i) => i === this.selectedSheetIndex() ? { ...sh, items: override } : sh);
    }
    return sol;
  });

  validationReport = computed<ProductionValidationReport>(() => {
    return ValidationEngine.validateDieline(
      this.geometry(),
      this.activeMaterial(),
      this.activeSheetPreset(),
      this.activeNestingSolution() || undefined
    );
  });

  // Actions & Mutators
  selectTemplate(templateId: string): void {
    const t = this.templates().find(x => x.id === templateId);
    if (!t) return;
    this.activeTemplateId.set(templateId);
    this.project.update(p => ({
      ...p,
      templateId,
      params: { ...t.defaultParams },
      modifiedDate: new Date().toISOString().split('T')[0]
    }));
    this.manualItemsOverride.set(null);
    this.pushHistoryState(`Change Template: ${t.name}`);
    this.recalculateNesting();
    this.autoSave();
  }

  updateParam(key: string, value: number): void {
    this.project.update(p => ({
      ...p,
      params: {
        ...p.params,
        [key]: Number(value)
      },
      modifiedDate: new Date().toISOString().split('T')[0]
    }));
    this.manualItemsOverride.set(null);
    this.pushHistoryState(`Update ${key}: ${value}`);
    this.recalculateNesting();
    this.autoSave();
  }

  setMaterial(materialId: string): void {
    const m = this.materials().find(x => x.id === materialId);
    if (!m) return;
    this.activeMaterialId.set(materialId);
    this.project.update(p => ({
      ...p,
      materialId,
      params: {
        ...p.params,
        caliper: m.thickness,
        thickness: m.thickness,
        materialThickness: m.thickness
      },
      modifiedDate: new Date().toISOString().split('T')[0]
    }));
    this.pushHistoryState(`Select Material: ${m.name}`);
    this.recalculateNesting();
    this.autoSave();
  }

  updateActiveMaterialThickness(thicknessMm: number): void {
    if (!thicknessMm || thicknessMm <= 0) return;
    const num = Number(thicknessMm);
    const activeMat = this.activeMaterial();
    const updated = { ...activeMat, thickness: num };
    this.materials.update(list => list.map(m => m.id === activeMat.id ? updated : m));
    this.project.update(p => ({
      ...p,
      params: {
        ...p.params,
        caliper: num,
        thickness: num,
        materialThickness: num
      },
      modifiedDate: new Date().toISOString().split('T')[0]
    }));
    this.pushHistoryState(`Change Material Thickness: ${num}mm`);
    this.recalculateNesting();
    this.autoSave();
  }

  setSheetPreset(sheetId: string): void {
    const s = this.sheets().find(x => x.id === sheetId);
    if (!s) return;
    this.activeSheetId.set(sheetId);
    this.project.update(p => ({
      ...p,
      sheetId,
      nestingConfig: {
        ...p.nestingConfig,
        sheetWidth: s.width,
        sheetHeight: s.height
      },
      modifiedDate: new Date().toISOString().split('T')[0]
    }));
    this.manualItemsOverride.set(null);
    this.pushHistoryState(`Select Sheet: ${s.name}`);
    this.recalculateNesting();
    this.autoSave();
  }

  updateNestingConfig(partial: Partial<NestingConfig>): void {
    this.project.update(p => ({
      ...p,
      nestingConfig: {
        ...p.nestingConfig,
        ...partial
      },
      modifiedDate: new Date().toISOString().split('T')[0]
    }));
    this.manualItemsOverride.set(null);
    this.recalculateNesting();
    this.autoSave();
  }

  setOrderQuantity(qty: number): void {
    const safeQty = Math.max(1, Math.round(qty));
    this.project.update(p => ({
      ...p,
      orderQuantity: safeQty,
      nestingConfig: {
        ...p.nestingConfig,
        orderQuantity: safeQty
      }
    }));
    this.recalculateNesting();
    this.autoSave();
  }

  setUnit(u: 'mm' | 'in' | 'cm'): void {
    this.unit.set(u);
    this.saveWorkspacePreferences();
  }

  // Unit Conversion & Formatting Helpers
  toCurrentUnit(mmValue: number): number {
    if (this.unit() === 'in') {
      return Number((mmValue / 25.4).toFixed(2));
    }
    if (this.unit() === 'cm') {
      return Number((mmValue / 10).toFixed(1));
    }
    return Number(mmValue.toFixed(1));
  }

  fromCurrentUnitToMm(userVal: number): number {
    if (this.unit() === 'in') {
      return Number((userVal * 25.4).toFixed(2));
    }
    if (this.unit() === 'cm') {
      return Number((userVal * 10).toFixed(2));
    }
    return Number(userVal.toFixed(2));
  }

  formatUnit(mmValue: number, decimals?: number): string {
    if (this.unit() === 'in') {
      const d = decimals !== undefined ? decimals : 2;
      return `${(mmValue / 25.4).toFixed(d)} in`;
    }
    if (this.unit() === 'cm') {
      const d = decimals !== undefined ? decimals : 1;
      return `${(mmValue / 10).toFixed(d)} cm`;
    }
    const d = decimals !== undefined ? decimals : 1;
    return `${mmValue.toFixed(d)} mm`;
  }

  getParamMin(minMm: number): number {
    return this.toCurrentUnit(minMm);
  }

  getParamMax(maxMm: number): number {
    return this.toCurrentUnit(maxMm);
  }

  getParamStep(stepMm = 1): number {
    if (this.unit() === 'in') return 0.05;
    if (this.unit() === 'cm') return 0.1;
    return stepMm || 1;
  }

  updateParamFromUnit(key: string, unitValue: number): void {
    const mm = this.fromCurrentUnitToMm(unitValue);
    this.updateParam(key, mm);
  }

  setFoldPercentage(val: number): void {
    this.foldPercentage.set(val);
    this.saveWorkspacePreferences();
  }

  toggleAutoRotate3D(): void {
    this.autoRotate3D.update(v => !v);
    this.saveWorkspacePreferences();
  }

  recalculateNesting(): void {
    this.isOptimizingNesting.set(true);
    this.nestingProgress.set(20);

    // Multi-pass background calculation
    setTimeout(() => {
      this.nestingProgress.set(65);
      const geom = this.geometry();
      const cfg = this.project().nestingConfig;
      const mat = this.activeMaterial();

      const solutions = NestingEngine.optimize(geom, cfg, mat);
      this.nestingSolutions.set(solutions);
      this.nestingProgress.set(100);
      this.isOptimizingNesting.set(false);
    }, 80);
  }

  // Manual Nesting Piece Interaction
  moveNestedPiece(pieceId: string, deltaX: number, deltaY: number): void {
    const sol = this.activeNestingSolution();
    if (!sol || sol.sheets.length === 0) return;

    const currentSheet = sol.sheets[this.selectedSheetIndex()] || sol.sheets[0];
    const items = [...currentSheet.items];
    const idx = items.findIndex(it => it.id === pieceId);
    if (idx === -1 || items[idx].isLocked) return;

    const piece = items[idx];
    const newX = Number((piece.x + deltaX).toFixed(1));
    const newY = Number((piece.y + deltaY).toFixed(1));

    items[idx] = {
      ...piece,
      x: newX,
      y: newY
    };

    // Recalculate collisions
    const checked = NestingEngine.checkCollisions(
      items, 
      this.project().nestingConfig.sheetWidth, 
      this.project().nestingConfig.sheetHeight, 
      this.project().nestingConfig.marginEdge
    );

    this.manualItemsOverride.set(checked);
  }

  rotateNestedPiece(pieceId: string, angleDelta = 90): void {
    const sol = this.activeNestingSolution();
    if (!sol || sol.sheets.length === 0) return;

    const currentSheet = sol.sheets[this.selectedSheetIndex()] || sol.sheets[0];
    const items = [...currentSheet.items];
    const idx = items.findIndex(it => it.id === pieceId);
    if (idx === -1 || items[idx].isLocked) return;

    const piece = items[idx];
    const newRot = (piece.rotation + angleDelta) % 360;
    
    // Swap width and height if 90 or 270
    const w = (angleDelta % 180 !== 0) ? piece.height : piece.width;
    const h = (angleDelta % 180 !== 0) ? piece.width : piece.height;

    items[idx] = {
      ...piece,
      rotation: newRot,
      width: w,
      height: h
    };

    const checked = NestingEngine.checkCollisions(
      items, 
      this.project().nestingConfig.sheetWidth, 
      this.project().nestingConfig.sheetHeight, 
      this.project().nestingConfig.marginEdge
    );

    this.manualItemsOverride.set(checked);
  }

  toggleLockPiece(pieceId: string): void {
    const sol = this.activeNestingSolution();
    if (!sol || sol.sheets.length === 0) return;

    const currentSheet = sol.sheets[this.selectedSheetIndex()] || sol.sheets[0];
    const items = currentSheet.items.map(it => it.id === pieceId ? { ...it, isLocked: !it.isLocked } : it);
    this.manualItemsOverride.set(items);
  }

  toggleLayer(layerKey: keyof LayerVisibility): void {
    this.layerVisibility.update(v => ({
      ...v,
      [layerKey]: !v[layerKey]
    }));
    this.storage.saveLayerVisibility(this.layerVisibility());
  }

  updateProjectName(name: string): void {
    this.project.update(p => ({
      ...p,
      name,
      modifiedDate: new Date().toISOString().split('T')[0]
    }));
    this.autoSave();
  }

  // History & Undo / Redo
  private pushHistoryState(actionName = 'State Change'): void {
    const stateJson = JSON.stringify(this.project());
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push(stateJson);
    this.historyIndex = this.history.length - 1;
    if (!actionName) return;
  }

  canUndo(): boolean {
    return this.historyIndex > 0;
  }

  canRedo(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  undo(): void {
    if (!this.canUndo()) return;
    this.historyIndex--;
    const state: ProjectData = JSON.parse(this.history[this.historyIndex]);
    this.project.set(state);
    this.activeTemplateId.set(state.templateId);
    this.activeMaterialId.set(state.materialId);
    this.activeSheetId.set(state.sheetId);
    this.recalculateNesting();
    this.autoSave();
  }

  redo(): void {
    if (!this.canRedo()) return;
    this.historyIndex++;
    const state: ProjectData = JSON.parse(this.history[this.historyIndex]);
    this.project.set(state);
    this.activeTemplateId.set(state.templateId);
    this.activeMaterialId.set(state.materialId);
    this.activeSheetId.set(state.sheetId);
    this.recalculateNesting();
    this.autoSave();
  }

  // Project Library (LocalStorage Saved Projects)
  saveProjectToLibrary(customName?: string): SavedProjectItem {
    const proj = { ...this.project() };
    if (customName && customName.trim()) {
      proj.name = customName.trim();
    }
    const template = this.activeTemplate();
    const material = this.activeMaterial();
    const sheet = this.activeSheetPreset();
    
    // Generate dimension summary string
    const p = proj.params;
    let dimStr = '';
    if (p['length'] && p['width'] && p['height']) {
      dimStr = `${p['length']} × ${p['width']} × ${p['height']} mm`;
    } else if (p['length'] && p['width']) {
      dimStr = `${p['length']} × ${p['width']} mm`;
    } else {
      dimStr = `${template.name}`;
    }

    const item: SavedProjectItem = {
      id: `proj_saved_${Date.now()}`,
      name: proj.name,
      jobNumber: proj.jobNumber,
      customerName: proj.customerName || 'General Client',
      templateId: proj.templateId,
      templateName: template.name,
      materialName: material.name,
      sheetDimensions: `${sheet.width} × ${sheet.height} mm`,
      dimensionsSummary: dimStr,
      savedAt: new Date().toISOString(),
      projectData: proj
    };

    this.storage.saveProjectToLibrary(item);
    this.savedProjects.set(this.storage.getSavedProjects());
    this.lastSavedTimestamp.set(`Project saved to Library (${new Date().toLocaleTimeString()})`);
    return item;
  }

  loadProjectFromLibrary(projectId: string): boolean {
    const list = this.savedProjects();
    const item = list.find(p => p.id === projectId);
    if (!item || !item.projectData) return false;

    this.project.set({ ...item.projectData });
    this.activeTemplateId.set(item.projectData.templateId);
    if (item.projectData.materialId) this.activeMaterialId.set(item.projectData.materialId);
    if (item.projectData.sheetId) this.activeSheetId.set(item.projectData.sheetId);
    this.manualItemsOverride.set(null);
    this.pushHistoryState(`Loaded Saved Project: ${item.name}`);
    this.recalculateNesting();
    this.autoSave();
    return true;
  }

  deleteProjectFromLibrary(projectId: string): void {
    this.storage.deleteSavedProject(projectId);
    this.savedProjects.set(this.storage.getSavedProjects());
  }

  duplicateSavedProject(projectId: string): void {
    const list = this.savedProjects();
    const item = list.find(p => p.id === projectId);
    if (!item) return;

    const clonedData: ProjectData = {
      ...item.projectData,
      id: `proj_${Date.now()}`,
      name: `${item.name} (Copy)`,
      jobNumber: `${item.jobNumber}-COPY`,
      createdDate: new Date().toISOString().split('T')[0],
      modifiedDate: new Date().toISOString().split('T')[0]
    };

    const newItem: SavedProjectItem = {
      ...item,
      id: `proj_saved_${Date.now()}`,
      name: clonedData.name,
      jobNumber: clonedData.jobNumber,
      savedAt: new Date().toISOString(),
      projectData: clonedData
    };

    this.storage.saveProjectToLibrary(newItem);
    this.savedProjects.set(this.storage.getSavedProjects());
  }

  resetToFactoryDefaults(): void {
    this.storage.clearAllStorage();
    this.project.set({ ...DEFAULT_PROJECT });
    this.activeTemplateId.set('rsc_carton');
    this.activeMaterialId.set('mat_bflute_30');
    this.activeSheetId.set('sheet_48x96');
    this.materials.set(SEED_MATERIALS);
    this.sheets.set(SEED_SHEETS);
    this.savedProjects.set([]);
    this.layerVisibility.set({
      CUT: true,
      CREASE: true,
      PERF: true,
      PARTIAL_CUT: true,
      BLEED: true,
      REGISTRATION: true,
      DIMENSIONS: true,
      ARTWORK: true,
      GRID: true,
      PANEL_FILL: true
    });
    this.unit.set('mm');
    this.manualItemsOverride.set(null);
    this.pushHistoryState('Factory Reset');
    this.recalculateNesting();
    this.lastSavedTimestamp.set('Reset to Factory Defaults');
  }

  addCustomMaterial(material: MaterialProfile): void {
    this.materials.update(list => [...list, material]);
    this.storage.saveCustomMaterials(this.materials());
  }

  addCustomSheet(sheet: SheetPreset): void {
    this.sheets.update(list => [...list, sheet]);
    this.storage.saveCustomSheets(this.sheets());
  }

  // Export Production Methods
  downloadAI(sheetIndex = -1): void {
    const options: ExportOptions = {
      format: 'AI',
      units: 'mm',
      scale: 1.0,
      layers: {
        CUT: true,
        CREASE: true,
        PERF: true,
        PARTIAL_CUT: true,
        BLEED: false,
        ARTWORK: false,
        REGISTRATION: true,
        DIMENSIONS: false,
        SHEET_BOUNDARY: false
      },
      includeZundBarcodes: true,
      includeJobHeader: true,
      commonLineOptimized: false,
      zundRegistrationMarks: true,
      selectedSheetIndex: sheetIndex
    };

    const aiStr = ExportEngine.exportAI(
      this.geometry(),
      this.project(),
      this.activeMaterial(),
      options,
      this.activeNestingSolution() || undefined,
      this.activeSheetPreset()
    );

    const blob = new Blob([aiStr], { type: 'application/illustrator;charset=utf-8' });
    const filename = `${this.project().jobNumber}_${this.project().templateId}_${sheetIndex >= 0 ? `SHEET_${sheetIndex + 1}_` : ''}Zund.ai`;
    this.triggerDownload(blob, filename);
  }

  downloadSVG(sheetIndex = -1): void {
    const options: ExportOptions = {
      format: 'SVG',
      units: 'mm',
      scale: 1.0,
      layers: {
        CUT: this.layerVisibility().CUT,
        CREASE: this.layerVisibility().CREASE,
        PERF: this.layerVisibility().PERF,
        PARTIAL_CUT: this.layerVisibility().PARTIAL_CUT,
        BLEED: this.layerVisibility().BLEED,
        ARTWORK: this.layerVisibility().ARTWORK,
        REGISTRATION: true,
        DIMENSIONS: this.layerVisibility().DIMENSIONS,
        SHEET_BOUNDARY: true
      },
      includeZundBarcodes: true,
      includeJobHeader: true,
      commonLineOptimized: false,
      zundRegistrationMarks: true,
      selectedSheetIndex: sheetIndex
    };

    const svgStr = ExportEngine.exportSVG(
      this.geometry(),
      this.project(),
      this.activeMaterial(),
      options,
      this.activeNestingSolution() || undefined,
      this.activeSheetPreset()
    );

    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const filename = `${this.project().jobNumber}_${this.project().templateId}_${sheetIndex >= 0 ? `SHEET_${sheetIndex + 1}` : 'DIELINE'}.svg`;
    this.triggerDownload(blob, filename);
  }

  downloadDXF(): void {
    const options: ExportOptions = {
      format: 'DXF',
      units: 'mm',
      scale: 1.0,
      layers: {
        CUT: true,
        CREASE: true,
        PERF: true,
        PARTIAL_CUT: true,
        BLEED: false,
        ARTWORK: false,
        REGISTRATION: true,
        DIMENSIONS: false,
        SHEET_BOUNDARY: true
      },
      includeZundBarcodes: false,
      includeJobHeader: true,
      commonLineOptimized: false,
      zundRegistrationMarks: true,
      selectedSheetIndex: -1
    };

    const dxfStr = ExportEngine.exportDXF(
      this.geometry(),
      this.project(),
      this.activeMaterial(),
      options
    );

    const blob = new Blob([dxfStr], { type: 'application/dxf;charset=utf-8' });
    const filename = `${this.project().jobNumber}_${this.project().templateId}_PRODUCTION.dxf`;
    this.triggerDownload(blob, filename);
  }

  downloadPDF(sheetIndex = -1): void {
    const options: ExportOptions = {
      format: 'PDF',
      units: 'mm',
      scale: 1.0,
      layers: {
        CUT: true,
        CREASE: true,
        PERF: true,
        PARTIAL_CUT: true,
        BLEED: true,
        ARTWORK: true,
        REGISTRATION: true,
        DIMENSIONS: true,
        SHEET_BOUNDARY: true
      },
      includeZundBarcodes: true,
      includeJobHeader: true,
      commonLineOptimized: false,
      zundRegistrationMarks: true,
      selectedSheetIndex: sheetIndex
    };

    const pdfBuffer = ExportEngine.exportPDF(
      this.geometry(),
      this.project(),
      this.activeMaterial(),
      options,
      this.activeNestingSolution() || undefined,
      this.activeSheetPreset()
    );

    const blob = new Blob([pdfBuffer as unknown as BlobPart], { type: 'application/pdf' });
    const filename = `${this.project().jobNumber}_${this.project().templateId}_${sheetIndex >= 0 ? `SHEET_${sheetIndex + 1}` : 'SPEC'}.pdf`;
    this.triggerDownload(blob, filename);
  }

  downloadProjectFile(): void {
    const jsonStr = JSON.stringify(this.project(), null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const filename = `${this.project().jobNumber}_${this.project().name.replace(/\s+/g, '_')}.dielineproject`;
    this.triggerDownload(blob, filename);
  }

  loadProjectFile(fileContent: string): void {
    try {
      const data: ProjectData = JSON.parse(fileContent);
      if (data && data.templateId && data.params) {
        this.project.set(data);
        this.activeTemplateId.set(data.templateId);
        if (data.materialId) this.activeMaterialId.set(data.materialId);
        if (data.sheetId) this.activeSheetId.set(data.sheetId);
        this.recalculateNesting();
        this.autoSave();
      }
    } catch (e) {
      console.error('Failed to parse dieline project file', e);
    }
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
