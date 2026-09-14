import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService, toUserFacingError } from '@tools-workspace/features-home';
import { firstValueFrom } from 'rxjs';
import { Model3dBackendApiService } from '../../api/model3d-backend-api.service';
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import {
  MODEL_3D_ACCEPT_ATTR,
  MODEL_3D_RELATED_TOOLS,
  MODEL_3D_ROADMAP_HINT,
  MODEL_3D_ROADMAP_ITEMS
} from '../../constants/3d-model-viewer.constants';
import type { Model3dLoadedModel } from '../../types/3d-model-viewer.types';
import {
  ensureModelViewerDefined,
  formatBytes,
  formatNumber,
  formatSupportedFormatsLabel,
  resolveModel3dSuggestion,
  supportedFormatCount,
  validateModel3dFile
} from '../../utils/3d-model-viewer.utils';

@Component({
  selector: 'lib-3d-model-viewer',
  standalone: true,
  templateUrl: './3d-model-viewer.html',
  styleUrls: ['./3d-model-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Model3dViewerComponent implements OnInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly api = inject(Model3dBackendApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly acceptAttr = MODEL_3D_ACCEPT_ATTR;
  readonly formatsCountLabel = supportedFormatCount();
  readonly capabilityLine = formatSupportedFormatsLabel();
  readonly roadmapHint = MODEL_3D_ROADMAP_HINT;
  readonly roadmapItems = MODEL_3D_ROADMAP_ITEMS;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = MODEL_3D_RELATED_TOOLS;
  readonly formatBytes = formatBytes;
  readonly formatNumber = formatNumber;

  model: Model3dLoadedModel | null = null;
  loading = false;
  showDropZone = false;
  autoRotate = true;
  wireframeHint = false;
  apiReachable: boolean | null = null;
  viewerReady = false;
  dismissedSuggestionId: string | null = null;

  private dragDepth = 0;
  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);

  get statusLabel(): string {
    if (this.loading) return 'Loading';
    if (this.model) return 'Ready';
    return this.apiReachable === false ? 'Unavailable' : 'Idle';
  }

  get processingLabel(): string {
    return this.api.settings.enabled ? (this.apiReachable === false ? 'Retry' : 'Secure') : 'Off';
  }

  get modelsLabel(): string {
    return this.model ? '1' : '—';
  }

  get primarySuggestion() {
    const suggestion = resolveModel3dSuggestion(!!this.model, this.apiReachable);
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) return null;
    return suggestion;
  }

  ngOnInit(): void {
    document.addEventListener('dragenter', this.preventDefaultsFn, false);
    document.addEventListener('dragover', this.preventDefaultsFn, false);
    document.addEventListener('dragleave', this.preventDefaultsFn, false);
    document.addEventListener('drop', this.preventDefaultsFn, false);
    void this.bootstrap();
  }

  ngOnDestroy(): void {
    document.removeEventListener('dragenter', this.preventDefaultsFn, false);
    document.removeEventListener('dragover', this.preventDefaultsFn, false);
    document.removeEventListener('dragleave', this.preventDefaultsFn, false);
    document.removeEventListener('drop', this.preventDefaultsFn, false);
    this.revokeModelUrl();
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.loadFile(file);
  }

  @HostListener('dragenter', ['$event'])
  onDragEnter(event: DragEvent): void {
    this.preventDefaults(event);
    this.dragDepth++;
    this.showDropZone = true;
    this.cdr.markForCheck();
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent): void {
    this.preventDefaults(event);
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) {
      this.showDropZone = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent): void {
    this.preventDefaults(event);
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    this.preventDefaults(event);
    this.dragDepth = 0;
    this.showDropZone = false;
    const file = event.dataTransfer?.files?.[0];
    this.cdr.markForCheck();
    if (file) void this.loadFile(file);
  }

  clearModel(): void {
    this.revokeModelUrl();
    this.model = null;
    this.toast.info('Model cleared');
    this.cdr.markForCheck();
  }

  toggleAutoRotate(): void {
    this.autoRotate = !this.autoRotate;
    this.cdr.markForCheck();
  }

  downloadGlb(): void {
    if (!this.model) return;
    const a = document.createElement('a');
    a.href = this.model.objectUrl;
    const base = this.model.sourceName.replace(/\.[^.]+$/, '') || 'model';
    a.download = `${base}.glb`;
    a.click();
    this.toast.success('Download started');
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  private async bootstrap(): Promise<void> {
    const viewerPromise = ensureModelViewerDefined()
      .then(() => {
        this.viewerReady = true;
      })
      .catch(() => {
        this.toast.error('Could not load 3D viewer runtime');
      });

    try {
      const health = await firstValueFrom(this.api.health());
      this.apiReachable = health?.status === 'UP';
    } catch {
      this.apiReachable = false;
    }

    await viewerPromise;
    this.cdr.markForCheck();
  }

  private async loadFile(file: File): Promise<void> {
    const validationError = validateModel3dFile(file);
    if (validationError) {
      this.toast.warning(validationError);
      return;
    }
    if (this.apiReachable === false) {
      this.toast.error('Could not process the model right now. Please try again shortly.');
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();
    try {
      if (!this.viewerReady) {
        await ensureModelViewerDefined();
        this.viewerReady = true;
      }
      const [meta, glbBlob] = await Promise.all([this.api.inspect(file), this.api.normalize(file)]);
      this.revokeModelUrl();
      const objectUrl = URL.createObjectURL(glbBlob);
      this.model = {
        sourceName: file.name,
        sourceSize: file.size,
        glbBlob,
        objectUrl,
        meta
      };
      this.toast.success(`Loaded ${file.name} · ${meta.format.toUpperCase()} → GLB`);
    } catch (err) {
      this.toast.error(toUserFacingError(err, 'Could not load the 3D model'));
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private revokeModelUrl(): void {
    if (this.model?.objectUrl) {
      URL.revokeObjectURL(this.model.objectUrl);
    }
  }

  private preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }
}
