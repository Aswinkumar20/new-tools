import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { NftMetadataViewerComponent } from './nft-metadata-viewer';

describe('NftMetadataViewerComponent', () => {
  let component: NftMetadataViewerComponent;
  let fixture: ComponentFixture<NftMetadataViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NftMetadataViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(NftMetadataViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with upload suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.metadata).toBeNull();
    expect(component.primarySuggestion?.id).toBe('nft-image');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('nft-image');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('loads NFT metadata and filters traits', async () => {
    const json = JSON.stringify({
      name: 'Cool NFT',
      description: 'A sample token',
      image: 'ipfs://bafy123',
      attributes: [
        { trait_type: 'Background', value: 'Blue' },
        { trait_type: 'Eyes', value: 'Laser' }
      ]
    });

    const file = new File([json], 'meta.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => json });

    await component.handleFiles([file]);

    expect(component.metadata?.name).toBe('Cool NFT');
    expect(component.metadata?.imageUrl).toContain('ipfs.io/ipfs/bafy123');
    expect(component.traitCount).toBe(2);

    component.onTraitSearchChange('laser');
    expect(component.filteredTraits).toHaveLength(1);
    expect(component.filteredTraits[0].value).toBe('Laser');
    expect(toast.success).toHaveBeenCalled();
  });
});
