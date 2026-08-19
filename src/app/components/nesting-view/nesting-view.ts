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
import { NestedItem } from '../../core/models/sheet.models';
import { DielineStateService } from '../../core/services/dieline-state.service';

@Component({
  selector: 'app-nesting-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  templateUrl: './nesting-view.html',
  styleUrl: './nesting-view.css'
})
export class NestingView {
  state = inject(DielineStateService);

  sheetContainer = viewChild<ElementRef<HTMLDivElement>>('sheetContainer');

  // Interactive Piece Dragging
  selectedPiece = signal<NestedItem | null>(null);
  isDraggingPiece = signal<boolean>(false);
  dragStartMouse = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  dragPieceInitialPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  // Compare Solutions Modal
  showCompareModal = signal<boolean>(false);
  showOffcutsDetails = signal<boolean>(false);

  // Sheet Zoom and Pan
  sheetZoom = signal<number>(0.9);
  sheetPan = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  selectPiece(piece: NestedItem, e: MouseEvent): void {
    e.stopPropagation();
    this.selectedPiece.set(piece);
    this.isDraggingPiece.set(true);
    this.dragStartMouse.set({ x: e.clientX, y: e.clientY });
    this.dragPieceInitialPos.set({ x: piece.x, y: piece.y });
  }

  deselectAll(): void {
    this.selectedPiece.set(null);
  }

  prevSheet(): void {
    this.state.selectedSheetIndex.set(Math.max(0, this.state.selectedSheetIndex() - 1));
  }

  nextSheet(maxSheets: number): void {
    this.state.selectedSheetIndex.set(Math.min(maxSheets - 1, this.state.selectedSheetIndex() + 1));
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    if (!this.isDraggingPiece() || !this.selectedPiece()) return;

    const piece = this.selectedPiece()!;
    if (piece.isLocked) return;

    const dx = (e.clientX - this.dragStartMouse().x) / this.sheetZoom();
    const dy = (e.clientY - this.dragStartMouse().y) / this.sheetZoom();

    const newX = this.dragPieceInitialPos().x + dx;
    const newY = this.dragPieceInitialPos().y + dy;

    this.state.moveNestedPiece(piece.id, newX - piece.x, newY - piece.y);
  }

  @HostListener('window:mouseup')
  onMouseUp(): void {
    if (this.isDraggingPiece()) {
      this.isDraggingPiece.set(false);
      // Update selected piece reference
      const sol = this.state.activeNestingSolution();
      if (sol && this.selectedPiece()) {
        const sh = sol.sheets[this.state.selectedSheetIndex()] || sol.sheets[0];
        const updated = sh.items.find(it => it.id === this.selectedPiece()!.id);
        if (updated) this.selectedPiece.set(updated);
      }
    }
  }

  rotateSelectedPiece(deltaAngle = 90): void {
    const piece = this.selectedPiece();
    if (!piece) return;
    this.state.rotateNestedPiece(piece.id, deltaAngle);
    // Refresh selection
    const sol = this.state.activeNestingSolution();
    if (sol) {
      const sh = sol.sheets[this.state.selectedSheetIndex()] || sol.sheets[0];
      const updated = sh.items.find(it => it.id === piece.id);
      if (updated) this.selectedPiece.set(updated);
    }
  }

  toggleLockSelectedPiece(): void {
    const piece = this.selectedPiece();
    if (!piece) return;
    this.state.toggleLockPiece(piece.id);
    this.selectedPiece.update(p => p ? { ...p, isLocked: !p.isLocked } : null);
  }

  applySolution(index: number): void {
    this.state.activeNestingSolutionIndex.set(index);
    this.state.manualItemsOverride.set(null);
    this.showCompareModal.set(false);
  }
}
