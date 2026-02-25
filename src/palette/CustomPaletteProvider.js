export default function CustomPaletteProvider(palette, create, elementFactory, elementRegistry) {
  this._palette = palette;
  this._create = create;
  this._elementFactory = elementFactory;
  this._elementRegistry = elementRegistry;

  // register with low priority so we run last and can filter entries
  palette.registerProvider(0, this);
}

CustomPaletteProvider.$inject = ['palette', 'create', 'elementFactory', 'elementRegistry'];

CustomPaletteProvider.prototype.getPaletteEntries = function() {
  const self = this;
  return function(entries) {
    const allowed = new Set([
      'hand-tool',
      'lasso-tool',
      'space-tool',
      'global-connect-tool',
      'tool-separator',
      'create.start-event'
    ]);

    const getNextUnderscoreId = () => {
      let maxId = 0;
      self._elementRegistry.getAll().forEach(el => {
        const id = el && el.businessObject ? el.businessObject.id : '';
        const match = /^_(\d+)$/.exec(id || '');
        if (match) {
          const num = Number(match[1]);
          if (Number.isFinite(num)) {
            maxId = Math.max(maxId, num);
          }
        }
      });
      return `_${maxId + 1}`;
    };

    const filtered = {};
    Object.keys(entries).forEach(id => {
      if (allowed.has(id)) {
        filtered[id] = entries[id];
      }
    });

    if (filtered['create.start-event']) {
      const original = filtered['create.start-event'];
      filtered['create.start-event'] = {
        ...original,
        action: {
          dragstart: (event) => {
            const shape = self._elementFactory.createShape({
              type: 'bpmn:StartEvent',
              id: getNextUnderscoreId(),
              name: 'Start Event'
            });
            self._create.start(event, shape);
          },
          click: (event) => {
            const shape = self._elementFactory.createShape({
              type: 'bpmn:StartEvent',
              id: getNextUnderscoreId(),
              name: 'Start Event'
            });
            self._create.start(event, shape);
          }
        }
      };
    }

    return filtered;
  };
};
