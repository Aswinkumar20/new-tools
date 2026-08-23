/** Synthetic order-pricing decision model (education / research). */

export function buildDecisionModelSampleObject(): Record<string, unknown> {
  return {
    name: 'Order pricing model',
    version: '1.2',
    decisions: [
      {
        id: 'D_Segment',
        name: 'Customer segment',
        kind: 'table',
        hitPolicy: 'UNIQUE',
        dependsOn: [],
        inputs: ['Loyalty tier', 'Orders YTD'],
        outputs: ['Segment']
      },
      {
        id: 'D_Discount',
        name: 'Customer discount',
        kind: 'table',
        hitPolicy: 'COLLECT',
        dependsOn: ['D_Segment'],
        inputs: ['Segment', 'Order amount'],
        outputs: ['Discount %']
      },
      {
        id: 'D_Tax',
        name: 'Tax rate',
        kind: 'table',
        hitPolicy: 'UNIQUE',
        dependsOn: [],
        inputs: ['Region'],
        outputs: ['Tax %']
      },
      {
        id: 'D_Price',
        name: 'Final price',
        kind: 'expression',
        hitPolicy: '',
        dependsOn: ['D_Discount', 'D_Tax'],
        inputs: ['List price', 'Discount %', 'Tax %'],
        outputs: ['Final price']
      }
    ],
    dependencies: [
      { source: 'D_Segment', target: 'D_Discount', type: 'information' },
      { source: 'D_Discount', target: 'D_Price', type: 'information' },
      { source: 'D_Tax', target: 'D_Price', type: 'information' }
    ],
    rules: [
      { decisionId: 'D_Segment', when: 'GOLD and orders >= 12', then: 'VIP', annotation: 'Loyal gold' },
      { decisionId: 'D_Segment', when: 'GOLD', then: 'Preferred', annotation: '' },
      { decisionId: 'D_Segment', when: 'SILVER', then: 'Standard', annotation: '' },
      { decisionId: 'D_Segment', when: '-', then: 'New', annotation: 'Default' },
      { decisionId: 'D_Discount', when: 'VIP / amount >= 500', then: '15%', annotation: '' },
      { decisionId: 'D_Discount', when: 'Preferred / amount >= 250', then: '8%', annotation: '' },
      { decisionId: 'D_Discount', when: 'Standard', then: '3%', annotation: '' },
      { decisionId: 'D_Tax', when: 'EU', then: '20%', annotation: '' },
      { decisionId: 'D_Tax', when: 'US', then: '0%', annotation: 'Tax-exempt demo' },
      { decisionId: 'D_Price', when: 'list * (1 - discount) * (1 + tax)', then: 'final', annotation: 'Literal expression' }
    ]
  };
}

export const DECISION_MODEL_JSON_SAMPLE = JSON.stringify(buildDecisionModelSampleObject(), null, 2);

export const DECISION_MODEL_CSV_SAMPLE = `decision,when,then
Customer segment,GOLD and orders >= 12,VIP
Customer discount,VIP / amount >= 500,15%
Tax rate,EU,20%
`;
