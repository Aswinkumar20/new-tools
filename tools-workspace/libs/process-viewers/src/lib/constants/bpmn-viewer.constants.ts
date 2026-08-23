import type { BpmnRelatedToolLink } from '../types/bpmn-viewer.types';

export const BPMN_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.bpmn', '.xml'];

export const BPMN_ACCEPT_ATTR = '.bpmn,.xml,application/xml,text/xml';

/** Short label for UI badges and empty-state copy. */
export const BPMN_FORMATS_LABEL = '.bpmn, .xml';

export const BPMN_FORMATS_HINT =
  'BPMN 2.0 XML from Camunda, bpmn.io, and similar tools';

/** Keep huge enterprise diagrams from locking the tab. */
export const BPMN_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const BPMN_RELATED_TOOLS: ReadonlyArray<BpmnRelatedToolLink> = [
  {
    label: 'BPMN Analytics Viewer',
    description: 'Bottlenecks and activity overlays',
    path: '/process-viewers/bpmn-analytics-viewer'
  },
  {
    label: 'XES Viewer',
    description: 'Explore process-mining event logs',
    path: '/file-viewers/xes-viewer'
  },
  {
    label: 'DMN Viewer',
    description: 'Decision tables and DRD',
    path: '/process-viewers/dmn-viewer'
  },
  {
    label: 'PNML Viewer',
    description: 'Petri nets and tokens',
    path: '/process-viewers/pnml-viewer'
  },
  {
    label: 'Mermaid Diagram Viewer',
    description: 'Text-to-diagram preview (coming soon)',
    path: '/diagram-viewers/mermaid-diagram-viewer'
  }
];

export const BPMN_STYLESHEET_HREFS: ReadonlyArray<string> = [
  'bpmn-js/diagram-js.css',
  'bpmn-js/bpmn-js.css',
  'bpmn-js/bpmn-font/css/bpmn.css'
];

export const BPMN_SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_EasyToolHub"
  targetNamespace="https://easytoolhub.local/bpmn">
  <bpmn:process id="Process_Order" name="Order Fulfillment" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Order received">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Task_Review" name="Review order">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:exclusiveGateway id="Gateway_1" name="In stock?">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:task id="Task_Ship" name="Ship order">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_5</bpmn:outgoing>
    </bpmn:task>
    <bpmn:task id="Task_Backorder" name="Create backorder">
      <bpmn:incoming>Flow_4</bpmn:incoming>
      <bpmn:outgoing>Flow_6</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="EndEvent_1" name="Fulfilled">
      <bpmn:incoming>Flow_5</bpmn:incoming>
      <bpmn:incoming>Flow_6</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_Review" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_Review" targetRef="Gateway_1" />
    <bpmn:sequenceFlow id="Flow_3" name="Yes" sourceRef="Gateway_1" targetRef="Task_Ship" />
    <bpmn:sequenceFlow id="Flow_4" name="No" sourceRef="Gateway_1" targetRef="Task_Backorder" />
    <bpmn:sequenceFlow id="Flow_5" sourceRef="Task_Ship" targetRef="EndEvent_1" />
    <bpmn:sequenceFlow id="Flow_6" sourceRef="Task_Backorder" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_Order">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="152" y="102" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="130" y="145" width="80" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Review_di" bpmnElement="Task_Review">
        <dc:Bounds x="240" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_1_di" bpmnElement="Gateway_1" isMarkerVisible="true">
        <dc:Bounds x="395" y="95" width="50" height="50" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="392" y="65" width="56" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Ship_di" bpmnElement="Task_Ship">
        <dc:Bounds x="500" y="40" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Backorder_di" bpmnElement="Task_Backorder">
        <dc:Bounds x="500" y="160" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="662" y="102" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="654" y="145" width="52" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="188" y="120" />
        <di:waypoint x="240" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="340" y="120" />
        <di:waypoint x="395" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="420" y="95" />
        <di:waypoint x="420" y="80" />
        <di:waypoint x="500" y="80" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4">
        <di:waypoint x="420" y="145" />
        <di:waypoint x="420" y="200" />
        <di:waypoint x="500" y="200" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_5_di" bpmnElement="Flow_5">
        <di:waypoint x="600" y="80" />
        <di:waypoint x="680" y="80" />
        <di:waypoint x="680" y="102" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_6_di" bpmnElement="Flow_6">
        <di:waypoint x="600" y="200" />
        <di:waypoint x="680" y="200" />
        <di:waypoint x="680" y="138" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;
