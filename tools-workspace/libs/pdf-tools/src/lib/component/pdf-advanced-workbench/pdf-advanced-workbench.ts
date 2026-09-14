import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import {
  getPdfAdvancedTool,
  type PdfAdvancedConfigField,
  type PdfAdvancedOutputKind,
  type PdfAdvancedToolDef,
} from '../../advanced/pdf-advanced-tools.registry';
import {
  PdfBackendApiService,
  encodeSensitivePayload,
  isPdfAdvancedBackendEnabled,
} from '../../api';
import {
  PDF_MAX_BYTES,
  downloadBlob,
  downloadText,
  formatFileSize,
} from '../../shared/pdf.utils';
import { pdfNotifyError, pdfNotifyFailure, pdfNotifySuccess, pdfNotifyWarning } from '../../shared/pdf-feedback.util';

const SENSITIVE_KEYS = new Set(['password', 'userPassword', 'ownerPassword']);

@Component({
  selector: 'lib-pdf-advanced-workbench',
  standalone: true,
  templateUrl: './pdf-advanced-workbench.html',
  styleUrls: ['./pdf-advanced-workbench.scss'],
  imports: [CommonModule, FormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfAdvancedWorkbenchComponent implements OnInit, OnChanges, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly pdfBackend = inject(PdfBackendApiService);

  @Input({ required: true }) toolId!: string;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  tool: PdfAdvancedToolDef | undefined;
  files: File[] = [];
  replacementFile: File | null = null;
  certificateFile: File | null = null;
  configValues: Record<string, string | number | boolean> = {};
  password = '';

  loading = false;
  loadingMessage = 'Processing…';
  loadingDetail = '';
  showDropZone = false;
  lastActionCompleted = false;
  lastActionMessage = '';
  engineWarning = '';

  resultBlob: Blob | null = null;
  resultText = '';
  resultJson: unknown = null;
  outputFilename = '';

  ngOnInit(): void {
    if (!this.tool && this.toolId) {
      this.resolveTool();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['toolId']) {
      this.resolveTool();
    }
  }

  ngOnDestroy(): void {
    this.clearAll();
  }

  private resolveTool(): void {
    this.tool = getPdfAdvancedTool(this.toolId);
    this.configValues = {};
    for (const field of this.tool?.configFields ?? []) {
      this.configValues[field.key] =
        field.defaultValue !== undefined ? field.defaultValue : field.type === 'checkbox' ? false : '';
    }
    this.clearResult();
    this.files = [];
    this.replacementFile = null;
    this.certificateFile = null;
    this.password = '';
    this.outputFilename = '';
    this.engineWarning = '';
    this.cdr.markForCheck();
    void this.refreshEngineWarning();
  }

  private async refreshEngineWarning(): Promise<void> {
    if (!this.tool || this.tool.clientOnly || this.tool.capability !== 'requires-engine') {
      return;
    }
    if (!isPdfAdvancedBackendEnabled(this.pdfBackend.settings)) {
      this.engineWarning = 'Start tool-api to enable this tool.';
      this.cdr.markForCheck();
      return;
    }
    const health = await this.pdfBackend.healthDetailed();
    if (!health?.engines && !health?.capabilities) {
      this.engineWarning = 'Could not reach PDF health — engine availability unknown.';
      this.cdr.markForCheck();
      return;
    }
    const caps = health.capabilities ?? {};
    const engines = health.engines ?? {};
    const id = this.tool.id;
    let missing = '';
    if (id === 'ocr-pdf' && caps.ocr === false) missing = 'Tesseract OCR is not available on the API host.';
    else if (id === 'images-to-searchable-pdf' && caps.ocr === false) {
      missing = 'Tesseract OCR is not available on the API host.';
    } else if ((id === 'word-to-pdf' || id === 'excel-to-pdf' || id === 'powerpoint-to-pdf') && caps.officeToPdf === false) {
      missing = 'LibreOffice is not available on the API host.';
    } else if (id === 'url-to-pdf' && caps.urlToPdf === false) missing = 'Chromium is not available on the API host.';
    else if (id === 'pdf-to-pdfa' && caps.pdfA === false) missing = 'Ghostscript is not available (required for PDF/A).';
    else if (id === 'pdf-web-optimizer' && caps.webOptimize === false) {
      missing = 'qpdf/Ghostscript are not available (required for web optimize).';
    } else if (id === 'pdf-to-docx' && engines.libreOffice === false) {
      missing = 'LibreOffice missing — DOCX will use plain-text fallback only.';
    }
    this.engineWarning = missing;
    this.cdr.markForCheck();
  }

  get showHonestyBanner(): boolean {
    return (
      !!this.engineWarning ||
      !!this.tool?.honestyNote ||
      this.tool?.capability === 'heuristic' ||
      this.tool?.capability === 'requires-engine'
    );
  }

  get honestyBannerText(): string {
    if (this.engineWarning) return this.engineWarning;
    if (this.tool?.honestyNote) return this.tool.honestyNote;
    if (this.tool?.capability === 'heuristic') {
      return 'Heuristic / best-effort — results are approximate, not a trained ML model.';
    }
    if (this.tool?.capability === 'requires-engine') {
      return 'Requires a system engine on the API host (see PDF health /engines).';
    }
    return '';
  }

  get title(): string {
    return this.tool?.title ?? 'PDF Tool';
  }

  get description(): string {
    return this.tool?.description ?? '';
  }

  get needsUpload(): boolean {
    return !!this.tool && this.tool.input !== 'none' && this.tool.input !== 'url' && this.tool.input !== 'markdown';
  }

  get supportsMulti(): boolean {
    return this.tool?.input === 'multi-pdf' || this.tool?.input === 'images';
  }

  get isImagesInput(): boolean {
    return this.tool?.input === 'images';
  }

  get isOfficeInput(): boolean {
    return this.tool?.input === 'office';
  }

  get isUrlInput(): boolean {
    return this.tool?.input === 'url';
  }

  get isMarkdownInput(): boolean {
    return this.tool?.input === 'markdown';
  }

  get needsReplacementFile(): boolean {
    return this.tool?.id === 'pdf-page-replacer';
  }

  get needsCertificateFile(): boolean {
    return !!this.tool?.needsCertificate;
  }

  get acceptAttr(): string {
    if (!this.tool) return '.pdf,application/pdf';
    if (this.tool.accept) return this.tool.accept;
    if (this.tool.input === 'office') {
      return '.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    if (this.tool.input === 'images') {
      return 'image/*,.png,.jpg,.jpeg,.webp,.gif,.tif,.tiff,.bmp';
    }
    return '.pdf,application/pdf';
  }

  get showServerPrivacyBanner(): boolean {
    return !!this.tool && !this.tool.clientOnly && isPdfAdvancedBackendEnabled(this.pdfBackend.settings);
  }

  get hasFiles(): boolean {
    return this.files.length > 0;
  }

  get primaryFileName(): string {
    return this.files[0]?.name ?? '';
  }

  get primaryFileSize(): number {
    return this.files.reduce((sum, f) => sum + f.size, 0);
  }

  get canRunPrimaryAction(): boolean {
    if (this.loading || !this.tool) return false;
    if (this.tool.clientOnly) return true;
    if (!isPdfAdvancedBackendEnabled(this.pdfBackend.settings)) return false;
    if (this.tool.input === 'none' || this.tool.input === 'url' || this.tool.input === 'markdown') {
      if (this.tool.input === 'url' && !String(this.configValues['url'] ?? '').trim()) return false;
      if (this.tool.input === 'markdown' && !String(this.configValues['markdown'] ?? '').trim()) return false;
      return true;
    }
    if (!this.hasFiles) return false;
    if (this.needsReplacementFile && !this.replacementFile) return false;
    if (this.needsCertificateFile && !this.certificateFile) return false;
    if (this.tool.needsPassword && !this.password.trim()) return false;
    return true;
  }

  get canDownload(): boolean {
    if (this.loading) return false;
    if (this.resultBlob?.size) return true;
    if (this.resultText) return true;
    return false;
  }

  get canCopy(): boolean {
    return !this.loading && (!!this.resultText || this.resultJson != null);
  }

  get canClear(): boolean {
    return (
      !this.loading &&
      (this.hasFiles || !!this.resultBlob || !!this.resultText || this.resultJson != null || !!this.password)
    );
  }

  get showResultBanner(): boolean {
    return this.lastActionCompleted && !this.loading && this.canDownload;
  }

  get resultBannerText(): string {
    return this.lastActionMessage || 'Download or copy when you are satisfied.';
  }

  get resultBannerActionLabel(): string {
    if (this.isTextualOutput) return 'Copy result';
    return 'Download result';
  }

  get isTextualOutput(): boolean {
    const out = this.tool?.output;
    return out === 'text' || out === 'json' || out === 'html' || out === 'markdown' || out === 'csv';
  }

  get workflowStep(): 1 | 2 | 3 | 4 {
    if (
      this.tool?.input === 'none' ||
      this.tool?.input === 'url' ||
      this.tool?.input === 'markdown' ||
      this.tool?.clientOnly
    ) {
      if (this.lastActionCompleted) return 4;
      return 2;
    }
    if (!this.hasFiles) return 1;
    if (this.lastActionCompleted) return 4;
    if (this.needsConfigAttention) return 2;
    return 3;
  }

  get needsConfigAttention(): boolean {
    if (!this.tool) return false;
    if (this.tool.needsPassword && !this.password.trim()) return true;
    for (const field of this.tool.configFields ?? []) {
      if (
        field.type === 'password' ||
        field.key === 'query' ||
        field.key === 'question' ||
        field.key === 'url' ||
        field.key === 'markdown' ||
        field.key === 'values'
      ) {
        const v = this.configValues[field.key];
        if (v === undefined || v === '') return true;
      }
    }
    return false;
  }

  get emptyDropSteps(): [string, string, string] {
    const action = this.primaryActionLabel();
    if (this.isUrlInput) {
      return ['Enter a public page URL', 'Confirm options', `Run ${action} and download`];
    }
    if (this.isMarkdownInput) {
      return ['Paste Markdown', 'Confirm options', `Run ${action} and download`];
    }
    if (this.isImagesInput) {
      return ['Upload one or more images', 'Adjust OCR options', `Run ${action} and download`];
    }
    if (this.supportsMulti) {
      return ['Upload one or more PDFs', 'Adjust options if needed', `Run ${action} and download`];
    }
    if (this.isOfficeInput) {
      return ['Upload an Office document', 'Adjust options if needed', `Run ${action} and download`];
    }
    return ['Upload your PDF', 'Adjust options if needed', `Run ${action} and download`];
  }

  get previewText(): string {
    if (this.resultText) return this.resultText;
    if (this.resultJson != null) {
      try {
        return JSON.stringify(this.resultJson, null, 2);
      } catch {
        return String(this.resultJson);
      }
    }
    return '';
  }

  formatFileSize = formatFileSize;

  get pdfBackendMaxMb(): number {
    return this.pdfBackend.settings.maxUploadMb || 50;
  }

  get defaultFilenamePlaceholder(): string {
    return this.defaultOutputName(this.primaryFileName || this.tool?.id || 'output');
  }

  configFields(): PdfAdvancedConfigField[] {
    return this.tool?.configFields ?? [];
  }

  primaryActionLabel(): string {
    if (this.tool?.clientOnly) return 'Generate';
    if (this.tool?.output === 'json') return 'Analyze';
    if (this.isTextualOutput) return 'Convert';
    return 'Process';
  }

  primaryActionHint(): string {
    if (!this.tool) return 'Tool not found';
    if (this.tool.clientOnly) return 'Generate in your browser';
    if (!isPdfAdvancedBackendEnabled(this.pdfBackend.settings)) {
      return 'Start tool-api to enable this tool';
    }
    if (this.needsUpload && !this.hasFiles) return 'Upload a file first';
    if (this.needsCertificateFile && !this.certificateFile) return 'Upload a PKCS#12 certificate (.p12/.pfx)';
    if (this.needsReplacementFile && !this.replacementFile) return 'Upload a replacement PDF';
    if (this.tool.needsPassword && !this.password.trim()) return 'Enter the PDF password';
    return this.primaryActionLabel();
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const list = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (!list.length) return;
    this.addFiles(list);
  }

  onReplacementSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    this.replacementFile = file;
    this.clearResult();
    this.cdr.markForCheck();
  }

  onCertificateSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (file && !/\.(p12|pfx)$/i.test(file.name)) {
      pdfNotifyError(this.toast, 'Certificate must be a .p12 or .pfx file');
      this.certificateFile = null;
      this.cdr.markForCheck();
      return;
    }
    this.certificateFile = file;
    this.clearResult();
    this.cdr.markForCheck();
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.showDropZone = true;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.showDropZone = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.showDropZone = false;
    const list = event.dataTransfer?.files;
    if (!list?.length) return;
    this.addFiles(Array.from(list));
  }

  private addFiles(incoming: File[]): void {
    const maxBytes = Math.min(
      PDF_MAX_BYTES,
      (this.pdfBackend.settings.maxUploadMb || 50) * 1024 * 1024
    );
    const accepted: File[] = [];
    for (const file of incoming) {
      if (file.size > maxBytes) {
        pdfNotifyError(this.toast, `${file.name} exceeds size limit`);
        continue;
      }
      if (!this.isAcceptedFile(file)) {
        pdfNotifyError(this.toast, `Unsupported file type: ${file.name}`);
        continue;
      }
      accepted.push(file);
    }
    if (!accepted.length) {
      this.cdr.markForCheck();
      return;
    }
    if (this.supportsMulti) {
      this.files = [...this.files, ...accepted];
    } else {
      this.files = [accepted[0]];
    }
    this.clearResult();
    this.outputFilename = this.defaultOutputName(this.files[0]?.name ?? 'output');
    pdfNotifySuccess(
      this.toast,
      accepted.length === 1 ? `Loaded ${accepted[0].name}` : `Loaded ${accepted.length} files`
    );
    this.cdr.markForCheck();
  }

  private isAcceptedFile(file: File): boolean {
    if (!this.tool) return false;
    const name = file.name.toLowerCase();
    if (this.tool.accept) {
      const tokens = this.tool.accept.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
      if (tokens.some((t) => t.startsWith('.') && name.endsWith(t))) return true;
      if (file.type && tokens.includes(file.type.toLowerCase())) return true;
      // Fall through for broad mime wildcards already listed
    }
    if (this.tool.input === 'pdf' || this.tool.input === 'multi-pdf') {
      if (file.type === 'application/pdf' || name.endsWith('.pdf')) return true;
      if (this.tool.accept?.includes('zip') && (name.endsWith('.zip') || file.type.includes('zip'))) {
        return true;
      }
      return false;
    }
    if (this.tool.input === 'images') {
      if (file.type.startsWith('image/')) return true;
      return /\.(png|jpe?g|webp|gif|tiff?|bmp)$/i.test(name);
    }
    if (this.tool.input === 'office') {
      return /\.(docx?|xlsx?|pptx?)$/i.test(name);
    }
    return true;
  }

  onConfigChanged(): void {
    this.clearResult(false);
    this.cdr.markForCheck();
  }

  async runPrimaryAction(): Promise<void> {
    if (!this.tool) {
      pdfNotifyError(this.toast, `Unknown tool: ${this.toolId}`);
      return;
    }
    if (!this.canRunPrimaryAction) {
      pdfNotifyWarning(this.toast, this.primaryActionHint());
      return;
    }

    if (this.tool.clientOnly) {
      this.runClientOnly();
      return;
    }

    if (!isPdfAdvancedBackendEnabled(this.pdfBackend.settings)) {
      pdfNotifyError(this.toast, 'This tool is unavailable right now. Please try again shortly.');
      return;
    }

    this.loading = true;
    this.loadingMessage = `Running ${this.tool.title}…`;
    this.loadingDetail = 'Secure server · file deleted after job';
    this.cdr.markForCheck();

    try {
      const form = this.buildFormData();
      await this.executeBackend(this.tool, form);
      this.lastActionCompleted = true;
      this.lastActionMessage = `${this.tool.title} completed`;
      pdfNotifySuccess(this.toast, this.lastActionMessage);
    } catch (error) {
      pdfNotifyFailure(this.toast, error, `Could not complete ${this.tool?.title || 'this action'}`);
    } finally {
      this.loading = false;
      this.loadingMessage = 'Processing…';
      this.loadingDetail = '';
      this.cdr.markForCheck();
    }
  }

  private runClientOnly(): void {
    if (this.toolId !== 'pdf-password-generator') {
      pdfNotifyError(this.toast, 'Client-only logic is not available for this tool');
      return;
    }
    const length = Math.max(8, Math.min(128, Number(this.configValues['length'] ?? 16) || 16));
    const symbols = this.configValues['symbols'] !== false;
    const alphabet =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' +
      (symbols ? '!@#$%^&*()-_=+[]{}' : '');
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    const password = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
    this.resultText = password;
    this.resultBlob = null;
    this.resultJson = null;
    this.outputFilename = 'pdf-password.txt';
    this.lastActionCompleted = true;
    this.lastActionMessage = 'Password generated in your browser';
    pdfNotifySuccess(this.toast, this.lastActionMessage);
    this.cdr.markForCheck();
  }

  private buildFormData(): FormData {
    const form = new FormData();
    const tool = this.tool!;

    if (tool.input === 'multi-pdf' || tool.input === 'images') {
      this.files.forEach((f, i) => form.append('files', f, f.name || `file-${i}`));
    } else if (tool.input !== 'none' && this.files[0]) {
      form.append('file', this.files[0], this.files[0].name);
    }

    if (this.replacementFile) {
      form.append('replacement', this.replacementFile, this.replacementFile.name);
    }

    if (this.certificateFile) {
      form.append('certificate', this.certificateFile, this.certificateFile.name);
    }

    if (tool.needsPassword && this.password.trim()) {
      form.append('password', encodeSensitivePayload(this.password.trim()));
    }

    for (const field of tool.configFields ?? []) {
      const raw = this.configValues[field.key];
      if (raw === undefined || raw === null) continue;
      const value = typeof raw === 'boolean' ? String(raw) : String(raw);
      if (!value && field.type !== 'checkbox') continue;
      if (SENSITIVE_KEYS.has(field.key) || field.type === 'password') {
        form.append(field.key, encodeSensitivePayload(value));
      } else {
        form.append(field.key, value);
      }
    }

    return form;
  }

  private async executeBackend(tool: PdfAdvancedToolDef, form: FormData): Promise<void> {
    const endpoint = tool.endpoint;
    if (!endpoint) throw new Error('This tool has no API endpoint');

    if (tool.asyncJob) {
      await this.executeAsyncJob(tool, form);
      return;
    }

    // OCR can return PDF / text / DOCX; form export JSON / XFDF.
    const effectiveOutput =
      tool.id === 'ocr-pdf' && String(this.configValues['mode'] ?? 'searchable') === 'text'
        ? 'text'
        : tool.id === 'ocr-pdf' && String(this.configValues['mode'] ?? 'searchable') === 'docx'
          ? 'docx'
          : tool.id === 'pdf-form-export' && String(this.configValues['format'] ?? 'json') === 'xfdf'
            ? 'xfdf'
            : tool.output;

    switch (effectiveOutput) {
      case 'json': {
        const data = await this.pdfBackend.advancedPostJson<unknown>(endpoint, form);
        this.resultJson = data;
        this.resultText = JSON.stringify(data, null, 2);
        this.resultBlob = new Blob([this.resultText], { type: 'application/json' });
        this.outputFilename = this.defaultOutputName(this.primaryFileName || tool.id, 'json');
        break;
      }
      case 'text':
      case 'html':
      case 'markdown':
      case 'csv':
      case 'xfdf': {
        const text = await this.pdfBackend.advancedPostText(endpoint, form);
        this.resultText = text;
        this.resultJson = null;
        const mime = this.mimeForOutput(effectiveOutput);
        this.resultBlob = new Blob([text], { type: mime });
        this.outputFilename = this.defaultOutputName(
          this.primaryFileName || tool.id,
          this.extForOutput(effectiveOutput)
        );
        break;
      }
      default: {
        const blob = await this.pdfBackend.advanced(endpoint, form);
        this.resultBlob = blob;
        this.resultText = '';
        this.resultJson = null;
        this.outputFilename = this.defaultOutputName(
          this.primaryFileName || tool.id,
          this.extForOutput(tool.output)
        );
        break;
      }
    }
  }

  private async executeAsyncJob(tool: PdfAdvancedToolDef, form: FormData): Promise<void> {
    this.loadingMessage = `Starting ${tool.title}…`;
    this.loadingDetail = 'Secure server · file deleted after job';
    this.cdr.markForCheck();

    const submitted = await this.pdfBackend.submitJob(tool.endpoint, form);
    const jobId = submitted.jobId;
    if (!jobId) {
      throw new Error('Server did not return a job id');
    }

    const started = Date.now();
    const timeoutMs = 10 * 60 * 1000;
    while (Date.now() - started < timeoutMs) {
      const status = await this.pdfBackend.getJobStatus(jobId);
      const pct = Math.round((status.progress ?? 0) * 100);
      const done = (status.completed ?? 0) + (status.failed ?? 0);
      const total = status.total ?? 0;
      this.loadingMessage = status.message || `${tool.title}: ${status.status}`;
      this.loadingDetail =
        total > 0
          ? `${done}/${total} files · ${pct}% · not stored after job`
          : 'Processed on secure server · deleted after job';
      this.cdr.markForCheck();

      if (status.status === 'COMPLETED' && status.downloadReady) {
        const blob = await this.pdfBackend.downloadJob(jobId);
        this.resultBlob = blob;
        this.resultText = '';
        this.resultJson = status;
        const hinted = status.resultFilename ||
          this.defaultOutputName(this.primaryFileName || tool.id, this.extForOutput(tool.output));
        this.outputFilename = hinted;
        if ((status.failed ?? 0) > 0) {
          pdfNotifyWarning(
            this.toast,
            `Job finished with ${status.failed} failure(s); download includes successful outputs`
          );
        }
        return;
      }
      if (status.status === 'FAILED' || status.status === 'EXPIRED') {
        throw new Error(status.message || `Batch job ${status.status.toLowerCase()}`);
      }
      await new Promise((r) => setTimeout(r, 700));
    }
    throw new Error('Batch job timed out — try fewer files or a smaller ZIP');
  }

  downloadResult(): void {
    if (!this.canDownload) return;
    const name = this.outputFilename || this.defaultOutputName(this.primaryFileName || 'result');
    try {
      if (this.resultBlob?.size) {
        downloadBlob(this.resultBlob, name);
      } else if (this.resultText) {
        downloadText(this.resultText, name, this.mimeForOutput(this.tool?.output ?? 'text'));
      } else {
        return;
      }
      pdfNotifySuccess(this.toast, 'Download started');
    } catch (error) {
      pdfNotifyFailure(this.toast, error, 'Could not download the result');
    }
  }

  copyResult(): void {
    const text = this.previewText;
    if (!text) return;
    void navigator.clipboard.writeText(text).then(
      () => pdfNotifySuccess(this.toast, 'Copied to clipboard'),
      () => pdfNotifyError(this.toast, 'Could not copy to clipboard')
    );
  }

  onResultBannerAction(): void {
    if (this.isTextualOutput) {
      this.copyResult();
      return;
    }
    this.downloadResult();
  }

  clearAll(): void {
    this.files = [];
    this.replacementFile = null;
    this.certificateFile = null;
    this.password = '';
    this.clearResult();
    this.outputFilename = '';
    for (const field of this.tool?.configFields ?? []) {
      this.configValues[field.key] =
        field.defaultValue !== undefined ? field.defaultValue : field.type === 'checkbox' ? false : '';
    }
    this.cdr.markForCheck();
  }

  removeFile(index: number): void {
    this.files = this.files.filter((_, i) => i !== index);
    this.clearResult();
    this.cdr.markForCheck();
  }

  private clearResult(mark = true): void {
    this.resultBlob = null;
    this.resultText = '';
    this.resultJson = null;
    this.lastActionCompleted = false;
    this.lastActionMessage = '';
    if (mark) this.cdr.markForCheck();
  }

  private mimeForOutput(output: PdfAdvancedOutputKind): string {
    switch (output) {
      case 'pdf':
        return 'application/pdf';
      case 'zip':
        return 'application/zip';
      case 'epub':
        return 'application/epub+zip';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'xfdf':
        return 'application/vnd.adobe.xfdf';
      case 'json':
        return 'application/json';
      case 'html':
        return 'text/html';
      case 'markdown':
        return 'text/markdown';
      case 'csv':
        return 'text/csv';
      default:
        return 'text/plain';
    }
  }

  private extForOutput(output: PdfAdvancedOutputKind): string {
    switch (output) {
      case 'pdf':
        return 'pdf';
      case 'zip':
        return 'zip';
      case 'epub':
        return 'epub';
      case 'docx':
        return 'docx';
      case 'xfdf':
        return 'xfdf';
      case 'json':
        return 'json';
      case 'html':
        return 'html';
      case 'markdown':
        return 'md';
      case 'csv':
        return 'csv';
      default:
        return 'txt';
    }
  }

  private defaultOutputName(sourceName: string, ext?: string): string {
    const extension = ext ?? this.extForOutput(this.tool?.output ?? 'pdf');
    const base = sourceName.replace(/\.[^.]+$/, '') || this.tool?.id || 'output';
    return `${base}.${extension}`;
  }
}
