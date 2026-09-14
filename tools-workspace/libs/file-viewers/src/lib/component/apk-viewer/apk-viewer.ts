import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AssetService,
  Navigation,
  ToastService,
  TooltipDirective
} from '@tools-workspace/features-home';
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import {
  APK_PARSER_SCRIPT,
  APK_VIEWER_ACCEPT_ATTR,
  APK_VIEWER_DESCRIPTION,
  APK_VIEWER_FORMATS_LABEL,
  APK_VIEWER_HELP_ITEMS,
  APK_VIEWER_RELATED_TOOLS,
  APK_VIEWER_TITLE
} from '../../constants/apk-viewer.constants';
import {
  isApkFile,
  parseApkFile,
  resolveApkSuggestion,
  type ApkInfo
} from '../../utils/apk-viewer.utils';

const FILE_ENTRY_LIMIT = 50;

@Component({
  selector: 'lib-apk-viewer',
  standalone: true,
  templateUrl: './apk-viewer.html',
  styleUrls: ['./apk-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApkViewerComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly title = APK_VIEWER_TITLE;
  readonly description = APK_VIEWER_DESCRIPTION;
  readonly acceptAttr = APK_VIEWER_ACCEPT_ATTR;
  readonly formatsLabel = APK_VIEWER_FORMATS_LABEL;
  readonly helpItems = APK_VIEWER_HELP_ITEMS;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = APK_VIEWER_RELATED_TOOLS;

  fileName = '';
  apk: ApkInfo | null = null;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  dismissedSuggestionId: string | null = null;

  private dragDepth = 0;

  get manifestFields(): Array<{ label: string; value: string }> {
    if (!this.apk) {
      return [];
    }
    return [
      { label: 'App name', value: this.apk.appName },
      { label: 'Package', value: this.apk.packageName },
      { label: 'Version name', value: this.apk.versionName },
      { label: 'Version code', value: this.apk.versionCode },
      { label: 'Min SDK', value: this.apk.minSdkVersion },
      { label: 'Target SDK', value: this.apk.targetSdkVersion }
    ];
  }

  get permissionCount(): number {
    return this.apk?.permissions.length ?? 0;
  }

  get activityCount(): number {
    return this.apk?.activities.length ?? 0;
  }

  get fileEntryCount(): number {
    return this.apk?.fileEntries.length ?? 0;
  }

  get visibleFileEntries(): string[] {
    return (this.apk?.fileEntries ?? []).slice(0, FILE_ENTRY_LIMIT);
  }

  get hasMoreFileEntries(): boolean {
    return this.fileEntryCount > FILE_ENTRY_LIMIT;
  }

  get primarySuggestion() {
    const suggestion = resolveApkSuggestion({
      hasApk: !!this.apk,
      hasError: !!this.errorMessage
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  ngOnDestroy(): void {
    this.dragDepth = 0;
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      void this.handleFiles(Array.from(input.files));
      input.value = '';
    }
  }

  @HostListener('window:dragenter', ['$event'])
  onWindowDragEnter(event: DragEvent): void {
    if (!this.isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    this.dragDepth += 1;
    if (!this.showDropZone) {
      this.showDropZone = true;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent): void {
    if (!this.isFileDrag(event)) {
      return;
    }
    event.preventDefault();
  }

  @HostListener('window:dragleave', ['$event'])
  onWindowDragLeave(event: DragEvent): void {
    if (!this.isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0 && this.showDropZone) {
      this.showDropZone = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:drop', ['$event'])
  async onWindowDrop(event: DragEvent): Promise<void> {
    if (!this.isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    this.dragDepth = 0;
    this.showDropZone = false;
    const files = event.dataTransfer?.files;
    if (files?.length) {
      await this.handleFiles(Array.from(files));
    }
    this.cdr.markForCheck();
  }

  async handleFiles(files: File[]): Promise<void> {
    const valid = files.filter(isApkFile);
    if (!valid.length) {
      this.errorMessage = `Please upload ${this.formatsLabel} package.`;
      this.dismissedSuggestionId = null;
      this.toast.error(this.errorMessage);
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.cdr.markForCheck();

    try {
      const file = valid[0];
      this.apk = await parseApkFile(file, this.assetService.getAssetPath(APK_PARSER_SCRIPT));
      this.fileName = file.name;
      this.toast.success(`Loaded ${file.name}`);
    } catch (error) {
      this.apk = null;
      this.fileName = '';
      this.errorMessage =
        error instanceof Error ? error.message : 'Failed to parse APK package.';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  clearAll(): void {
    this.apk = null;
    this.fileName = '';
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.toast.info('APK cleared');
    this.cdr.markForCheck();
  }

  trackByPermission(_: number, permission: string): string {
    return permission;
  }

  trackByActivity(_: number, activity: string): string {
    return activity;
  }

  trackByFileEntry(_: number, entry: string): string {
    return entry;
  }

  private isFileDrag(event: DragEvent): boolean {
    return !!event.dataTransfer?.types.includes('Files');
  }
}
