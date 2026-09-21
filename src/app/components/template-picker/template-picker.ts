import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TemplateCategory, TemplateDefinition } from '../../core/models/dieline.models';
import { DielineStateService } from '../../core/services/dieline-state.service';

@Component({
  selector: 'app-template-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  templateUrl: './template-picker.html'
})
export class TemplatePicker {
  state = inject(DielineStateService);

  searchQuery = signal<string>('');
  selectedCategory = signal<TemplateCategory | 'all'>('all');

  categories: { id: TemplateCategory | 'all'; label: string; icon: string }[] = [
    { id: 'all', label: 'All Box Styles (3)', icon: 'apps' },
    { id: 'shipping', label: 'Shipping (RSC)', icon: 'local_shipping' },
    { id: 'mailer', label: 'Mailers', icon: 'markunread_mailbox' }
  ];

  isTemplateAvailable(id: string): boolean {
    return Boolean(id);
  }

  filteredTemplates(): TemplateDefinition[] {
    const q = this.searchQuery().toLowerCase().trim();
    const cat = this.selectedCategory();

    return this.state.templates().filter(t => {
      const matchCat = cat === 'all' || t.category === cat;
      const matchQuery = !q || 
        t.name.toLowerCase().includes(q) || 
        t.code.toLowerCase().includes(q) || 
        t.description.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }

  selectTemplate(templateId: string): void {
    if (!this.isTemplateAvailable(templateId)) {
      return;
    }
    this.state.selectTemplate(templateId);
    this.state.activeTab.set('editor_2d');
  }
}
