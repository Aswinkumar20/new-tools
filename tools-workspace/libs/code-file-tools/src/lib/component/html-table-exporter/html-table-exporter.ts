import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { cftCopyText } from '../../shared/cft-clipboard.util';
import { cftDownloadBlob } from '../../shared/cft-download.util';
import type { CftRelatedToolLink, CftToolSuggestion } from '../../shared/cft-tool-suggestion.model';
import {
  HTML_TABLE_DEFAULT_FORMAT,
  HTML_TABLE_RELATED_TOOLS,
  HTML_TABLE_SAMPLE
} from '../../constants/html-table-exporter.constants';
import type {
  HtmlTableData,
  HtmlTableExportFormat,
  HtmlTableExportResult
} from '../../types/html-table-exporter.types';
import { formatClipboardBytes } from '../../utils/clipboard-history.utils';
import {
  buildTableExportResult,
  parseHtmlTable,
  resolveHtmlTableExporterSuggestion
} from '../../utils/html-table-exporter.utils';

@Component({
  selector: 'lib-html-table-exporter',
  standalone: true,
  templateUrl: './html-table-exporter.html',
  styleUrls: ['./html-table-exporter.scss'],
  imports: [RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HtmlTableExporterComponent {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  readonly relatedTools: ReadonlyArray<CftRelatedToolLink> = HTML_TABLE_RELATED_TOOLS;

  readonly htmlInput = signal(HTML_TABLE_SAMPLE);
  readonly exportFormat = signal<HtmlTableExportFormat>(HTML_TABLE_DEFAULT_FORMAT);
  readonly includeHeaders = signal(true);
  readonly errors = signal<string[]>([]);
  readonly tableData = signal<HtmlTableData | null>(null);
  readonly exportResult = signal<HtmlTableExportResult | null>(null);
  readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasTableData = computed(() => this.tableData() !== null);
  readonly hasExportResult = computed(() => this.exportResult() !== null);
  readonly rowCount = computed(() => this.tableData()?.rows.length ?? 0);
  readonly columnCount = computed(() => this.tableData()?.headers.length ?? 0);

  readonly primarySuggestion = computed<CftToolSuggestion | null>(() => {
    const suggestion = resolveHtmlTableExporterSuggestion(
      this.htmlInput(),
      this.exportFormat(),
      this.hasTableData(),
      this.errors()[0] ?? null
    );
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.parseTable();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  onInputChange(value: string): void {
    this.htmlInput.set(value);
    this.parseTable();
  }

  onFormatChange(format: HtmlTableExportFormat): void {
    this.exportFormat.set(format);
    this.export();
  }

  parseTable(): void {
    this.errors.set([]);
    this.tableData.set(null);
    this.exportResult.set(null);

    const outcome = parseHtmlTable(this.htmlInput());
    if (outcome.error) {
      this.errors.set([outcome.error]);
      return;
    }
    if (!outcome.data) {
      return;
    }

    this.tableData.set(outcome.data);
    this.export();
  }

  export(): void {
    const data = this.tableData();
    if (!data) {
      return;
    }

    try {
      this.exportResult.set(
        buildTableExportResult(data, this.exportFormat(), this.includeHeaders())
      );
    } catch (error) {
      this.errors.set([`Export failed: ${(error as Error)?.message ?? 'Unknown error'}`]);
    }
  }

  copyInput(): void {
    void cftCopyText(this.toast, this.htmlInput(), 'Input');
  }

  copyOutput(): void {
    const result = this.exportResult();
    if (result) {
      void cftCopyText(this.toast, result.content, 'Output');
    }
  }

  downloadExport(): void {
    const result = this.exportResult();
    if (!result) {
      return;
    }

    try {
      cftDownloadBlob(new Blob([result.content], { type: result.mimeType }), result.filename);
      this.toast.success('Export downloaded');
    } catch {
      this.toast.error('Could not download export');
    }
  }

  loadSample(): void {
    this.htmlInput.set(HTML_TABLE_SAMPLE);
    this.parseTable();
    this.toast.info('Sample table loaded');
  }

  clear(): void {
    this.htmlInput.set('');
    this.tableData.set(null);
    this.exportResult.set(null);
    this.errors.set([]);
    this.toast.info('Editors cleared');
  }

  formatBytes(value: number): string {
    return formatClipboardBytes(value);
  }

  getExportSize(content: string): string {
    return formatClipboardBytes(new Blob([content]).size);
  }
}
