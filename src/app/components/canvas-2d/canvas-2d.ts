import { CommonModule } from '@angular/common';
import { 
  ChangeDetectionStrategy, 
  Component, 
  ElementRef, 
  HostListener, 
  inject, 
  signal, 
  viewChild 
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DimensionAnnotation } from '../../core/models/dieline.models';
import { DielineStateService } from '../../core/services/dieline-state.service';

@Component({
  selector: 'app-canvas-2d',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule],
  templateUrl: './canvas-2d.html',
  styleUrl: './canvas-2d.css'
})
export class Canvas2D {
  state = inject(DielineStateService);

  svgContainer = viewChild<ElementRef<HTMLDivElement>>('svgContainer');
  
  // Interactive Pan / Zoom state
  isPanning = signal<boolean>(false);
  panStart = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  cursorCoords = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  // Dimension Inline Editing
  editingDimension = signal<DimensionAnnotation | null>(null);
  editingDimValue = signal<number>(0);

  // Measurement Tool State
  measureStart = signal<{ x: number; y: number } | null>(null);
  measureCurrent = signal<{ x: number; y: number } | null>(null);
  measuredDistance = signal<number | null>(null);

  onMouseDown(e: MouseEvent): void {
    if (e.button === 1 || this.state.activeTool() === 'pan' || (e.button === 0 && e.shiftKey)) {
      // Pan mode
      this.isPanning.set(true);
      this.panStart.set({ x: e.clientX - this.state.panOffset().x, y: e.clientY - this.state.panOffset().y });
      e.preventDefault();
      return;
    }

    if (this.state.activeTool() === 'measure') {
      const pt = this.screenToWorld(e.clientX, e.clientY);
      if (!this.measureStart()) {
        this.measureStart.set(pt);
        this.measureCurrent.set(pt);
      } else {
        this.measureCurrent.set(pt);
        const dist = Math.hypot(pt.x - this.measureStart()!.x, pt.y - this.measureStart()!.y);
        this.measuredDistance.set(Number(dist.toFixed(1)));
      }
    }
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    const pt = this.screenToWorld(e.clientX, e.clientY);
    this.cursorCoords.set({ x: Number(pt.x.toFixed(1)), y: Number(pt.y.toFixed(1)) });

    if (this.isPanning()) {
      const newX = e.clientX - this.panStart().x;
      const newY = e.clientY - this.panStart().y;
      this.state.panOffset.set({ x: newX, y: newY });
    }

    if (this.state.activeTool() === 'measure' && this.measureStart()) {
      this.measureCurrent.set(pt);
      const dist = Math.hypot(pt.x - this.measureStart()!.x, pt.y - this.measureStart()!.y);
      this.measuredDistance.set(Number(dist.toFixed(1)));
    }
  }

  @HostListener('window:mouseup')
  onMouseUp(): void {
    if (this.isPanning()) {
      this.isPanning.set(false);
    }
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newZoom = Math.min(Math.max(this.state.zoom() * zoomFactor, 0.15), 10.0);
    this.state.zoom.set(newZoom);
  }

  zoomIn(): void {
    this.state.zoom.set(Math.min(this.state.zoom() * 1.25, 10.0));
  }

  zoomOut(): void {
    this.state.zoom.set(Math.max(this.state.zoom() / 1.25, 0.15));
  }

  zoomToFit(): void {
    const geom = this.state.geometry();
    const container = this.svgContainer()?.nativeElement;
    if (!container) return;

    const contW = container.clientWidth - 80;
    const contH = container.clientHeight - 80;

    const scaleX = contW / (geom.bounds.width || 400);
    const scaleY = contH / (geom.bounds.height || 400);
    const fitZoom = Math.min(scaleX, scaleY, 2.5);

    this.state.zoom.set(fitZoom);
    this.state.panOffset.set({ x: 0, y: 0 });
  }

  resetMeasurement(): void {
    this.measureStart.set(null);
    this.measureCurrent.set(null);
    this.measuredDistance.set(null);
  }

  startEditDimension(dim: DimensionAnnotation, e: MouseEvent): void {
    e.stopPropagation();
    if (!dim.isDriving || !dim.paramKey) return;
    this.editingDimension.set(dim);
    this.editingDimValue.set(this.state.toCurrentUnit(dim.value));
  }

  saveDimensionEdit(): void {
    const dim = this.editingDimension();
    if (dim && dim.paramKey) {
      this.state.updateParamFromUnit(dim.paramKey, this.editingDimValue());
    }
    this.editingDimension.set(null);
  }

  cancelDimensionEdit(): void {
    this.editingDimension.set(null);
  }

  private screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const container = this.svgContainer()?.nativeElement;
    if (!container) return { x: 0, y: 0 };

    const rect = container.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const midY = rect.top + rect.height / 2;

    const geom = this.state.geometry();
    const geomCenterX = geom.bounds.minX + geom.bounds.width / 2;
    const geomCenterY = geom.bounds.minY + geom.bounds.height / 2;

    const screenOffsetX = (clientX - midX - this.state.panOffset().x) / this.state.zoom();
    const screenOffsetY = (clientY - midY - this.state.panOffset().y) / this.state.zoom();

    return {
      x: geomCenterX + screenOffsetX,
      y: geomCenterY + screenOffsetY
    };
  }

  getTransform(): string {
    const z = this.state.zoom();
    const px = this.state.panOffset().x;
    const py = this.state.panOffset().y;

    return `translate(${px}px, ${py}px) scale(${z})`;
  }
}
