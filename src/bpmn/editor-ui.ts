import type { BpmnEditorApi } from './editor';
import type { FlatFunctionItem, ModuleItem } from './types';

interface BpmnEditorUiOptions {
  editor: BpmnEditorApi;
  moduleCombo: HTMLElement;
  moduleDisplay: HTMLElement;
  moduleDisplayText: HTMLElement;
  modulePanel: HTMLElement;
  moduleSearch: HTMLInputElement;
  moduleList: HTMLElement;
  functionCombo: HTMLElement;
  functionDisplay: HTMLElement;
  functionDisplayText: HTMLElement;
  functionPanel: HTMLElement;
  functionSearchFilter: HTMLInputElement;
  functionList: HTMLElement;
  searchInput: HTMLInputElement;
  searchBtn: HTMLElement;
  searchResults: HTMLElement;
  tasksList: HTMLElement;
}

export interface BpmnEditorUiApi {
  setModules: (modules: ModuleItem[]) => void;
  destroy: () => void;
}

export function createBpmnEditorUi(options: BpmnEditorUiOptions): BpmnEditorUiApi {
  const {
    editor,
    moduleCombo,
    moduleDisplay,
    moduleDisplayText,
    modulePanel,
    moduleSearch,
    moduleList,
    functionCombo,
    functionDisplay,
    functionDisplayText,
    functionPanel,
    functionSearchFilter,
    functionList,
    searchInput,
    searchBtn,
    searchResults,
    tasksList
  } = options;

  let modules: ModuleItem[] = editor.getModules() || [];
  let functionsFlat: FlatFunctionItem[] = [];
  const selectedTasks = new Map();
  let selectedModuleId = '';
  let selectedFunctionId = '';

  const onModuleClick = () => {
    const isOpen = modulePanel.classList.contains('open');
    closeCombo(functionPanel);
    if (isOpen) {
      closeCombo(modulePanel);
    } else {
      openCombo(modulePanel, moduleSearch);
    }
  };

  const onFunctionClick = () => {
    const isOpen = functionPanel.classList.contains('open');
    closeCombo(modulePanel);
    if (isOpen) {
      closeCombo(functionPanel);
    } else {
      openCombo(functionPanel, functionSearchFilter);
    }
  };

  const onModuleSearchInput = (e: Event) => {
    renderModuleOptions((e.target as HTMLInputElement).value || '');
  };

  const onFunctionSearchInput = (e: Event) => {
    renderFunctionOptions(selectedModuleId, (e.target as HTMLInputElement).value || '');
  };

  const onDocumentClick = (e: Event) => {
    const target = e.target as Node;
    if (!moduleCombo.contains(target)) {
      closeCombo(modulePanel);
    }
    if (!functionCombo.contains(target)) {
      closeCombo(functionPanel);
    }
  };

  const onSearchClick = () => handleSearch();
  const onSearchKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  function setModules(nextModules: ModuleItem[]) {
    modules = Array.isArray(nextModules) ? nextModules : [];
    functionsFlat = modules.flatMap(module => {
      const children = Array.isArray(module.children) ? module.children : [];
      return children.map(child => ({
        id: child.ID,
        className: child.NAME || '',
        displayName: (child.NAME || '').split('.').pop() || child.NAME || '',
        moduleId: module.ID,
        moduleName: module.NAME || ''
      }));
    });
    renderModuleOptions(moduleSearch.value || '');
    renderFunctionOptions(selectedModuleId, functionSearchFilter.value || '');
  }

  function renderModuleOptions(filter = '') {
    moduleList.innerHTML = '';
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
        moduleDisplayText.textContent = item.textContent || '';
        functionDisplayText.textContent = '-- Select function --';
        closeCombo(modulePanel);
        renderFunctionOptions(selectedModuleId, functionSearchFilter.value || '');
      });
      moduleList.appendChild(item);
    });
  }

  function renderFunctionOptions(moduleId: string, filter = '') {
    functionList.innerHTML = '';

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
        functionDisplayText.textContent = item.textContent || '';
        closeCombo(functionPanel);

        const task = functionsFlat.find(t => String(t.id) === String(child.ID));
        if (task) {
          addTaskToPanel(task);
        }
      });
      functionList.appendChild(item);
    });
  }

  function addTaskToPanel(task: FlatFunctionItem) {
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

      const modeler = editor.modeler;
      const elementFactory = modeler.get('elementFactory');
      const bpmnFactory = modeler.get('bpmnFactory');
      const create = modeler.get('create');

      const businessObject = bpmnFactory.create('bpmn:ServiceTask', {
        id: getNextUnderscoreId(modeler),
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

    tasksList.insertBefore(item, tasksList.firstChild);
  }

  function renderSearchResults(results: FlatFunctionItem[]) {
    searchResults.innerHTML = '';

    if (!results.length) {
      searchResults.style.display = 'none';
      return;
    }

    results.forEach(task => {
      const item = document.createElement('div');
      item.className = 'search-item';
      item.textContent = `[${task.id}, ${task.displayName}] - ${task.moduleName}`;
      item.addEventListener('click', () => {
        addTaskToPanel(task);
        searchResults.style.display = 'none';
      });
      searchResults.appendChild(item);
    });

    searchResults.style.display = 'block';
  }

  function handleSearch() {
    const query = (searchInput.value || '').trim().toLowerCase();
    if (!query) {
      searchResults.style.display = 'none';
      return;
    }

    const results = functionsFlat.filter(task =>
      task.displayName.toLowerCase().includes(query) ||
      task.className.toLowerCase().includes(query)
    );

    renderSearchResults(results.slice(0, 100));
  }

  function openCombo(panelEl: HTMLElement, inputEl?: HTMLInputElement | null) {
    panelEl.classList.add('open');
    if (inputEl) {
      inputEl.focus();
      inputEl.select();
    }
  }

  function closeCombo(panelEl: HTMLElement) {
    panelEl.classList.remove('open');
  }

  function getNextUnderscoreId(modeler: any) {
    const elementRegistry = modeler.get('elementRegistry');
    let maxId = 0;
    const used = new Set<string>();

    elementRegistry.getAll().forEach((el: any) => {
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

  moduleDisplay.addEventListener('click', onModuleClick);
  functionDisplay.addEventListener('click', onFunctionClick);
  moduleSearch.addEventListener('input', onModuleSearchInput);
  functionSearchFilter.addEventListener('input', onFunctionSearchInput);
  document.addEventListener('click', onDocumentClick);
  searchBtn.addEventListener('click', onSearchClick);
  searchInput.addEventListener('keydown', onSearchKeydown);

  setModules(modules);

  return {
    setModules,
    destroy() {
      moduleDisplay.removeEventListener('click', onModuleClick);
      functionDisplay.removeEventListener('click', onFunctionClick);
      moduleSearch.removeEventListener('input', onModuleSearchInput);
      functionSearchFilter.removeEventListener('input', onFunctionSearchInput);
      document.removeEventListener('click', onDocumentClick);
      searchBtn.removeEventListener('click', onSearchClick);
      searchInput.removeEventListener('keydown', onSearchKeydown);
    }
  };
}
