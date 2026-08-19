import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FluteType, MaterialProfile } from '../../core/models/material.models';
import { DielineStateService } from '../../core/services/dieline-state.service';

@Component({
  selector: 'app-material-manager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  templateUrl: './material-manager.html'
})
export class MaterialManager {
  state = inject(DielineStateService);

  showNewMaterialModal = signal<boolean>(false);

  // New Custom Material Form State
  newMatName = signal<string>('Custom Corrugated Board');
  newMatThickness = signal<number>(2.0);
  newMatFlute = signal<FluteType>('B');
  newMatGrammage = signal<number>(450);
  newMatKnife = signal<string>('Z21 Oscillating Knife');
  newMatCrease = signal<string>('CTT1 C205 Creasing Wheel');
  newMatCost = signal<number>(1.85);

  selectMaterial(id: string): void {
    this.state.setMaterial(id);
    this.state.activeTab.set('editor_2d');
  }

  setNewMatFlute(val: string): void {
    this.newMatFlute.set(val as FluteType);
  }

  saveCustomMaterial(): void {
    const id = `mat_custom_${Date.now()}`;
    const newMat: MaterialProfile = {
      id,
      name: this.newMatName(),
      manufacturer: 'Custom Supplier',
      category: 'corrugated',
      flute: this.newMatFlute(),
      thickness: this.newMatThickness(),
      densityGsm: this.newMatGrammage(),
      recommendedKnife: this.newMatKnife(),
      recommendedCreaseWheel: this.newMatCrease(),
      zundModule: 'POT',
      costPerSquareMeter: this.newMatCost(),
      grainDirectionDependent: true,
      minCreaseSpacing: this.newMatThickness() * 2,
      bendAllowanceFactor: 0.5,
      description: 'Custom calibrated packaging material profile for CNC digital table cutting and creasing.',
      color: '#c89666',
      textureType: 'kraft'
    };

    this.state.addCustomMaterial(newMat);
    this.state.setMaterial(id);
    this.showNewMaterialModal.set(false);
  }
}
