import { findMedicalWorkspace, isDocumentFullscreen } from './medical-fullscreen.utils';

describe('medical-fullscreen.utils', () => {
  it('finds the medical workspace host', () => {
    const root = document.createElement('div');
    const workspace = document.createElement('div');
    workspace.setAttribute('data-medical-workspace', '');
    root.appendChild(workspace);
    expect(findMedicalWorkspace(root)).toBe(workspace);
  });

  it('reports document fullscreen as false in jsdom', () => {
    expect(isDocumentFullscreen()).toBe(false);
  });
});
