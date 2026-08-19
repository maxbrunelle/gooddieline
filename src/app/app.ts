import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Canvas2D } from './components/canvas-2d/canvas-2d';
import { MaterialManager } from './components/material-manager/material-manager';
import { NestingView } from './components/nesting-view/nesting-view';
import { ReportsView } from './components/reports-view/reports-view';
import { TemplatePicker } from './components/template-picker/template-picker';
import { DielineStateService, WorkspaceTab } from './core/services/dieline-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatIconModule,
    Canvas2D,
    NestingView,
    TemplatePicker,
    MaterialManager,
    ReportsView
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  state = inject(DielineStateService);

  showProjectModal = signal<boolean>(false);
  showExportModal = signal<boolean>(false);
  showProjectsModal = signal<boolean>(false);
  saveSnapshotName = signal<string>('');
  notificationMessage = signal<string | null>(null);

  setTab(tab: WorkspaceTab): void {
    this.state.activeTab.set(tab);
    this.state.saveWorkspacePreferences();
  }

  saveCurrentToLibrary(): void {
    const name = this.saveSnapshotName().trim() || this.state.project().name;
    this.state.saveProjectToLibrary(name);
    this.saveSnapshotName.set('');
    this.triggerToast(`Saved "${name}" to LocalStorage library!`);
  }

  loadSavedProject(projectId: string): void {
    const success = this.state.loadProjectFromLibrary(projectId);
    if (success) {
      this.showProjectsModal.set(false);
      this.state.activeTab.set('editor_2d');
      this.triggerToast('Project loaded from LocalStorage');
    }
  }

  deleteSavedProject(projectId: string, name: string): void {
    this.state.deleteProjectFromLibrary(projectId);
    this.triggerToast(`Deleted "${name}" from LocalStorage`);
  }

  duplicateSavedProject(projectId: string): void {
    this.state.duplicateSavedProject(projectId);
    this.triggerToast('Project duplicated in LocalStorage');
  }

  resetDefaults(): void {
    if (confirm('Are you sure you want to reset all data and clear LocalStorage to factory defaults?')) {
      this.state.resetToFactoryDefaults();
      this.showProjectsModal.set(false);
      this.triggerToast('Workspace reset to factory defaults');
    }
  }

  triggerToast(msg: string): void {
    this.notificationMessage.set(msg);
    setTimeout(() => {
      this.notificationMessage.set(null);
    }, 3000);
  }

  onFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          this.state.loadProjectFile(text);
          this.triggerToast(`Imported project: ${file.name}`);
        }
      };
      reader.readAsText(file);
    }
  }

  updateJobName(name: string): void {
    this.state.project.update(p => ({ ...p, name }));
    this.state.updateProjectName(name);
  }

  updateJobNumber(jobNumber: string): void {
    this.state.project.update(p => ({ ...p, jobNumber }));
    this.state.updateProjectName(this.state.project().name);
  }

  updateCustomerName(customerName: string): void {
    this.state.project.update(p => ({ ...p, customerName }));
    this.state.updateProjectName(this.state.project().name);
  }

  updateNotes(notes: string): void {
    this.state.project.update(p => ({ ...p, notes }));
    this.state.updateProjectName(this.state.project().name);
  }
}
