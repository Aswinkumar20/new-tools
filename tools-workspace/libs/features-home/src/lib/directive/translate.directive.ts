import { Directive, Input, OnInit, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslationService } from '../services/translation.service';
import { LanguageService } from '../services/language.service';

@Directive({
  selector: '[appTranslate]',
  standalone: true
})
export class TranslateDirective implements OnInit, OnDestroy {
  @Input('appTranslate') translationKey!: string;
  @Input() translateParams?: { [key: string]: string | number };

  private subscription?: Subscription;
  private originalText?: string;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
    private translationService: TranslationService,
    private languageService: LanguageService
  ) {
    // Store original text
    this.originalText = this.el.nativeElement.textContent?.trim();
  }

  ngOnInit(): void {
    if (!this.translationKey) {
      // Use element text as key if no key provided
      this.translationKey = this.originalText || '';
    }

    this.updateTranslation();

    // Subscribe to language changes
    this.subscription = this.languageService.currentLanguage$.subscribe(() => {
      this.updateTranslation();
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  private updateTranslation(): void {
    const translation = this.translationService.translate(
      this.translationKey,
      this.translateParams
    );
    
    // Update text content while preserving HTML structure if needed
    if (this.el.nativeElement.children.length === 0) {
      this.renderer.setProperty(this.el.nativeElement, 'textContent', translation);
    } else {
      // If element has children, update only the text nodes
      const textNodes = this.getTextNodes(this.el.nativeElement);
      if (textNodes.length > 0) {
        textNodes[0].textContent = translation;
      }
    }
  }

  private getTextNodes(node: Node): Text[] {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
      node,
      NodeFilter.SHOW_TEXT,
      null
    );

    let textNode;
    while ((textNode = walker.nextNode())) {
      textNodes.push(textNode as Text);
    }

    return textNodes;
  }
}

