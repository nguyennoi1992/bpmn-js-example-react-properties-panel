import { is } from 'bpmn-js/lib/util/ModelUtil';

import React, { Component } from 'react';

import './PropertiesView.css';
import ListenersModal from './ListenersModal';


export default class PropertiesView extends Component {

  constructor(props) {
    super(props);

    this.state = {
      selectedElements: [],
      element: null,
      activeTab: 'basic'
    };
  }

  componentDidMount() {

    const {
      modeler
    } = this.props;

    modeler.on('selection.changed', (e) => {

      const {
        element
      } = this.state;

      this.setState({
        selectedElements: e.newSelection,
        element: e.newSelection[0]
      });
    });


    modeler.on('element.changed', (e) => {

      const {
        element
      } = e;

      const {
        element: currentElement
      } = this.state;

      if (!currentElement) {
        return;
      }

      // update panel, if currently selected element changed
      if (element.id === currentElement.id) {
        this.setState({
          element
        });
      }

    });
  }

  render() {

    const {
      modeler
    } = this.props;

    const {
      selectedElements,
      element
    } = this.state;

    return (
      <div>

        {
          selectedElements.length === 1
          && <ElementProperties modeler={modeler} element={element} />
        }

        {
          selectedElements.length === 0
          && <div style={{ padding: '10px', textAlign: 'center', color: '#999' }}>Please select an element.</div>
        }

        {
          selectedElements.length > 1
          && <div style={{ padding: '10px', textAlign: 'center', color: '#999' }}>Please select a single element.</div>
        }
      </div>
    );
  }

}


function ElementProperties(props) {

  let {
    element,
    modeler
  } = props;

  const [showListenersModal, setShowListenersModal] = React.useState(false);
  const [conditionInput, setConditionInput] = React.useState('');

  if (element.labelTarget) {
    element = element.labelTarget;
  }

  function updateName(name) {
    const modeling = modeler.get('modeling');
    modeling.updateLabel(element, name);
  }

  function updateTopic(topic) {
    const modeling = modeler.get('modeling');
    modeling.updateProperties(element, {
      'custom:topic': topic
    });
  }

  function updateProperty(key, value) {
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    const bo = element.businessObject;

    // Check if this is a parameter that should go in extensionElements
    const fieldNames = ['custom:inputKey', 'custom:inputValues', 'custom:outputValue'];
    const fieldNameMap = {
      'custom:inputKey': 'INPUT_KEY',
      'custom:inputValues': 'INPUT_VALUES',
      'custom:outputValue': 'OUTPUT_VALUE'
    };

    if (fieldNames.includes(key)) {
      // Save to extensionElements as activiti:field
      if (!bo.extensionElements) {
        bo.extensionElements = bpmnFactory.create('bpmn:ExtensionElements');
        if (!bo.extensionElements.values) {
          bo.extensionElements.values = [];
        }
      }

      if (!bo.extensionElements.values) {
        bo.extensionElements.values = [];
      }

      const fieldName = fieldNameMap[key];
      let field = bo.extensionElements.values.find(v =>
        v.$type === 'activiti:Field' &&
        v.name === fieldName
      );

      if (value === '' || value === undefined) {
        // Remove field if value is empty
        if (field) {
          const index = bo.extensionElements.values.indexOf(field);
          if (index > -1) {
            bo.extensionElements.values.splice(index, 1);
          }
        }
      } else {
        // Create or update field
        if (!field) {
          field = bpmnFactory.create('activiti:Field', {
            name: fieldName
          });
          bo.extensionElements.values.push(field);
        }

        // Create string value as attribute (stringValue)
        field.stringValue = value;
        // Ensure legacy string property is cleared to avoid conflict
        field.string = undefined;
      }

      // Trigger update to reflect changes
      modeling.updateProperties(element, {});
    } else {
      // Regular property update
      const props = {};
      props[key] = value === '' ? undefined : value;
      modeling.updateProperties(element, props);
    }
  }

  function getPropertyValue(key, defaultValue = '') {
    const bo = element.businessObject;

    // Map custom properties to field names
    const fieldNameMap = {
      'custom:inputKey': 'INPUT_KEY',
      'custom:inputValues': 'INPUT_VALUES',
      'custom:outputValue': 'OUTPUT_VALUE'
    };

    // Try direct property access first
    if (key.includes(':')) {
      const value = bo.get(key);
      if (value !== undefined && value !== null) {
        return value;
      }
    } else {
      if (bo[key] !== undefined && bo[key] !== null) {
        return bo[key];
      }
    }

    // Try to read from extensionElements as activiti:field
    if (bo.extensionElements && bo.extensionElements.values) {
      const fieldName = fieldNameMap[key] || key.split(':')[1]?.toUpperCase() || key.toUpperCase();

      const field = bo.extensionElements.values.find(v =>
        v.$type === 'activiti:Field' &&
        v.name === fieldName
      );

      if (field) {
        // Try stringValue attribute first
        if (field.stringValue !== undefined && field.stringValue !== null) {
          return field.stringValue;
        }

        // Try expression attribute
        if (field.expression !== undefined && field.expression !== null) {
          return field.expression;
        }

        // Try string property (can be object with text property or direct string)
        if (field.string) {
          // If it's an object with text property (activiti:String type)
          if (typeof field.string === 'object' && field.string !== null) {
            if (field.string.text !== undefined && field.string.text !== null) {
              return field.string.text;
            }
            // Handle case where string object has $body property
            if (field.string.$body !== undefined && field.string.$body !== null) {
              return field.string.$body;
            }
          }
          // If it's a direct string
          else if (typeof field.string === 'string') {
            return field.string;
          }
        }

        // Try to access child elements directly (for <string> tags without namespace)
        if (field.$children) {
          for (const child of field.$children) {
            // Check for TextNode or legacy String types
            if (child.$type === 'string' || child.$type === 'activiti:String' || child.$type === 'activiti:TextNode' || child.$type === 'activiti:Value') {
              if (child.text !== undefined && child.text !== null) {
                return child.text;
              }
              if (child.$body !== undefined && child.$body !== null) {
                return child.$body;
              }
            }
          }
        }
      }
    }

    return defaultValue;
  }

  function renderPropertyRow(label, value, onChange, type = 'text', options = null, inputProps = null) {
    // Special handling for Listeners field
    if (label === 'Listeners') {
      // Build listeners array display - combine MessageListener and StatusListener
      const bo = element.businessObject;
      const extensionElements = bo.extensionElements;
      let listenersArray = [];

      if (extensionElements && extensionElements.values) {
        // Get all listeners
        const messageListeners = extensionElements.values.filter(v =>
          v.$type === 'activiti:ExecutionListener' &&
          v.class &&
          v.class.includes('TakeProcessListenerMessage')
        );

        const statusListeners = extensionElements.values.filter(v =>
          v.$type === 'activiti:ExecutionListener' &&
          v.class &&
          v.class.includes('TakeProcessListenerStatus')
        );

        // Helper to extract field value - improved to handle all field types
        const getListenerFields = (listener) => {
          if (!listener) return [];

          if (Array.isArray(listener.fields) && listener.fields.length > 0) {
            return listener.fields;
          }

          if (Array.isArray(listener.$children)) {
            const childFields = listener.$children.filter(c =>
              c.$type === 'activiti:Field' || c.$type === 'Field' || c.$type === 'field'
            );
            if (childFields.length > 0) return childFields;
          }

          return [];
        };

        const getFieldValueFromField = (field) => {
          if (!field) return '';

          // Try stringValue attribute first
          if (field.stringValue !== undefined && field.stringValue !== null) {
            return String(field.stringValue);
          }

          // Try expression attribute
          if (field.expression !== undefined && field.expression !== null) {
            return String(field.expression);
          }

          // Try string property (can be object with text property or direct string)
          if (field.string) {
            if (typeof field.string === 'object' && field.string !== null) {
              if (field.string.text !== undefined && field.string.text !== null) {
                return String(field.string.text);
              }
              // Handle case where string object has $body property
              if (field.string.$body !== undefined && field.string.$body !== null) {
                return String(field.string.$body);
              }
            } else if (typeof field.string === 'string') {
              return String(field.string);
            }
          }

          // Try to access child elements directly (for <string> tags without namespace)
          if (field.$children) {
            for (const child of field.$children) {
              if (child.$type === 'string' || child.$type === 'activiti:String' || child.$type === 'activiti:Value' || child.$type === 'activiti:ActivitiString') {
                if (child.text !== undefined && child.text !== null) {
                  return String(child.text);
                }
                if (child.$body !== undefined && child.$body !== null) {
                  return String(child.$body);
                }
              }
            }
          }

          return '';
        };

        // Build map for status fields by result code (field name)
        const statusFieldMap = new Map();
        statusListeners.forEach(statusListener => {
          const statusFields = getListenerFields(statusListener);
          statusFields.forEach(field => {
            const key = field.name != null ? String(field.name) : '';
            if (key) {
              statusFieldMap.set(key, getFieldValueFromField(field));
            }
          });
        });

        // Combine data: resultCode (field name) and message (field value) from MessageListener,
        // and status from StatusListener with same field name
        messageListeners.forEach(msgListener => {
          const msgFields = getListenerFields(msgListener);
          msgFields.forEach(field => {
            const resultCode = field.name != null ? String(field.name) : '';
            const message = getFieldValueFromField(field);
            const status = resultCode ? (statusFieldMap.get(resultCode) || '') : '';

            if (resultCode || message || status) {
              listenersArray.push(`[${resultCode}, ${message}, ${status}]`);
            }
          });
        });
      }

      const listenersDisplayValue = listenersArray.length > 0
        ? `[${listenersArray.join(', ')}]`
        : '';

      return (
        <tr key={label} className={listenersDisplayValue ? 'has-value' : ''}>
          <td className="property-name">{label}</td>
          <td className="property-value">
            <button
              className="listeners-btn"
              onClick={() => setShowListenersModal(true)}
              title={listenersDisplayValue}
            >
              {listenersDisplayValue || '[  ]'}
            </button>
          </td>
        </tr>
      );
    }

    return (
      <tr key={label} className={value ? 'has-value' : ''}>
        <td className="property-name">{label}</td>
        <td className="property-value">
          {onChange === null ? (
            <span>{value}</span>
          ) : type === 'select' ? (
            <select value={value} onChange={onChange}>
              {options && options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : type === 'textarea' ? (
            <textarea value={value} onChange={onChange} rows="2" {...(inputProps || {})}></textarea>
          ) : (
            <input type={type} value={value} onChange={onChange} {...(inputProps || {})} />
          )}
        </td>
      </tr>
    );
  }

  function makeMessageEvent() {

    const bpmnReplace = modeler.get('bpmnReplace');

    bpmnReplace.replaceElement(element, {
      type: element.businessObject.$type,
      eventDefinitionType: 'bpmn:MessageEventDefinition'
    });
  }

  function makeServiceTask(name) {
    const bpmnReplace = modeler.get('bpmnReplace');

    bpmnReplace.replaceElement(element, {
      type: 'bpmn:ServiceTask'
    });
  }

  function attachTimeout() {
    const modeling = modeler.get('modeling');
    const autoPlace = modeler.get('autoPlace');
    const selection = modeler.get('selection');

    const attrs = {
      type: 'bpmn:BoundaryEvent',
      eventDefinitionType: 'bpmn:TimerEventDefinition'
    };

    const position = {
      x: element.x + element.width,
      y: element.y + element.height
    };

    const boundaryEvent = modeling.createShape(attrs, position, element, { attach: true });

    const taskShape = append(boundaryEvent, {
      type: 'bpmn:Task'
    });

    selection.select(taskShape);
  }

  function isTimeoutConfigured(element) {
    const attachers = element.attachers || [];

    return attachers.some(e => hasDefinition(e, 'bpmn:TimerEventDefinition'));
  }

  function getConditionValue(conditionExpr) {
    // Extract values from condition expression
    // Example: ${$RESULT_CODE=='0' || $RESULT_CODE=='2'} -> "0,2"
    if (!conditionExpr?.body) return '';

    const body = conditionExpr.body;
    const matches = body.match(/\$RESULT_CODE=='(\d+)'/g);

    if (!matches || matches.length === 0) {
      return body; // Return full expression if format doesn't match
    }

    const values = matches.map(m => m.match(/'(\d+)'/)[1]);
    return values.join(',');
  }

  function buildConditionExpression(value) {
    // Convert "0,2,3" to ${$RESULT_CODE=='0' || $RESULT_CODE=='2' || $RESULT_CODE=='3'}
    if (!value || value.trim() === '') {
      return '';
    }

    // Check if it's already a full expression
    if (value.includes('${') && value.includes('}')) {
      return value;
    }

    const values = value.split(',').map(v => v.trim()).filter(v => v);
    if (values.length === 0) return '';

    const conditions = values.map(v => `$RESULT_CODE=='${v}'`).join(' || ');
    return `\${${conditions}}`;
  }

  function updateCondition(value) {
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    const parts = (value || '').split(',').map(v => v.trim()).filter(v => v);
    const uniqueParts = Array.from(new Set(parts));
    const sortedParts = uniqueParts.slice().sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      const aIsNum = Number.isFinite(na);
      const bIsNum = Number.isFinite(nb);

      if (aIsNum && bIsNum) return na - nb;
      if (aIsNum && !bIsNum) return -1;
      if (!aIsNum && bIsNum) return 1;
      return a.localeCompare(b);
    });
    const trimmedValue = sortedParts.join(',');
    const expressionValue = buildConditionExpression(trimmedValue);

    const conditionExpr = element.businessObject.conditionExpression;
    if (conditionExpr && conditionExpr.$descriptor) {
      conditionExpr.body = expressionValue;
    } else if (expressionValue) {
      element.businessObject.conditionExpression = bpmnFactory.create('bpmn:FormalExpression', {
        body: expressionValue
      });
    }

    modeling.updateProperties(element, {
      conditionExpression: element.businessObject.conditionExpression,
      name: trimmedValue || undefined
    });
  }

  React.useEffect(() => {
    if (is(element, 'bpmn:SequenceFlow')) {
      const conditionExpr = element.businessObject.conditionExpression;
      const conditionDisplayValue = getConditionValue(conditionExpr);
      setConditionInput(conditionDisplayValue);
    } else {
      setConditionInput('');
    }
  }, [element.id, element.businessObject?.conditionExpression?.body]);

  function renderSection(title, rows) {
    if (!rows || rows.length === 0) return null;

    return (
      <div key={title} className="properties-section">
        <div className="section-header">
          <span className="section-title">{title}</span>
        </div>
        <table className="properties-table">
          <tbody>
            {rows}
          </tbody>
        </table>
      </div>
    );
  }

  // Build sections for General properties
  const generalRows = [];
  generalRows.push(
    renderPropertyRow('ID', element.id, null)
  );
  generalRows.push(
    renderPropertyRow('Name', element.businessObject.name || '',
      (e) => updateName(e.target.value))
  );

  // StartEvent properties
  if (is(element, 'bpmn:StartEvent')) {
    generalRows.push(
      renderPropertyRow('FormKey', getPropertyValue('form:formKey', ''),
        (e) => updateProperty('form:formKey', e.target.value))
    );
    generalRows.push(
      renderPropertyRow('Initiator', getPropertyValue('activiti:initiator', ''),
        (e) => updateProperty('activiti:initiator', e.target.value))
    );
  }

  // EndEvent properties
  if (is(element, 'bpmn:EndEvent')) {
    generalRows.push(
      renderPropertyRow('TerminateAll', getPropertyValue('activiti:terminateAll', 'false'),
        (e) => updateProperty('activiti:terminateAll', e.target.value === 'true'),
        'select', ['false', 'true'])
    );
  }

  if (is(element, 'bpmn:ServiceTask')) {
    generalRows.push(
      renderPropertyRow('Class', getPropertyValue('activiti:class', ''),
        (e) => updateProperty('activiti:class', e.target.value))
    );
    generalRows.push(
      renderPropertyRow('Asynchronous', getPropertyValue('activiti:async', 'false'),
        (e) => updateProperty('activiti:async', e.target.value === 'true'),
        'select', ['false', 'true'])
    );
    generalRows.push(
      renderPropertyRow('Exclusive', getPropertyValue('activiti:exclusive', 'true'),
        (e) => updateProperty('activiti:exclusive', e.target.value === 'true'),
        'select', ['false', 'true'])
    );
  }

  // Build sections for Parameter properties
  const parameterRows = [];

  if (is(element, 'bpmn:ServiceTask')) {
    parameterRows.push(
      renderPropertyRow('Input_Key', getPropertyValue('custom:inputKey', ''),
        (e) => updateProperty('custom:inputKey', e.target.value))
    );
    parameterRows.push(
      renderPropertyRow('Input_Values', getPropertyValue('custom:inputValues', ''),
        (e) => updateProperty('custom:inputValues', e.target.value))
    );
    parameterRows.push(
      renderPropertyRow('Output_Value', getPropertyValue('custom:outputValue', ''),
        (e) => updateProperty('custom:outputValue', e.target.value))
    );
    parameterRows.push(
      renderPropertyRow('Retry', getPropertyValue('telsoft:gateway', ''),
        (e) => updateProperty('telsoft:gateway', e.target.value))
    );
  }

  // Build sections for Flow properties
  const flowRows = [];
  const listenersRows = [];
  const mainConfigRows = [];

  if (is(element, 'bpmn:SequenceFlow')) {
    listenersRows.push(
      renderPropertyRow('Listeners', '', null)
    );

    mainConfigRows.push(
      renderPropertyRow(
        'Condition',
        conditionInput,
        (e) => {
          const nextValue = e.target.value;
          setConditionInput(nextValue);
          updateCondition(nextValue);
        },
        'text',
        null,
        {
          onBlur: () => {
            const conditionExpr = element.businessObject.conditionExpression;
            const conditionDisplayValue = getConditionValue(conditionExpr);
            setConditionInput(conditionDisplayValue);
          }
        }
      )
    );
  }

  return (
    <div className="element-properties table-layout" key={element.id}>
      <div className="properties-container">
        {renderSection('General', generalRows)}
        {is(element, 'bpmn:SequenceFlow') && renderSection('Listeners', listenersRows)}
        {is(element, 'bpmn:SequenceFlow') && renderSection('Main config', mainConfigRows)}
        {renderSection('Parameter', parameterRows)}
        {!is(element, 'bpmn:SequenceFlow') && renderSection('Flow', flowRows)}

        {/* Actions */}
        <div className="properties-actions">
          {
            is(element, 'bpmn:Task') && !is(element, 'bpmn:ServiceTask') &&
            <button onClick={makeServiceTask}>Make Service Task</button>
          }

          {
            is(element, 'bpmn:Event') && !hasDefinition(element, 'bpmn:MessageEventDefinition') &&
            <button onClick={makeMessageEvent}>Make Message Event</button>
          }

          {
            is(element, 'bpmn:Task') && !isTimeoutConfigured(element) &&
            <button onClick={attachTimeout}>Attach Timeout</button>
          }
        </div>
      </div>

      {showListenersModal && (
        <ListenersModal
          element={element}
          modeler={modeler}
          onClose={() => setShowListenersModal(false)}
        />
      )}
    </div>
  );
}


// helpers ///////////////////

function hasDefinition(event, definitionType) {

  const definitions = event.businessObject.eventDefinitions || [];

  return definitions.some(d => is(d, definitionType));
}
