import React from 'react';
import './ListenersModal.css';

export default function ListenersModal(props) {
  const { element, onClose, modeler } = props;

  const [listeners, setListeners] = React.useState(getListenersFromElement());
  const [selectedIndex, setSelectedIndex] = React.useState(null);
  const [resultCode, setResultCode] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [status, setStatus] = React.useState('');

  // Default class for all listeners
  const DEFAULT_CLASS = 'telsoft.app.activiti.Listener.TakeProcessListener';
  const DEFAULT_EVENT = 'take';

  function getListenersFromElement() {
    const bo = element.businessObject;
    const extensionElements = bo.extensionElements;
    
    if (!extensionElements || !extensionElements.values) {
      return [];
    }

    // Helper function to get field value from text content inside <string>
    const getFieldValue = (field) => {
      if (!field) return '';

      // Try multiple ways to get the value
      if (field.string) {
        // Try $body first
        if (field.string.$body !== undefined) {
          return String(field.string.$body);
        }
        // Try text property
        if (field.string.text !== undefined) {
          return String(field.string.text);
        }
        // Try value property
        if (field.string.value !== undefined) {
          return String(field.string.value);
        }
        // If string is directly a primitive value
        if (typeof field.string === 'string') {
          return field.string;
        }
      }

      // Fallback to checking stringValue property
      if (field.stringValue !== undefined) {
        return String(field.stringValue);
      }

      return '';
    };


    // Get the single MessageListener and StatusListener
    const messageListener = extensionElements.values.find(v => 
      v.$type === 'activiti:ExecutionListener' && 
      v.class && 
      v.class.includes('TakeProcessListenerMessage')
    );
    
    const statusListener = extensionElements.values.find(v => 
      v.$type === 'activiti:ExecutionListener' && 
      v.class && 
      v.class.includes('TakeProcessListenerStatus')
    );
    
    if (!messageListener) return [];

    const getFields = (listener) => {
      if (!listener) return [];

      console.log('getFields input listener:', listener);
      console.log('listener.$children:', listener.$children);
      console.log('listener.fields:', listener.fields);

      // Try using get() method first (bpmn-moddle way)
      if (typeof listener.get === 'function') {
        try {
          const fieldsFromGet = listener.get('fields');
          console.log('Fields from get("fields"):', fieldsFromGet);
          if (Array.isArray(fieldsFromGet) && fieldsFromGet.length > 0) {
            return fieldsFromGet;
          }
        } catch (e) {
          console.log('get() failed:', e);
        }
      }

      // Try $children
      if (Array.isArray(listener.$children)) {
        const fields = listener.$children.filter(c => c.$type === 'activiti:Field');
        console.log('Fields from $children:', fields);
        if (fields.length > 0) return fields;
      }

      // Fallback to fields property
      if (Array.isArray(listener.fields)) {
        console.log('Fields from listener.fields (array):', listener.fields);
        return listener.fields;
      }
      if (listener.fields) {
        console.log('Fields from listener.fields (single):', listener.fields);
        return [listener.fields];
      }

      console.log('No fields found');
      return [];
    };

    
    // Get fields from listeners
    // const msgFields = Array.isArray(messageListener.fields) ? messageListener.fields : (messageListener.fields ? [messageListener.fields] : []);
    // const sFields = Array.isArray(statusListener?.fields) ? statusListener.fields : (statusListener?.fields ? [statusListener.fields] : []);
    
    const msgFields = getFields(messageListener);
    const sFields   = getFields(statusListener);

    console.log('msgFields:', msgFields);
    console.log('sFields:', sFields);

    // Process each field from messageListener
    return msgFields.map(msgField => {
      console.log('=== Processing msgField ===');
      console.log('msgField:', msgField);
      console.log('msgField keys:', Object.keys(msgField));
      console.log('msgField.name:', msgField.name);
      console.log('msgField.string:', msgField.string);
      console.log('msgField.stringValue:', msgField.stringValue);

      // Try to use get() method
      if (typeof msgField.get === 'function') {
        try {
          console.log('msgField.get("string"):', msgField.get('string'));
          console.log('msgField.get("stringValue"):', msgField.get('stringValue'));
        } catch (e) {
          console.log('msgField.get() failed:', e);
        }
      }

      const fieldName = msgField.name || '';
      const message = getFieldValue(msgField); // Get value directly from field
      console.log('Extracted message:', message);

      // Find corresponding field in statusListener with same name
      const statusField = sFields.find(f => f.name === fieldName);
      console.log('Found statusField:', statusField);
      const status = statusField ? getFieldValue(statusField) : '';
      console.log('Extracted status:', status);

      return {
        class: messageListener.class,
        event: messageListener.event || DEFAULT_EVENT,
        resultCode: fieldName,  // RESULT_CODE is the field name
        message,
        status
      };
    });
  }

  function handleAddListener() {
    if (!resultCode || !message || !status) {
      alert('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    const newListener = {
      class: DEFAULT_CLASS,
      event: DEFAULT_EVENT,
      resultCode,
      message,
      status
    };
    
    const updatedListeners = [...listeners, newListener];
    setListeners(updatedListeners);
    saveListenersToElement(updatedListeners);
    
    // Reset form
    setResultCode('');
    setMessage('');
    setStatus('');
    setSelectedIndex(null);
  }

  function handleSelectListener(index) {
    const listener = listeners[index];
    setSelectedIndex(index);
    setResultCode(listener.resultCode);
    setMessage(listener.message);
    setStatus(listener.status);
  }

  function handleSaveListener() {
    if (selectedIndex === null) {
      alert('Vui lòng chọn listener để sửa');
      return;
    }

    if (!resultCode || !message || !status) {
      alert('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    const updatedListeners = [...listeners];
    updatedListeners[selectedIndex] = {
      class: DEFAULT_CLASS,
      event: DEFAULT_EVENT,
      resultCode,
      message,
      status
    };
    
    setListeners(updatedListeners);
    saveListenersToElement(updatedListeners);
    
    // Reset form
    setResultCode('');
    setMessage('');
    setStatus('');
    setSelectedIndex(null);
  }

  function handleDeleteListener(index) {
    const updatedListeners = listeners.filter((_, i) => i !== index);
    setListeners(updatedListeners);
    saveListenersToElement(updatedListeners);
    setSelectedIndex(null);
    setResultCode('');
    setMessage('');
    setStatus('');
  }

  function handleDuplicateListener() {
    if (selectedIndex === null) {
      alert('Vui lòng chọn listener để sao chép');
      return;
    }

    const listener = listeners[selectedIndex];
    const newListener = {
      class: listener.class,
      event: listener.event,
      resultCode: listener.resultCode,
      message: listener.message,
      status: listener.status
    };
    
    const updatedListeners = [...listeners, newListener];
    setListeners(updatedListeners);
    saveListenersToElement(updatedListeners);
  }

  function saveListenersToElement(updatedListeners) {
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    const moddle = modeler.get('moddle');
    const bo = element.businessObject;

    console.log('=== SAVE LISTENERS START ===');

    // Clear old listeners
    if (bo.extensionElements && bo.extensionElements.values) {
      bo.extensionElements.values = bo.extensionElements.values.filter(
        v => v.$type !== 'activiti:ExecutionListener'
      );
    } else if (!bo.extensionElements) {
      bo.extensionElements = bpmnFactory.create('bpmn:ExtensionElements');
      bo.extensionElements.values = [];
    }

    // Create single MessageListener with all fields
    const messageListener = moddle.create('activiti:ExecutionListener', {
      class: 'telsoft.app.activiti.Listener.TakeProcessListenerMessage',
      event: DEFAULT_EVENT
    });

    // Create single StatusListener with all fields
    const statusListener = moddle.create('activiti:ExecutionListener', {
      class: 'telsoft.app.activiti.Listener.TakeProcessListenerStatus',
      event: DEFAULT_EVENT
    });

    console.log('Created listeners, checking $descriptor...');
    console.log('messageListener.$descriptor:', messageListener.$descriptor);
    console.log('statusListener.$descriptor:', statusListener.$descriptor);

    const messageFields = [];
    const statusFields = [];

    // Helper to create a field with activiti:String
    const createField = (name, value) => {
      const field = moddle.create('activiti:Field', { name });
      const stringObj = moddle.create('activiti:String');

      // Set text as body content (isBody: true in activiti.json)
      stringObj.$body = value;

      // Set parent for string element
      stringObj.$parent = field;
      field.string = stringObj;

      console.log('Created field:', name, '- $descriptor:', field.$descriptor);
      console.log('Created string - $descriptor:', stringObj.$descriptor);

      return field;
    };

    // Add fields for each listener
    updatedListeners.forEach(listener => {
      messageFields.push(createField(listener.resultCode, listener.message));
      statusFields.push(createField(listener.resultCode, listener.status));
    });

    // Assign fields array to listeners - moddle will handle $parent automatically
    messageListener.fields = messageFields;
    statusListener.fields = statusFields;

    // Set $parent for each field
    messageFields.forEach(field => {
      field.$parent = messageListener;
    });
    statusFields.forEach(field => {
      field.$parent = statusListener;
    });

    console.log('Created messageListener:', messageListener);
    console.log('messageListener.$descriptor:', messageListener.$descriptor);
    console.log('messageFields:', messageFields);
    messageFields.forEach((field, idx) => {
      console.log(`Field ${idx}:`, field);
      console.log(`Field ${idx}.$descriptor:`, field.$descriptor);
      console.log(`Field ${idx}.string:`, field.string);
      console.log(`Field ${idx}.string.$descriptor:`, field.string?.$descriptor);
      console.log(`Field ${idx}.string.$body:`, field.string?.$body);
    });
    console.log('Created statusListener:', statusListener);
    console.log('statusFields:', statusFields);

    bo.extensionElements.values.push(messageListener);
    bo.extensionElements.values.push(statusListener);

    modeling.updateProperties(element, { extensionElements: bo.extensionElements });
  }

  return (
    <div className="listeners-modal-overlay" onClick={onClose}>
      <div className="listeners-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Sửa thêm số Listeners</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Input Section */}
          <div className="modal-input-section">
            <div className="input-row">
              <div className="input-group">
                <label>RESULT_CODE</label>
                <input 
                  type="text"
                  value={resultCode}
                  onChange={(e) => setResultCode(e.target.value)}
                  placeholder="e.g., 0"
                />
              </div>

              <div className="input-group">
                <label>MESSAGE</label>
                <input 
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g., CV19_SAI_CUPHAP"
                />
              </div>
            </div>

            <div className="input-row">
              <div className="input-group">
                <label>STATUS</label>
                <input 
                  type="text"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  placeholder="e.g., 5"
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="modal-buttons">
            <button className="btn btn-primary" onClick={handleAddListener}>Thêm</button>
            <button className="btn btn-info" onClick={handleDuplicateListener}>Sao chép</button>
            <button className="btn btn-success" onClick={handleSaveListener}>Sửa</button>
            <button className="btn btn-danger" onClick={() => selectedIndex !== null && handleDeleteListener(selectedIndex)}>Xoá</button>
            <button className="btn btn-default" onClick={onClose}>Hoàn</button>
          </div>

          {/* Table */}
          <div className="modal-table-title">Danh sách thêm số</div>
          <div className="modal-table">
            <table>
              <thead>
                <tr>
                  <th>RESULT_CODE</th>
                  <th>MESSAGE</th>
                  <th>STATUS</th>
                  <th style={{width: '50px'}}>Action</th>
                </tr>
              </thead>
              <tbody>
                {listeners.map((listener, index) => (
                  <tr 
                    key={index} 
                    onClick={() => handleSelectListener(index)}
                    className={selectedIndex === index ? 'selected' : ''}
                  >
                    <td>{listener.resultCode}</td>
                    <td>{listener.message}</td>
                    <td>{listener.status}</td>
                    <td className="action-cell">
                      <button 
                        className="action-btn delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteListener(index);
                        }}
                      >
                        Xoá
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
