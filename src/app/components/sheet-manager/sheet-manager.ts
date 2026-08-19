import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SheetPreset } from '../../core/models/sheet.models';
import { DielineStateService } from '../../core/services/dieline-state.service';

@Component({
  selector: 'app-sheet-manager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule],
  templateUrl: './sheet-manager.html'
})
export class SheetManager {
  state = inject(DielineStateService);

  showNewSheetModal = signal<boolean>(false);
  newSheetName = signal<string>('Custom Flatbed Table 60 × 120 in');
  newSheetWidth = signal<number>(3048);
  newSheetHeight = signal<number>(1524);
  newSheetCost = signal<number>(14.50);

  selectSheet(id: string): void {
    this.state.setSheetPreset(id);
    this.state.activeTab.set('nesting');
  }

  saveCustomSheet(): void {
    const id = `sheet_custom_${Date.now()}`;
    const newSheet: SheetPreset = {
      id,
      name: this.newSheetName(),
      width: this.newSheetWidth(),
      height: this.newSheetHeight(),
      displayDimensions: `${(this.newSheetWidth() / 25.4).toFixed(0)} × ${(this.newSheetHeight() / 25.4).toFixed(0)} in (${this.newSheetWidth()} × ${this.newSheetHeight()} mm)`,
      costPerSheet: this.newSheetCost(),
      isCustom: true
    };

    this.state.addCustomSheet(newSheet);
    this.state.setSheetPreset(id);
    this.showNewSheetModal.set(false);
  }
}
