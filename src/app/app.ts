import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Canvas2D } from './components/canvas-2d/canvas-2d';
import { MaterialManager } from './components/material-manager/material-manager';
import { NestingView } from './components/nesting-view/nesting-view';
import { ReportsView } from './components/reports-view/reports-view';
import { TemplatePicker } from './components/template-picker/template-picker';
import { DielineStateService, WorkspaceTab } from './core/services/dieline-state.service';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  decay: number;
  color: string;
  size: number;
}

interface Rocket {
  x: number;
  y: number;
  targetY: number;
  vy: number;
  color: string;
}

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
  showSettingsModal = signal<boolean>(false);
  showEasterEggModal = signal<boolean>(false);
  saveSnapshotName = signal<string>('');
  notificationMessage = signal<string | null>(null);
  logoUploadError = signal<string | null>(null);
  isDraggingLogo = signal<boolean>(false);

  private fireworksCanvas = viewChild<ElementRef<HTMLCanvasElement>>('fireworksCanvas');
  private animationFrameId: number | null = null;
  private rockets: Rocket[] = [];
  private particles: Particle[] = [];
  private readonly palette = [
    '#f59e0b', // Amber / Whiskey Gold
    '#fbbf24', // Golden yellow
    '#10b981', // Crown Apple Emerald
    '#34d399', // Apple green
    '#8b5cf6', // Crown Royal Purple
    '#a78bfa', // Royal Violet
    '#ef4444', // Ruby
    '#38bdf8', // Ice blue
    '#ffffff'  // Diamond sparkle
  ];

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

  handleLogoFile(file: File): void {
    this.logoUploadError.set(null);
    if (!file.type.startsWith('image/')) {
      this.logoUploadError.set('Please select an image file (PNG, SVG, JPG, WebP, GIF)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.logoUploadError.set('Logo file size must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        this.state.setCustomLogo(dataUrl);
        this.triggerToast('Custom logo updated successfully!');
      }
    };
    reader.onerror = () => {
      this.logoUploadError.set('Failed to read image file');
    };
    reader.readAsDataURL(file);
  }

  onLogoInputSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.handleLogoFile(input.files[0]);
    }
  }

  onLogoDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingLogo.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      this.handleLogoFile(event.dataTransfer.files[0]);
    }
  }

  onLogoDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingLogo.set(true);
  }

  onLogoDragLeave(): void {
    this.isDraggingLogo.set(false);
  }

  removeLogo(): void {
    this.state.setCustomLogo(null);
    this.triggerToast('Logo reset to default');
  }

  updateBrandTitle(name: string): void {
    this.state.setBrandName(name);
  }

  openEasterEgg(): void {
    this.showEasterEggModal.set(true);
    // Initialize fireworks animation after DOM renders canvas
    setTimeout(() => {
      this.initFireworks();
    }, 50);
  }

  closeEasterEgg(): void {
    this.showEasterEggModal.set(false);
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.rockets = [];
    this.particles = [];
  }

  triggerManualSalvo(): void {
    const canvas = this.fireworksCanvas()?.nativeElement;
    const w = canvas ? canvas.width : window.innerWidth;
    const h = canvas ? canvas.height : window.innerHeight;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        if (this.showEasterEggModal()) {
          this.launchRocket(w, h);
        }
      }, i * 150);
    }
  }

  private initFireworks(): void {
    const canvas = this.fireworksCanvas()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Attach native canvas click listener for manual fireworks
    canvas.onclick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      this.explodeAt(x, y, 60);
    };

    this.rockets = [];
    this.particles = [];

    // Launch initial celebratory volley
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        if (this.showEasterEggModal()) {
          this.launchRocket(canvas.width, canvas.height);
        }
      }, i * 200);
    }

    let lastRocketTime = Date.now();

    const render = () => {
      if (!this.showEasterEggModal()) return;

      // Dynamic resize handling
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      // Smooth motion blur trail effect
      ctx.fillStyle = 'rgba(5, 5, 12, 0.22)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Auto-launch continuous celebratory rockets
      const now = Date.now();
      if (now - lastRocketTime > 350 + Math.random() * 450) {
        this.launchRocket(canvas.width, canvas.height);
        lastRocketTime = now;
      }

      // Update & render rockets
      for (let i = this.rockets.length - 1; i >= 0; i--) {
        const r = this.rockets[i];
        r.y += r.vy;
        
        ctx.beginPath();
        ctx.arc(r.x, r.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = r.color;
        ctx.shadowColor = r.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Sparkle tail
        if (Math.random() < 0.6) {
          this.particles.push({
            x: r.x + (Math.random() - 0.5) * 4,
            y: r.y + 4,
            vx: (Math.random() - 0.5) * 1.5,
            vy: Math.random() * 2 + 1,
            alpha: 0.85,
            decay: 0.04,
            color: '#fbbf24',
            size: 2
          });
        }

        if (r.y <= r.targetY || r.vy >= 0) {
          this.explodeAt(r.x, r.y, 45 + Math.floor(Math.random() * 35), r.color);
          this.rockets.splice(i, 1);
        }
      }

      // Update & render particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06; // gravity
        p.vx *= 0.98; // friction
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
      }

      this.animationFrameId = requestAnimationFrame(render);
    };

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.animationFrameId = requestAnimationFrame(render);
  }

  private launchRocket(w: number, h: number): void {
    const x = w * 0.15 + Math.random() * (w * 0.7);
    const targetY = h * 0.10 + Math.random() * (h * 0.45);
    const color = this.palette[Math.floor(Math.random() * this.palette.length)];
    this.rockets.push({
      x,
      y: h,
      targetY,
      vy: -11 - Math.random() * 5,
      color
    });
  }

  private explodeAt(x: number, y: number, count: number, primaryColor?: string): void {
    const color = primaryColor || this.palette[Math.floor(Math.random() * this.palette.length)];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = Math.random() * 6 + 1.5;
      const pColor = Math.random() < 0.7 ? color : this.palette[Math.floor(Math.random() * this.palette.length)];
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        decay: Math.random() * 0.018 + 0.012,
        color: pColor,
        size: Math.random() * 2.5 + 1.5
      });
    }
  }
}
