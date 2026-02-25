import Modeler from 'bpmn-js/lib/Modeler';

import PropertiesPanel from './properties-panel';

import customModdleExtension from './moddle/custom.json';
import teloftModdleExtension from './moddle/telsoft.json';
import activitiModdleExtension from './moddle/activiti.json';
import formModdleExtension from './moddle/form.json';

import diagramXML from './diagram.bpmn';

const $modelerContainer = document.querySelector('#modeler-container');
const $propertiesContainer = document.querySelector('#properties-container');
const $importBtn = document.querySelector('#import-btn');
const $exportBtn = document.querySelector('#export-btn');
const $fileInput = document.querySelector('#file-input');

const modeler = new Modeler({
  container: $modelerContainer,
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

modeler.importXML(diagramXML);

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
    modeler.importXML(xml).catch(err => {
      console.error('Error importing XML:', err);
      alert('Error importing XML file: ' + err.message);
    });
  };
  reader.readAsText(file);
  
  // Reset file input
  $fileInput.value = '';
});

// Export XML Handler
$exportBtn.addEventListener('click', async () => {
  try {
    const { xml } = await modeler.saveXML({format: true});
    
    // Create blob and download
    const element = document.createElement('a');
    element.setAttribute('href', 'data:application/xml;charset=utf-8,' + encodeURIComponent(xml));
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
