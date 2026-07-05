import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-3d-model-viewer',
  standalone: true,
  templateUrl: './3d-model-viewer.html',
  styleUrls: ['./3d-model-viewer.scss'],
  imports: [CommonModule, FormsModule, Navigation, TooltipDirective]
})
export class Model3dViewerComponent {
  readonly assetService = inject(AssetService);
}
