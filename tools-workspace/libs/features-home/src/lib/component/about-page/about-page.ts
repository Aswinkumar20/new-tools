import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarketingIconComponent } from '../marketing-icon/marketing-icon';
import { TOOL_CATEGORIES } from '../../config/tools-catalog.generated';
import { sortCategoriesForHome } from '../../config/tools-catalog.helpers';
import {
  ABOUT_AUDIENCES,
  ABOUT_COMPARE,
  ABOUT_CTA,
  ABOUT_FAQS,
  ABOUT_HERO,
  ABOUT_HOW_IT_WORKS,
  ABOUT_MILESTONES,
  ABOUT_ORIGIN,
  ABOUT_PRINCIPLES,
  ABOUT_STORY,
  ABOUT_VALUES,
  AboutStat,
} from '../../constants/about-page.constants';

export interface AboutCategorySpotlight {
  name: string;
  path: string;
  description?: string;
  toolCount: number;
}

@Component({
  selector: 'lib-about-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MarketingIconComponent],
  templateUrl: './about-page.html',
  styleUrl: './about-page.scss',
})
export class AboutPageComponent implements AfterViewInit {
  private readonly cdr = inject(ChangeDetectorRef);
  protected pageReady = false;
  protected readonly hero = ABOUT_HERO;
  protected readonly origin = ABOUT_ORIGIN;
  protected readonly howItWorks = ABOUT_HOW_IT_WORKS;
  protected readonly milestones = ABOUT_MILESTONES;
  protected readonly story = ABOUT_STORY;
  protected readonly audiences = ABOUT_AUDIENCES;
  protected readonly values = ABOUT_VALUES;
  protected readonly principles = ABOUT_PRINCIPLES;
  protected readonly compareRows = ABOUT_COMPARE;
  protected readonly faqs = ABOUT_FAQS;
  protected readonly cta = ABOUT_CTA;
  protected readonly stats = this.buildStats();
  protected readonly spotlightCategories = this.buildSpotlightCategories();

  ngAfterViewInit(): void {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        this.pageReady = true;
        this.cdr.markForCheck();
      });
    } else {
      this.pageReady = true;
    }
  }

  private buildStats(): AboutStat[] {
    const totalTools = TOOL_CATEGORIES.reduce(
      (count, category) => count + (category.subCategories?.length ?? 0),
      0
    );
    const categoryCount = TOOL_CATEGORIES.length;

    return [
      {
        value: `${totalTools}+`,
        label: 'Tools',
        detail: 'PDF, text, images, data, and more',
      },
      {
        value: String(categoryCount),
        label: 'Categories',
        detail: 'From word counters to file viewers',
      },
      {
        value: '100%',
        label: 'Free',
        detail: 'No paywall on the basics',
      },
      {
        value: 'Local',
        label: 'In-browser',
        detail: 'Most work stays on your device',
      },
    ];
  }

  private buildSpotlightCategories(): AboutCategorySpotlight[] {
    return sortCategoriesForHome(TOOL_CATEGORIES)
      .slice(0, 12)
      .map((category) => ({
        name: category.name,
        path: `/${category.path}`,
        description: category.description,
        toolCount: category.subCategories?.length ?? 0,
      }));
  }
}
