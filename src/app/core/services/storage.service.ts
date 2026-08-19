import { Injectable } from '@angular/core';
import { LayerVisibility } from '../models/dieline.models';
import { MaterialProfile } from '../models/material.models';
import { ProjectData, SavedProjectItem, WorkspacePreferences } from '../models/project.models';
import { SheetPreset } from '../models/sheet.models';

const STORAGE_KEYS = {
  CURRENT_PROJECT: 'dielineforge_current_project',
  SAVED_PROJECTS: 'dielineforge_saved_projects_library',
  PREFERENCES: 'dielineforge_workspace_preferences',
  LAYER_VISIBILITY: 'dielineforge_layer_visibility',
  CUSTOM_MATERIALS: 'dielineforge_custom_materials',
  CUSTOM_SHEETS: 'dielineforge_custom_sheets',
  LAST_ACTIVE_TAB: 'dielineforge_active_tab'
};

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private isAvailable(): boolean {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return false;
    }
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  // 1. Current Active Project Auto-Save & Hydration
  saveCurrentProject(project: ProjectData): boolean {
    if (!this.isAvailable()) return false;
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_PROJECT, JSON.stringify(project));
      return true;
    } catch (e) {
      console.warn('StorageService: Failed to auto-save current project to localStorage', e);
      return false;
    }
  }

  loadCurrentProject(): ProjectData | null {
    if (!this.isAvailable()) return null;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_PROJECT);
      if (!data) return null;
      const parsed = JSON.parse(data) as ProjectData;
      if (parsed && parsed.templateId && parsed.params) {
        return parsed;
      }
      return null;
    } catch (e) {
      console.warn('StorageService: Failed to load current project from localStorage', e);
      return null;
    }
  }

  // 2. Saved Projects Library
  getSavedProjects(): SavedProjectItem[] {
    if (!this.isAvailable()) return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAVED_PROJECTS);
      if (!data) return [];
      const list = JSON.parse(data);
      return Array.isArray(list) ? list : [];
    } catch (e) {
      console.warn('StorageService: Failed to get saved projects', e);
      return [];
    }
  }

  saveProjectToLibrary(item: SavedProjectItem): boolean {
    if (!this.isAvailable()) return false;
    try {
      const list = this.getSavedProjects();
      const existingIdx = list.findIndex(p => p.id === item.id);
      if (existingIdx >= 0) {
        list[existingIdx] = item;
      } else {
        list.unshift(item);
      }
      localStorage.setItem(STORAGE_KEYS.SAVED_PROJECTS, JSON.stringify(list));
      return true;
    } catch (e) {
      console.warn('StorageService: Failed to save project to library', e);
      return false;
    }
  }

  deleteSavedProject(projectId: string): boolean {
    if (!this.isAvailable()) return false;
    try {
      const list = this.getSavedProjects().filter(p => p.id !== projectId);
      localStorage.setItem(STORAGE_KEYS.SAVED_PROJECTS, JSON.stringify(list));
      return true;
    } catch (e) {
      console.warn('StorageService: Failed to delete saved project', e);
      return false;
    }
  }

  // 3. User Preferences
  savePreferences(prefs: WorkspacePreferences): boolean {
    if (!this.isAvailable()) return false;
    try {
      localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(prefs));
      return true;
    } catch (e) {
      console.warn('StorageService: Failed to save preferences', e);
      return false;
    }
  }

  loadPreferences(): WorkspacePreferences | null {
    if (!this.isAvailable()) return null;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  // 4. Layer Visibility
  saveLayerVisibility(layers: LayerVisibility): boolean {
    if (!this.isAvailable()) return false;
    try {
      localStorage.setItem(STORAGE_KEYS.LAYER_VISIBILITY, JSON.stringify(layers));
      return true;
    } catch {
      return false;
    }
  }

  loadLayerVisibility(): LayerVisibility | null {
    if (!this.isAvailable()) return null;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LAYER_VISIBILITY);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  // 5. Custom Materials
  saveCustomMaterials(materials: MaterialProfile[]): boolean {
    if (!this.isAvailable()) return false;
    try {
      const customOnly = materials.filter(m => m.id.startsWith('mat_custom_'));
      localStorage.setItem(STORAGE_KEYS.CUSTOM_MATERIALS, JSON.stringify(customOnly));
      return true;
    } catch {
      return false;
    }
  }

  loadCustomMaterials(): MaterialProfile[] {
    if (!this.isAvailable()) return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_MATERIALS);
      if (!data) return [];
      const list = JSON.parse(data);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  // 6. Custom Sheets
  saveCustomSheets(sheets: SheetPreset[]): boolean {
    if (!this.isAvailable()) return false;
    try {
      const customOnly = sheets.filter(s => s.isCustom || s.id.startsWith('sheet_custom_'));
      localStorage.setItem(STORAGE_KEYS.CUSTOM_SHEETS, JSON.stringify(customOnly));
      return true;
    } catch {
      return false;
    }
  }

  loadCustomSheets(): SheetPreset[] {
    if (!this.isAvailable()) return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_SHEETS);
      if (!data) return [];
      const list = JSON.parse(data);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  // 7. Reset and Storage Info
  clearAllStorage(): boolean {
    if (!this.isAvailable()) return false;
    try {
      Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
      return true;
    } catch {
      return false;
    }
  }

  getStorageStats(): { isAvailable: boolean; savedProjectsCount: number; approxSizeKb: number } {
    if (!this.isAvailable()) {
      return { isAvailable: false, savedProjectsCount: 0, approxSizeKb: 0 };
    }
    try {
      let totalBytes = 0;
      Object.values(STORAGE_KEYS).forEach(key => {
        const item = localStorage.getItem(key);
        if (item) totalBytes += (key.length + item.length) * 2;
      });
      const savedCount = this.getSavedProjects().length;
      return {
        isAvailable: true,
        savedProjectsCount: savedCount,
        approxSizeKb: Number((totalBytes / 1024).toFixed(2))
      };
    } catch {
      return { isAvailable: true, savedProjectsCount: 0, approxSizeKb: 0 };
    }
  }
}
