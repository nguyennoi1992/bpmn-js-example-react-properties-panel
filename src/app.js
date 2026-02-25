import Modeler from 'bpmn-js/lib/Modeler';

import PropertiesPanel from './properties-panel';

import customModdleExtension from './moddle/custom.json';
import teloftModdleExtension from './moddle/telsoft.json';
import activitiModdleExtension from './moddle/activiti.json';
import formModdleExtension from './moddle/form.json';
import customPaletteModule from './palette';

import diagramXML from './diagram.bpmn';
import demoData from '../resources/demo.json';

const $modelerContainer = document.querySelector('#modeler-container');
const $propertiesContainer = document.querySelector('#properties-container');
const $importBtn = document.querySelector('#import-btn');
const $exportBtn = document.querySelector('#export-btn');
const $fileInput = document.querySelector('#file-input');
const $newBtn = document.querySelector('#new-btn');
const $autoLayoutBtn = document.querySelector('#auto-layout-btn');
const $undoBtn = document.querySelector('#undo-btn');
const $moduleCombo = document.querySelector('#module-combo');
const $moduleDisplay = document.querySelector('#module-display');
const $moduleDisplayText = document.querySelector('#module-display-text');
const $modulePanel = document.querySelector('#module-panel');
const $moduleSearch = document.querySelector('#module-search');
const $moduleList = document.querySelector('#module-list');

const $functionCombo = document.querySelector('#function-combo');
const $functionDisplay = document.querySelector('#function-display');
const $functionDisplayText = document.querySelector('#function-display-text');
const $functionPanel = document.querySelector('#function-panel');
const $functionSearchFilter = document.querySelector('#function-search-filter');
const $functionList = document.querySelector('#function-list');
const $searchInput = document.querySelector('#function-search');
const $searchBtn = document.querySelector('#search-btn');
const $searchResults = document.querySelector('#search-results');
const $tasksList = document.querySelector('#tasks-list');

const emptyDiagramXML = `<?xml version="1.0" encoding="UTF-8"?>
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

function normalizeXmlForImport(xml) {
  if (!xml) return xml;

  // Convert <string> inside <activiti:field> to <activiti:string> so moddle can parse it
  return xml
    .replace(/(<activiti:field\b[^>]*>\s*)<string>/g, '$1<activiti:string>')
    .replace(/<\/string>(\s*<\/activiti:field>)/g, '</activiti:string>$1');
}

function denormalizeXmlForExport(xml) {
  if (!xml) return xml;

  // Convert back to the original unprefixed <string> tags
  return xml
    .replace(/(<activiti:field\b[^>]*>\s*)<activiti:string>/g, '$1<string>')
    .replace(/<\/activiti:string>(\s*<\/activiti:field>)/g, '</string>$1');
}

const modeler = new Modeler({
  container: $modelerContainer,
  additionalModules: [
    customPaletteModule
  ],
  moddleExtensions: {
    custom: customModdleExtension,
    telsoft: teloftModdleExtension,
    activiti: activitiModdleExtension,
    form: formModdleExtension
  },
  keyboard: {
    bindTo: document.body
  }
});

const propertiesPanel = new PropertiesPanel({
  container: $propertiesContainer,
  modeler
});

function setPropertiesVisible(visible) {
  if (!$propertiesContainer) return;
  if (visible) {
    $propertiesContainer.classList.remove('properties-hidden');
  } else {
    $propertiesContainer.classList.add('properties-hidden');
  }
}

setPropertiesVisible(false);

modeler.on('selection.changed', (e) => {
  const selection = e.newSelection || [];
  setPropertiesVisible(selection.length === 1);
});

const eventBus = modeler.get('eventBus');
const commandStack = modeler.get('commandStack');

const modules = Array.isArray(demoData) ? demoData : [];
const functionsFlat = modules.flatMap(module => {
  const children = Array.isArray(module.children) ? module.children : [];
  return children.map(child => ({
    id: child.ID,
    className: child.NAME || '',
    displayName: (child.NAME || '').split('.').pop() || child.NAME || '',
    moduleId: module.ID,
    moduleName: module.NAME || ''
  }));
});

const selectedTasks = new Map();
let selectedModuleId = '';
let selectedFunctionId = '';
let autoLayoutSnapshot = null;

function renderModuleOptions(filter = '') {
  $moduleList.innerHTML = '';
  const sortedModules = modules.slice().sort((a, b) => {
    const na = Number(a.ID);
    const nb = Number(b.ID);
    const aIsNum = Number.isFinite(na);
    const bIsNum = Number.isFinite(nb);
    if (aIsNum && bIsNum) return na - nb;
    if (aIsNum && !bIsNum) return -1;
    if (!aIsNum && bIsNum) return 1;
    return String(a.ID).localeCompare(String(b.ID));
  });

  const keyword = filter.trim().toLowerCase();
  sortedModules.forEach(module => {
    if (keyword) {
      const hay = `${module.ID} ${module.NAME || ''}`.toLowerCase();
      if (!hay.includes(keyword)) return;
    }
    const item = document.createElement('div');
    item.className = 'combo-item';
    item.dataset.value = String(module.ID);
    item.textContent = `[${module.ID}, ${module.NAME}]`;
    item.addEventListener('click', () => {
      selectedModuleId = String(module.ID);
      selectedFunctionId = '';
      $moduleDisplayText.textContent = item.textContent;
      $functionDisplayText.textContent = '-- Select function --';
      closeCombo($modulePanel);
      renderFunctionOptions(selectedModuleId, $functionSearchFilter.value || '');
    });
    $moduleList.appendChild(item);
  });
}

function fixSequenceFlowLabels() {
  const elementRegistry = modeler.get('elementRegistry');
  const modeling = modeler.get('modeling');
  const bpmnFactory = modeler.get('bpmnFactory');
  const elementFactory = modeler.get('elementFactory');
  const canvas = modeler.get('canvas');

  const connections = elementRegistry.getAll().filter(el =>
    el && el.waypoints && el.businessObject && el.businessObject.$type === 'bpmn:SequenceFlow'
  );

  const getLabelPosition = (waypoints) => {
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

  connections.forEach(conn => {
    if (!conn || !conn.businessObject) return;
    if (conn.label) {
      try {
        modeling.removeShape(conn.label);
      } catch (e) {
        // ignore if label is already gone
      }
    }

    let name = conn.businessObject && conn.businessObject.name;
    if (!name) {
      const conditionExpr = conn.businessObject && conn.businessObject.conditionExpression;
      const body = conditionExpr && conditionExpr.body ? String(conditionExpr.body) : '';
      const matches = body.match(/\$RESULT_CODE=='(\d+)'/g);
      if (matches && matches.length > 0) {
        const values = matches.map(m => m.match(/'(\d+)'/)[1]);
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
      // Slight offset so label is not centered on the line
      const labelPos = { x: position.x + 10, y: position.y - 10 };

      // Ensure name is applied
      modeling.updateProperties(conn, { name });

      // Try to create label via modeling (will attach DI correctly)
      if (!conn.label) {
        modeling.createLabel(conn, labelPos);
      }

      // If still missing, create shape explicitly
      if (!conn.label) {
        const label = elementFactory.createLabel({
          type: 'label',
          businessObject: conn.businessObject,
          labelTarget: conn
        });
        canvas.addShape(label, labelPos, conn.parent || canvas.getRootElement());
      }

      // If DI is available on element, update label bounds via conn.di
      if (conn.di && conn.di.label) {
        if (!conn.di.label.bounds) {
          conn.di.label.bounds = bpmnFactory.create('dc:Bounds');
        }
        conn.di.label.bounds.x = labelPos.x;
        conn.di.label.bounds.y = labelPos.y;
        conn.di.label.bounds.width = 100;
        conn.di.label.bounds.height = 20;
      }
      processed += 1;

    } catch (e) {
      // Skip if DI is missing or element not ready
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

function fixStartEventLabels() {
  const elementRegistry = modeler.get('elementRegistry');
  const modeling = modeler.get('modeling');

  const startEvents = elementRegistry.getAll().filter(el =>
    el && el.businessObject && el.businessObject.$type === 'bpmn:StartEvent'
  );

  startEvents.forEach(ev => {
    const name = ev.businessObject && ev.businessObject.name;
    if (!name) return;

    if (ev.label) {
      try {
        modeling.removeShape(ev.label);
      } catch (e) {
        // ignore
      }
    }

    const position = {
      x: Math.round(ev.x + ev.width / 2),
      y: Math.round(ev.y + ev.height + 20)
    };

    try {
      // ensure name stays intact
      modeling.updateProperties(ev, { name });
      modeling.createLabel(ev, position);
      modeling.updateLabel(ev, name, position);
    } catch (e) {
      // ignore if not ready
    }
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

eventBus.on('import.render.complete', () => {
  scheduleFixSequenceFlowLabels();
  scheduleFixStartEventLabels();
});

function renderFunctionOptions(moduleId, filter = '') {
  $functionList.innerHTML = '';

  const module = modules.find(m => String(m.ID) === String(moduleId));
  if (!module || !Array.isArray(module.children)) {
    return;
  }

  const sortedChildren = module.children.slice().sort((a, b) => {
    const na = Number(a.ID);
    const nb = Number(b.ID);
    const aIsNum = Number.isFinite(na);
    const bIsNum = Number.isFinite(nb);
    if (aIsNum && bIsNum) return na - nb;
    if (aIsNum && !bIsNum) return -1;
    if (!aIsNum && bIsNum) return 1;
    return String(a.ID).localeCompare(String(b.ID));
  });

  const keyword = filter.trim().toLowerCase();
  sortedChildren.forEach(child => {
    if (keyword) {
      const hay = `${child.ID} ${child.NAME || ''}`.toLowerCase();
      if (!hay.includes(keyword)) return;
    }
    const name = child.NAME || '';
    const displayName = name.split('.').pop() || name;
    const item = document.createElement('div');
    item.className = 'combo-item';
    item.dataset.value = String(child.ID);
    item.textContent = `[${child.ID}, ${displayName}]`;
    item.addEventListener('click', () => {
      selectedFunctionId = String(child.ID);
      $functionDisplayText.textContent = item.textContent;
      closeCombo($functionPanel);

      const task = functionsFlat.find(t => String(t.id) === String(child.ID));
      if (task) {
        addTaskToPanel(task);
      }
    });
    $functionList.appendChild(item);
  });
}

function addTaskToPanel(task) {
  if (!task || !task.id) return;

  if (selectedTasks.has(task.id)) {
    return;
  }

  selectedTasks.set(task.id, task);

  const item = document.createElement('div');
  item.className = 'task-item';
  item.dataset.taskId = String(task.id);
  item.dataset.className = task.className;
  item.dataset.displayName = task.displayName;

  const nameEl = document.createElement('div');
  nameEl.className = 'task-name';
  nameEl.textContent = task.displayName || task.className;

  const classEl = document.createElement('div');
  classEl.className = 'task-class';
  classEl.textContent = task.className;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'task-remove';
  removeBtn.type = 'button';
  removeBtn.textContent = 'x';
  removeBtn.title = 'Remove';
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedTasks.delete(task.id);
    item.remove();
  });

  item.appendChild(nameEl);
  item.appendChild(classEl);
  item.appendChild(removeBtn);

  item.addEventListener('mousedown', (event) => {
    if (event.target === removeBtn) return;
    event.preventDefault();

    const elementFactory = modeler.get('elementFactory');
    const bpmnFactory = modeler.get('bpmnFactory');
    const create = modeler.get('create');

    const businessObject = bpmnFactory.create('bpmn:ServiceTask', {
      id: getNextUnderscoreId(),
      name: task.displayName,
      class: task.className,
      'telsoft:gateway': '1'
    });

    const shape = elementFactory.createShape({
      type: 'bpmn:ServiceTask',
      businessObject
    });

    create.start(event, shape);
  });

  $tasksList.insertBefore(item, $tasksList.firstChild);
}

function renderSearchResults(results) {
  $searchResults.innerHTML = '';

  if (!results.length) {
    $searchResults.style.display = 'none';
    return;
  }

  results.forEach(task => {
    const item = document.createElement('div');
    item.className = 'search-item';
    item.textContent = `[${task.id}, ${task.displayName}] - ${task.moduleName}`;
    item.addEventListener('click', () => {
      addTaskToPanel(task);
      $searchResults.style.display = 'none';
    });
    $searchResults.appendChild(item);
  });

  $searchResults.style.display = 'block';
}

function handleSearch() {
  const query = ($searchInput.value || '').trim().toLowerCase();
  if (!query) {
    $searchResults.style.display = 'none';
    return;
  }

  const results = functionsFlat.filter(task =>
    task.displayName.toLowerCase().includes(query) ||
    task.className.toLowerCase().includes(query)
  );

  renderSearchResults(results.slice(0, 100));
}

function captureAutoLayoutSnapshot() {
  const elementRegistry = modeler.get('elementRegistry');
  const snapshot = {
    shapes: new Map(),
    connections: new Map()
  };

  elementRegistry.getAll().forEach(el => {
    if (!el || !el.businessObject) return;
    if (el.waypoints) {
      snapshot.connections.set(el.id, el.waypoints.map(wp => ({ x: wp.x, y: wp.y })));
    } else if (!el.labelTarget) {
      if (typeof el.x !== 'number' || typeof el.y !== 'number') {
        return;
      }
      snapshot.shapes.set(el.id, { x: el.x, y: el.y });
    }
  });

  return snapshot;
}

function restoreAutoLayoutSnapshot() {
  if (!autoLayoutSnapshot) return;

  const elementRegistry = modeler.get('elementRegistry');
  const modeling = modeler.get('modeling');
  const canvas = modeler.get('canvas');
  const root = canvas.getRootElement();

  autoLayoutSnapshot.shapes.forEach((pos, id) => {
    const shape = elementRegistry.get(id);
    if (!shape || typeof shape.x !== 'number' || typeof shape.y !== 'number') return;
    const dx = pos.x - shape.x;
    const dy = pos.y - shape.y;
    if (dx !== 0 || dy !== 0) {
      const parent = shape.parent || root;
      if (!parent || !parent.children) {
        return;
      }
      modeling.moveShape(shape, { x: dx, y: dy }, parent);
    }
  });

  autoLayoutSnapshot.connections.forEach((waypoints, id) => {
    const conn = elementRegistry.get(id);
    if (!conn || !conn.waypoints) return;
    modeling.updateWaypoints(conn, waypoints);
  });
}

function setUndoEnabled(enabled) {
  if ($undoBtn) {
    $undoBtn.disabled = !enabled;
  }
}

function openCombo(panelEl, inputEl) {
  panelEl.classList.add('open');
  if (inputEl) {
    inputEl.focus();
    inputEl.select();
  }
}

function closeCombo(panelEl) {
  panelEl.classList.remove('open');
}

function ensureSequentialUnderscoreIds() {
  const elementRegistry = modeler.get('elementRegistry');
  const modeling = modeler.get('modeling');

  const elements = elementRegistry.getAll().filter(el => {
    if (!el || !el.businessObject) return false;
    if (el.labelTarget) return false;
    const type = el.businessObject.$type || '';
    if (type === 'bpmn:Process' || type === 'bpmn:Definitions') return false;
    return true;
  });

  let maxId = 0;
  const usedIds = new Set();

  elements.forEach(el => {
    const id = el.businessObject.id || '';
    const match = /^_(\d+)$/.exec(id);
    if (match) {
      const num = Number(match[1]);
      if (Number.isFinite(num)) {
        maxId = Math.max(maxId, num);
        usedIds.add(id);
      }
    }
  });

  let nextId = maxId + 1;

  elements.forEach(el => {
    const id = el.businessObject.id || '';
    if (/^_\d+$/.test(id)) {
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
  elementRegistry.getAll().forEach(el => {
    const id = el && el.businessObject ? el.businessObject.id : '';
    const match = /^flow_(\d+)$/.exec(id || '');
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
  const used = new Set();

  elementRegistry.getAll().forEach(el => {
    const id = el && el.businessObject ? el.businessObject.id : '';
    if (id) used.add(id);
    const match = /^_(\d+)$/.exec(id || '');
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

eventBus.on('commandStack.connection.create.postExecute', (e) => {
  const element = e && e.context ? e.context.connection : null;
  if (!element || !element.businessObject) return;
  if (element.businessObject.$type !== 'bpmn:SequenceFlow') return;
  if (/^flow_\d+$/.test(element.businessObject.id || '')) return;

  // Defer to avoid illegal invocation within the same command stack cycle
  setTimeout(() => {
    commandStack.execute('element.updateProperties', {
      element,
      properties: { id: getNextFlowId() }
    });
  }, 0);
});

eventBus.on('commandStack.shape.create.postExecute', (e) => {
  const shape = e && e.context ? e.context.shape : null;
  if (!shape || !shape.businessObject) return;
  if (shape.businessObject.$type !== 'bpmn:StartEvent') return;

  const needsId = !/^_\d+$/.test(shape.businessObject.id || '');
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

renderModuleOptions();
renderFunctionOptions('');

$moduleDisplay.addEventListener('click', () => {
  const isOpen = $modulePanel.classList.contains('open');
  closeCombo($functionPanel);
  if (isOpen) {
    closeCombo($modulePanel);
  } else {
    openCombo($modulePanel, $moduleSearch);
  }
});

$functionDisplay.addEventListener('click', () => {
  const isOpen = $functionPanel.classList.contains('open');
  closeCombo($modulePanel);
  if (isOpen) {
    closeCombo($functionPanel);
  } else {
    openCombo($functionPanel, $functionSearchFilter);
  }
});

$moduleSearch.addEventListener('input', (e) => {
  renderModuleOptions(e.target.value || '');
});

$functionSearchFilter.addEventListener('input', (e) => {
  renderFunctionOptions(selectedModuleId, e.target.value || '');
});

document.addEventListener('click', (e) => {
  if (!$moduleCombo.contains(e.target)) {
    closeCombo($modulePanel);
  }
  if (!$functionCombo.contains(e.target)) {
    closeCombo($functionPanel);
  }
});

$searchBtn.addEventListener('click', handleSearch);
$searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    handleSearch();
  }
});

modeler.importXML(normalizeXmlForImport(diagramXML)).then(() => {
  scheduleFixSequenceFlowLabels();
}).catch(err => {
  console.error('Error importing XML:', err);
  alert('Error importing XML file: ' + err.message);
});

// Import XML Handler
$importBtn.addEventListener('click', () => {
  $fileInput.click();
});

$fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const xml = e.target.result;
    modeler.importXML(normalizeXmlForImport(xml)).then(() => {
      scheduleFixSequenceFlowLabels();
    }).catch(err => {
      console.error('Error importing XML:', err);
      alert('Error importing XML file: ' + err.message);
    });
  };
  reader.readAsText(file);
  
  // Reset file input
  $fileInput.value = '';
  autoLayoutSnapshot = null;
  setUndoEnabled(false);
});

// Export XML Handler
$exportBtn.addEventListener('click', async () => {
  try {
    ensureSequentialUnderscoreIds();
    // const { xml } = await modeler.saveXML({format: true});
    const { xml } = await modeler.saveXML({ format: true }, function(err, xml) {
      if (err) {
        return console.error("could not save BPMN 2.0 diagram", err);
      }
      console.log(xml);
    });

    const finalXml = denormalizeXmlForExport(xml);

    // Create blob and download
    const element = document.createElement('a');
    element.setAttribute('href', 'data:application/xml;charset=utf-8,' + encodeURIComponent(finalXml));
    element.setAttribute('download', 'diagram.bpmn');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  } catch (err) {
    console.error('Error exporting XML:', err);
    alert('Error exporting diagram: ' + err.message);
  }
});

$newBtn.addEventListener('click', async () => {
  const confirmed = confirm('Tạo BPMN mới? Diagram hiện tại sẽ bị mất.');
  if (!confirmed) return;

  try {
    await modeler.importXML(emptyDiagramXML);

    const canvas = modeler.get('canvas');
    canvas.zoom('fit-viewport');
    autoLayoutSnapshot = null;
    setUndoEnabled(false);

  } catch (err) {
    console.error('Error creating new diagram:', err);
    alert('Không thể tạo BPMN mới');
  }
});

$autoLayoutBtn.addEventListener('click', () => {
  autoLayoutSnapshot = captureAutoLayoutSnapshot();
  setUndoEnabled(true);

  const elementRegistry = modeler.get('elementRegistry');
  const modeling = modeler.get('modeling');

  const shapes = elementRegistry.getAll().filter(el => {
    if (!el || !el.businessObject) return false;
    if (el.labelTarget) return false;
    if (el.waypoints) return false;
    const type = el.businessObject.$type || '';
    if (type === 'bpmn:Process' || type === 'bpmn:Definitions') return false;
    return true;
  });

  if (!shapes.length) return;

  const isFlowNode = (shape) => {
    const type = shape.businessObject && shape.businessObject.$type;
    return type && type.startsWith('bpmn:') && !shape.waypoints;
  };

  const byId = new Map(shapes.map(s => [s.id, s]));

  const getOutgoingTargets = (shape) => {
    const outgoing = (shape.outgoing || []).filter(conn => conn.businessObject && conn.businessObject.$type === 'bpmn:SequenceFlow');
    return outgoing.map(conn => conn.target).filter(t => t && byId.has(t.id));
  };

  const startNodes = shapes.filter(s => s.businessObject && s.businessObject.$type === 'bpmn:StartEvent');
  const endNodes = shapes.filter(s => s.businessObject && (s.businessObject.$type === 'bpmn:EndEvent' || (s.outgoing || []).length === 0));

  const roots = startNodes.length ? startNodes : shapes.filter(isFlowNode).slice(0, 1);
  if (!roots.length) return;

  const endSet = new Set(endNodes.map(n => n.id));

  // Longest path from any start to any end (main spine)
  const memo = new Map();
  const visiting = new Set();

  const longestFrom = (node, avoidSet = new Set()) => {
    if (memo.has(node.id)) return memo.get(node.id);
    if (visiting.has(node.id)) return { length: 0, path: [node.id] };
    visiting.add(node.id);

    const targets = getOutgoingTargets(node).filter(t => !avoidSet.has(t.id));
    let best = { length: endSet.has(node.id) ? 1 : 0, path: [node.id] };

    targets.forEach(t => {
      const child = longestFrom(t, avoidSet);
      const length = 1 + child.length;
      if (length > best.length) {
        best = { length, path: [node.id, ...child.path] };
      }
    });

    visiting.delete(node.id);
    memo.set(node.id, best);
    return best;
  };

  let mainPath = [];
  roots.forEach(r => {
    const res = longestFrom(r);
    if (res.path.length > mainPath.length) {
      mainPath = res.path;
    }
  });
  if (!mainPath.length) mainPath = roots.map(r => r.id);

  const mainSet = new Set(mainPath);

  // Level (x) based on longest distance from any start
  const levelMap = new Map();
  const queue = [];
  roots.forEach(node => {
    levelMap.set(node.id, 0);
    queue.push(node);
  });
  while (queue.length) {
    const current = queue.shift();
    const currentLevel = levelMap.get(current.id) || 0;
    const targets = getOutgoingTargets(current);
    targets.forEach(t => {
      const nextLevel = currentLevel + 1;
      const existing = levelMap.get(t.id);
      if (existing === undefined || nextLevel > existing) {
        levelMap.set(t.id, nextLevel);
        queue.push(t);
      }
    });
  }

  const positions = new Map();
  const assigned = new Set();

  const startX = 120;
  const startY = 240;
  const colWidth = 200;
  const rowHeight = 110;

  // Place main path centered
  mainPath.forEach(id => {
    const shape = byId.get(id);
    if (!shape) return;
    const lvl = levelMap.get(id) || 0;
    positions.set(id, { x: startX + lvl * colWidth, y: startY });
    assigned.add(id);
  });

  // Build straight branch paths off the main path
  const branchRoots = [];
  mainPath.forEach(id => {
    const shape = byId.get(id);
    if (!shape) return;
    const outgoing = getOutgoingTargets(shape).filter(t => !mainSet.has(t.id));
    outgoing.forEach(t => branchRoots.push(t));
  });

  const branchY = new Map();
  let upOffset = rowHeight;
  let downOffset = rowHeight;
  let toggle = true;

  const assignBranchPath = (root) => {
    const side = toggle ? 'up' : 'down';
    toggle = !toggle;
    const y = side === 'up' ? startY - upOffset : startY + downOffset;

    if (side === 'up') {
      upOffset += rowHeight;
    } else {
      downOffset += rowHeight;
    }

    branchY.set(root.id, y);

    const path = longestFrom(root, mainSet).path;
    path.forEach(nodeId => {
      if (mainSet.has(nodeId)) return;
      const shape = byId.get(nodeId);
      if (!shape) return;
      const lvl = levelMap.get(nodeId) || 0;
      positions.set(nodeId, { x: startX + lvl * colWidth, y });
      assigned.add(nodeId);
    });
  };

  branchRoots.forEach(assignBranchPath);

  // Place remaining nodes around their closest assigned parent
  const leftovers = shapes.filter(s => !assigned.has(s.id));
  let extraY = startY + downOffset + rowHeight;
  leftovers.forEach(s => {
    const lvl = levelMap.get(s.id) || 0;
    positions.set(s.id, { x: startX + lvl * colWidth, y: extraY });
    extraY += rowHeight;
  });

  positions.forEach((pos, id) => {
    const shape = byId.get(id);
    if (!shape) return;
    const dx = pos.x - shape.x;
    const dy = pos.y - shape.y;
    if (dx !== 0 || dy !== 0) {
      const canvas = modeler.get('canvas');
      const root = canvas.getRootElement();
      const parent = shape.parent || root;
      if (!parent || !parent.children) {
        return;
      }
      modeling.moveShape(shape, { x: dx, y: dy }, parent);
    }
  });

  // Re-route sequence flows to reduce overlap and shorten paths
  const connections = elementRegistry.getAll().filter(el => el && el.waypoints && el.businessObject && el.businessObject.$type === 'bpmn:SequenceFlow');

  const getMid = (shape) => ({
    x: shape.x + shape.width / 2,
    y: shape.y + shape.height / 2
  });

  const routeConnection = (conn) => {
    const source = conn.source;
    const target = conn.target;
    if (!source || !target) return;

    const sourceMid = getMid(source);
    const targetMid = getMid(target);

    const horizontalGap = targetMid.x - sourceMid.x;
    const verticalGap = targetMid.y - sourceMid.y;

    const start = {
      x: horizontalGap >= 0 ? source.x + source.width : source.x,
      y: sourceMid.y
    };
    const end = {
      x: horizontalGap >= 0 ? target.x : target.x + target.width,
      y: targetMid.y
    };

    const waypoints = [];
    waypoints.push(start);

    if (Math.abs(verticalGap) < 20) {
      // Mostly horizontal: straight line
      waypoints.push(end);
    } else {
      // Dogleg: horizontal then vertical (or reverse if target is behind)
      const midX = (start.x + end.x) / 2;
      waypoints.push({ x: midX, y: start.y });
      waypoints.push({ x: midX, y: end.y });
      waypoints.push(end);
    }

    modeling.updateWaypoints(conn, waypoints);
  };

  connections.forEach(routeConnection);

  const canvas = modeler.get('canvas');
  canvas.zoom('fit-viewport');
});

$undoBtn.addEventListener('click', () => {
  if (!autoLayoutSnapshot) return;
  restoreAutoLayoutSnapshot();
  autoLayoutSnapshot = null;
  setUndoEnabled(false);
});
