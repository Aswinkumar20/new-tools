import { buildSampleFhirBundleJson, parseFhirText } from './fhir-parse.utils';
import { findMatchingTreeNodeIds, flattenVisibleTreeNodes } from './fhir-resource-viewer.utils';

describe('fhir-resource-viewer.utils tree search', () => {
  it('finds collapsed descendants and their ancestors', () => {
    const parsed = parseFhirText(buildSampleFhirBundleJson(), '.json');
    const matchIds = findMatchingTreeNodeIds(parsed.tree, 'patient-001');
    expect(matchIds.size).toBeGreaterThan(0);

    const collapsed = new Set<string>();
    const hidden = flattenVisibleTreeNodes(parsed.tree, collapsed).some(({ node }) =>
      String(node.value).includes('patient-001')
    );
    expect(hidden).toBe(false);

    const expanded = new Set(matchIds);
    const visible = flattenVisibleTreeNodes(parsed.tree, expanded).filter(({ node }) => matchIds.has(node.id));
    expect(visible.some(({ node }) => String(node.value).includes('patient-001'))).toBe(true);
  });
});
