import Modeler from 'bpmn-js/lib/Modeler';

import PropertiesPanel from '../properties-panel';

import customModdleExtension from '../moddle/custom.json';
import telsoftModdleExtension from '../moddle/telsoft.json';
import activitiModdleExtension from '../moddle/activiti.json';
import formModdleExtension from '../moddle/form.json';
import customPaletteModule from '../palette';

import type { ModuleItem } from './types';

type AnyModeler = any;

export const emptyDiagramXML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:activiti="http://activiti.org/bpmn" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:telsoft="http://telsoft.com.vn/bpmn" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:tns="http://bpmn.telsoft.com.vn/definitions/_1454043010812" xmlns:xsd="http://www.w3.org/2001/XMLSchema" id="_1454043010812" name="" targetNamespace="http://bpmn.telsoft.com.vn/definitions/_1454043010812" exporter="TELSOFT BPMN Editor" exporterVersion="1.99" xsi:schemaLocation="http://www.omg.org/spec/BPMN/20100524/MODEL http://bpmn.telsoft.com.vn/schemas/BPMN20.xsd">
  <process id="PROCESS_ID" processType="None" isClosed="false" isExecutable="true">
    <extensionElements>
      <activiti:executionListener class="telsoft.app.activiti.Listener.EndProccessListener" event="end" />
    </extensionElements>
    <startEvent id="StartEvent_1" name="Start Event" isInterrupting="true">
    </startEvent>
  </process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="PROCESS_ID">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="150" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`;

export function normalizeXmlForImport(xml?: string | null) {
  if (!xml) return xml || '';

  // Convert <string> inside <activiti:field> to <activiti:string> so moddle can parse it
  return xml
    .replace(/(<activiti:field\\b[^>]*>\\s*)<string>/g, '$1<activiti:string>')
    .replace(/<\\/string>(\\s*<\\/activiti:field>)/g, '</activiti:string>$1');
}

export function denormalizeXmlForExport(xml?: string | null) {
  if (!xml) return xml || '';

  // Convert back to the original unprefixed <string> tags
  return xml
    .replace(/(<activiti:field\\b[^>]*>\\s*)<activiti:string>/g, '$1<string>')
    .replace(/<\\/activiti:string>(\\s*<\\/activiti:field>)/g, '</string>$1');
}

export interface BpmnEditorOptions {
  container: HTMLElement;
  propertiesContainer: HTMLElement;
  moduleData?: ModuleItem[];
  initialXml?: string;
  additionalModules?: unknown[];
  moddleExtensions?: Record<string, unknown>;
  keyboardBindTo?: HTMLElement;
  enableAutoLabelFix?: boolean;
  onXmlChanged?: (xml: string) => void;
  onError?: (error: unknown) => void;
}

export interface BpmnEditorApi {
  modeler: AnyModeler;
  propertiesPanel: PropertiesPanel;
  setModules: (modules: ModuleItem[]) => void;
  getModules: () => ModuleItem[];
  loadXml: (xml?: string) => Promise<void>;
  getXml: () => Promise<string>;
  resetToEmpty: () => Promise<void>;
  destroy: () => void;
}

export function createBpmnEditor(options: BpmnEditorOptions): BpmnEditorApi {
  const {
    container,
    propertiesContainer,
    initialXml,
    moduleData = [],
    additionalModules,
    moddleExtensions,
    keyboardBindTo = document.body,
    enableAutoLabelFix = true,
    onXmlChanged,
    onError
  } = options;

  let modules: ModuleItem[] = Array.isArray(moduleData) ? moduleData : [];

  const modeler: AnyModeler = new Modeler({
    container,
    additionalModules: additionalModules || [customPaletteModule],
    moddleExtensions: moddleExtensions || {
      custom: customModdleExtension,
      telsoft: telsoftModdleExtension,
      activiti: activitiModdleExtension,
      form: formModdleExtension
    },
    keyboard: {
      bindTo: keyboardBindTo
    }
  });

  const propertiesPanel = new PropertiesPanel({
    container: propertiesContainer,
    modeler
  });

  const eventBus = modeler.get('eventBus');
  const commandStack = modeler.get('commandStack');

  function fixSequenceFlowLabels() {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    const elementFactory = modeler.get('elementFactory');
    const canvas = modeler.get('canvas');

    const connections = elementRegistry.getAll().filter((el: AnyModeler) =>
      el && el.waypoints && el.businessObject && el.businessObject.$type === 'bpmn:SequenceFlow'
    );

    const getLabelPosition = (waypoints: AnyModeler[]) => {
      if (!Array.isArray(waypoints) || waypoints.length < 2) {
        return { x: 0, y: 0 };
      }

      const midIndex = Math.floor((waypoints.length - 1) / 2);
      const a = waypoints[midIndex];
      const b = waypoints[midIndex + 1];
      return {
        x: Math.round((a.x + b.x) / 2),
        y: Math.round((a.y + b.y) / 2)
      };
    };

    connections.forEach((conn: AnyModeler) => {
      if (!conn || !conn.businessObject) return;
      if (conn.label) {
        try {
          modeling.removeShape(conn.label);
        } catch {
          // ignore if label is already gone
        }
      }

      let name = conn.businessObject && conn.businessObject.name;
      if (!name) {
        const conditionExpr = conn.businessObject && conn.businessObject.conditionExpression;
        const body = conditionExpr && conditionExpr.body ? String(conditionExpr.body) : '';
        const matches = body.match(/\\$RESULT_CODE=='(\\d+)'/g);
        if (matches && matches.length > 0) {
          const values = matches.map(m => m.match(/'(\\d+)'/)?.[1]).filter(Boolean);
          name = values.join(',');
        } else if (body) {
          name = body;
        }
        if (name) {
          conn.businessObject.name = name;
        }
      }
      if (!name) return;

      const position = getLabelPosition(conn.waypoints);
      if (position.x === 0 && position.y === 0) return;

      try {
        const labelPos = { x: position.x + 10, y: position.y - 10 };
        modeling.updateProperties(conn, { name });

        if (!conn.label) {
          modeling.createLabel(conn, labelPos);
        }

        if (!conn.label) {
          const label = elementFactory.createLabel({
            type: 'label',
            businessObject: conn.businessObject,
            labelTarget: conn
          });
          canvas.addShape(label, labelPos, conn.parent || canvas.getRootElement());
        }

        if (conn.di && conn.di.label) {
          if (!conn.di.label.bounds) {
            conn.di.label.bounds = bpmnFactory.create('dc:Bounds');
          }
          conn.di.label.bounds.x = labelPos.x;
          conn.di.label.bounds.y = labelPos.y;
          conn.di.label.bounds.width = 100;
          conn.di.label.bounds.height = 20;
        }
      } catch {
        // Skip if DI is missing or element not ready
      }
    });
  }

  function fixStartEventLabels() {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');

    const startEvents = elementRegistry.getAll().filter((el: AnyModeler) =>
      el && el.businessObject && el.businessObject.$type === 'bpmn:StartEvent'
    );

    startEvents.forEach((ev: AnyModeler) => {
      const name = ev.businessObject && ev.businessObject.name;
      if (!name) return;

      if (ev.label) {
        try {
          modeling.removeShape(ev.label);
        } catch {
          // ignore
        }
      }

      const position = {
        x: Math.round(ev.x + ev.width / 2),
        y: Math.round(ev.y + ev.height + 20)
      };

      try {
        modeling.updateProperties(ev, { name });
        modeling.createLabel(ev, position);
        modeling.updateLabel(ev, name, position);
      } catch {
        // ignore if not ready
      }
    });
  }

  function scheduleFixSequenceFlowLabels() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          fixSequenceFlowLabels();
        }, 120);
      });
    });
  }

  function scheduleFixStartEventLabels() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          fixStartEventLabels();
        }, 120);
      });
    });
  }

  if (enableAutoLabelFix) {
    eventBus.on('import.render.complete', () => {
      scheduleFixSequenceFlowLabels();
      scheduleFixStartEventLabels();
    });
  }

  function ensureSequentialUnderscoreIds() {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');

    const elements = elementRegistry.getAll().filter((el: AnyModeler) => {
      if (!el || !el.businessObject) return false;
      if (el.labelTarget) return false;
      const type = el.businessObject.$type || '';
      if (type === 'bpmn:Process' || type === 'bpmn:Definitions') return false;
      return true;
    });

    let maxId = 0;
    const usedIds = new Set<string>();

    elements.forEach((el: AnyModeler) => {
      const id = el.businessObject.id || '';
      const match = /^_(\\d+)$/.exec(id);
      if (match) {
        const num = Number(match[1]);
        if (Number.isFinite(num)) {
          maxId = Math.max(maxId, num);
          usedIds.add(id);
        }
      }
    });

    let nextId = maxId + 1;

    elements.forEach((el: AnyModeler) => {
      const id = el.businessObject.id || '';
      if (/^_\\d+$/.test(id)) {
        return;
      }

      let newId = `_${nextId}`;
      while (usedIds.has(newId)) {
        nextId += 1;
        newId = `_${nextId}`;
      }

      usedIds.add(newId);
      nextId += 1;

      modeling.updateProperties(el, { id: newId });
    });
  }

  function getNextFlowId() {
    const elementRegistry = modeler.get('elementRegistry');
    let maxId = 0;
    elementRegistry.getAll().forEach((el: AnyModeler) => {
      const id = el && el.businessObject ? el.businessObject.id : '';
      const match = /^flow_(\\d+)$/.exec(id || '');
      if (match) {
        const num = Number(match[1]);
        if (Number.isFinite(num)) {
          maxId = Math.max(maxId, num);
        }
      }
    });
    return `flow_${maxId + 1}`;
  }

  function getNextUnderscoreId() {
    const elementRegistry = modeler.get('elementRegistry');
    let maxId = 0;
    const used = new Set<string>();

    elementRegistry.getAll().forEach((el: AnyModeler) => {
      const id = el && el.businessObject ? el.businessObject.id : '';
      if (id) used.add(id);
      const match = /^_(\\d+)$/.exec(id || '');
      if (match) {
        const num = Number(match[1]);
        if (Number.isFinite(num)) {
          maxId = Math.max(maxId, num);
        }
      }
    });

    let next = maxId + 1;
    let candidate = `_${next}`;
    while (used.has(candidate) || elementRegistry.get(candidate)) {
      next += 1;
      candidate = `_${next}`;
    }

    return candidate;
  }

  eventBus.on('commandStack.connection.create.postExecute', (e: AnyModeler) => {
    const element = e && e.context ? e.context.connection : null;
    if (!element || !element.businessObject) return;
    if (element.businessObject.$type !== 'bpmn:SequenceFlow') return;
    if (/^flow_\\d+$/.test(element.businessObject.id || '')) return;

    setTimeout(() => {
      commandStack.execute('element.updateProperties', {
        element,
        properties: { id: getNextFlowId() }
      });
    }, 0);
  });

  eventBus.on('commandStack.shape.create.postExecute', (e: AnyModeler) => {
    const shape = e && e.context ? e.context.shape : null;
    if (!shape || !shape.businessObject) return;
    if (shape.businessObject.$type !== 'bpmn:StartEvent') return;

    const needsId = !/^_\\d+$/.test(shape.businessObject.id || '');
    const needsName = !shape.businessObject.name;

    if (!needsId && !needsName) return;

    setTimeout(() => {
      commandStack.execute('element.updateProperties', {
        element: shape,
        properties: {
          ...(needsId ? { id: getNextUnderscoreId() } : {}),
          ...(needsName ? { name: 'Start Event' } : {})
        }
      });
    }, 0);
  });

  let xmlChangeTimer: ReturnType<typeof setTimeout> | null = null;

  if (onXmlChanged) {
    eventBus.on('commandStack.changed', () => {
      if (xmlChangeTimer) clearTimeout(xmlChangeTimer);
      xmlChangeTimer = setTimeout(async () => {
        try {
          const { xml } = await modeler.saveXML({ format: true });
          const finalXml = denormalizeXmlForExport(xml);
          onXmlChanged(finalXml);
        } catch (err) {
          onError?.(err);
        }
      }, 200);
    });
  }

  async function loadXml(xml?: string) {
    const incoming = xml && xml.trim() ? xml : emptyDiagramXML;
    await modeler.importXML(normalizeXmlForImport(incoming));
    if (enableAutoLabelFix) {
      scheduleFixSequenceFlowLabels();
      scheduleFixStartEventLabels();
    }
  }

  async function getXml() {
    try {
      ensureSequentialUnderscoreIds();
      const { xml } = await modeler.saveXML({ format: true });
      return denormalizeXmlForExport(xml);
    } catch (err) {
      onError?.(err);
      throw err;
    }
  }

  if (initialXml !== undefined) {
    loadXml(initialXml).catch(err => onError?.(err));
  }

  return {
    modeler,
    propertiesPanel,
    setModules(nextModules: ModuleItem[]) {
      modules = Array.isArray(nextModules) ? nextModules : [];
    },
    getModules() {
      return modules;
    },
    loadXml,
    getXml,
    resetToEmpty() {
      return loadXml(emptyDiagramXML);
    },
    destroy() {
      modeler.destroy();
    }
  };
}
