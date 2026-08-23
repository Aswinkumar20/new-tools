/** Synthetic order-fulfillment analytics (education / research). */

export function buildBpmnAnalyticsSampleObject(): Record<string, unknown> {
  return {
    name: 'Order fulfillment analytics',
    process: 'Order Fulfillment',
    cases: 1280,
    activities: [
      {
        id: 'StartEvent_1',
        name: 'Order received',
        kind: 'event',
        frequency: 1280,
        avgDurationMs: 0,
        waitMs: 0,
        failures: 0
      },
      {
        id: 'Task_Review',
        name: 'Review order',
        kind: 'task',
        frequency: 1280,
        avgDurationMs: 420000,
        waitMs: 180000,
        failures: 12
      },
      {
        id: 'Gateway_1',
        name: 'In stock?',
        kind: 'gateway',
        frequency: 1280,
        avgDurationMs: 8000,
        waitMs: 2000,
        failures: 0
      },
      {
        id: 'Task_Ship',
        name: 'Ship order',
        kind: 'task',
        frequency: 980,
        avgDurationMs: 860000,
        waitMs: 540000,
        failures: 4
      },
      {
        id: 'Task_Backorder',
        name: 'Create backorder',
        kind: 'task',
        frequency: 300,
        avgDurationMs: 1200000,
        waitMs: 2100000,
        failures: 18
      },
      {
        id: 'EndEvent_1',
        name: 'Fulfilled',
        kind: 'event',
        frequency: 1280,
        avgDurationMs: 0,
        waitMs: 0,
        failures: 0
      }
    ],
    flows: [
      { id: 'Flow_1', name: '', source: 'StartEvent_1', target: 'Task_Review', frequency: 1280 },
      { id: 'Flow_2', name: '', source: 'Task_Review', target: 'Gateway_1', frequency: 1280 },
      { id: 'Flow_3', name: 'Yes', source: 'Gateway_1', target: 'Task_Ship', frequency: 980 },
      { id: 'Flow_4', name: 'No', source: 'Gateway_1', target: 'Task_Backorder', frequency: 300 },
      { id: 'Flow_5', name: '', source: 'Task_Ship', target: 'EndEvent_1', frequency: 980 },
      { id: 'Flow_6', name: '', source: 'Task_Backorder', target: 'EndEvent_1', frequency: 300 }
    ]
  };
}

export const BPMN_ANALYTICS_JSON_SAMPLE = JSON.stringify(buildBpmnAnalyticsSampleObject(), null, 2);

export const BPMN_ANALYTICS_CSV_SAMPLE = `id,name,kind,frequency,avg_duration_ms,wait_ms,failures
Task_Review,Review order,task,1280,420000,180000,12
Task_Ship,Ship order,task,980,860000,540000,4
Task_Backorder,Create backorder,task,300,1200000,2100000,18
`;
