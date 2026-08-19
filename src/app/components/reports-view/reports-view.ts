import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DielineStateService } from '../../core/services/dieline-state.service';

@Component({
  selector: 'app-reports-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  templateUrl: './reports-view.html'
})
export class ReportsView {
  state = inject(DielineStateService);

  getCuttingTimeDetails() {
    const geom = this.state.geometry();
    const sol = this.state.activeNestingSolution();
    const sheetsReq = sol?.sheetsRequired || 1;
    const piecesPerSheet = sol?.piecesPerSheet || 1;

    const cutMetersPerSheet = (geom.totalCutLength / 1000) * piecesPerSheet;
    const creaseMetersPerSheet = (geom.totalCreaseLength / 1000) * piecesPerSheet;

    // Cutting Speed: 40 m/min, Creasing Speed: 55 m/min
    const cutMinutes = cutMetersPerSheet / 40;
    const creaseMinutes = creaseMetersPerSheet / 55;
    const sheetHandlingMin = 0.5; // 30 sec load/unload per sheet

    const totalMinutesPerSheet = cutMinutes + creaseMinutes + sheetHandlingMin;
    const totalJobMinutes = totalMinutesPerSheet * sheetsReq;

    // Cost Breakdown
    const sheetCost = this.state.activeSheetPreset().costPerSheet || 12.0;
    const totalMaterialCost = sheetCost * sheetsReq;
    const machineHourlyRate = 85.0; // $85/hr Zünd machine rate
    const machineCost = (totalJobMinutes / 60) * machineHourlyRate;
    const totalJobCost = totalMaterialCost + machineCost;
    const costPerPiece = totalJobCost / this.state.project().orderQuantity;

    return {
      cutMetersPerSheet: cutMetersPerSheet.toFixed(2),
      creaseMetersPerSheet: creaseMetersPerSheet.toFixed(2),
      totalMinutesPerSheet: totalMinutesPerSheet.toFixed(1),
      totalJobMinutes: Math.ceil(totalJobMinutes),
      totalMaterialCost: totalMaterialCost.toFixed(2),
      machineCost: machineCost.toFixed(2),
      totalJobCost: totalJobCost.toFixed(2),
      costPerPiece: costPerPiece.toFixed(2)
    };
  }
}
