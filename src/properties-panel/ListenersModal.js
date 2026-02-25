import React from 'react';
import './ListenersModal.css';

export default function ListenersModal(props) {
  const { element, onClose, modeler } = props;

  const [listeners, setListeners] = React.useState(getListenersFromElement());
  const [editIndex, setEditIndex] = React.useState(null);
  const [newRow, setNewRow] = React.useState({
    resultCode: '',
    message: '',
    status: ''
  });

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

      // Check 'val' property (new schema)
      if (field.val) {
        if (field.val.$body !== undefined) return String(field.val.$body);
        if (field.val.text !== undefined) return String(field.val.text);
      }

      // Try multiple ways to get the value (legacy 'string' property)
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

      // Try using get() method first (bpmn-moddle way)
      if (typeof listener.get === 'function') {
        try {
          const fieldsFromGet = listener.get('fields');
          if (Array.isArray(fieldsFromGet) && fieldsFromGet.length > 0) {
            return fieldsFromGet;
          }
        } catch (e) {
        }
      }

      // Try $children
      if (Array.isArray(listener.$children)) {
        const fields = listener.$children.filter(c =>
          c.$type === 'activiti:Field' || c.$type === 'Field' || c.$type === 'field'
        );
        if (fields.length > 0) return fields;
      }

      // Fallback to fields property
      if (Array.isArray(listener.fields)) {
        return listener.fields;
      }
      if (listener.fields) {
        return [listener.fields];
      }

      return [];
    };


    // Get fields from listeners
    // const msgFields = Array.isArray(messageListener.fields) ? messageListener.fields : (messageListener.fields ? [messageListener.fields] : []);
    // const sFields = Array.isArray(statusListener?.fields) ? statusListener.fields : (statusListener?.fields ? [statusListener.fields] : []);

    const msgFields = getFields(messageListener);
    const sFields = getFields(statusListener);

    // Process each field from messageListener
    return msgFields.map(msgField => {
      const fieldName = msgField.name || '';
      const message = getFieldValue(msgField); // Get value directly from field

      // Find corresponding field in statusListener with same name
      const statusField = sFields.find(f => f.name === fieldName);
      const status = statusField ? getFieldValue(statusField) : '';

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
    if (!newRow.resultCode || !newRow.message || !newRow.status) {
      alert('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    const newListener = {
      class: DEFAULT_CLASS,
      event: DEFAULT_EVENT,
      resultCode: newRow.resultCode,
      message: newRow.message,
      status: newRow.status
    };

    const updatedListeners = [...listeners, newListener];
    setListeners(updatedListeners);
    saveListenersToElement(updatedListeners);

    // Reset form
    setNewRow({ resultCode: '', message: '', status: '' });
  }

  function handleEditListener(index) {
    setEditIndex(index);
  }

  function handleSaveEdit(index) {
    const updatedListeners = [...listeners];
    const item = updatedListeners[index];
    if (!item.resultCode || !item.message || !item.status) {
      alert('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    updatedListeners[index] = {
      class: DEFAULT_CLASS,
      event: DEFAULT_EVENT,
      resultCode: item.resultCode,
      message: item.message,
      status: item.status
    };
    setListeners(updatedListeners);
    saveListenersToElement(updatedListeners);
    setEditIndex(null);
  }

  function handleDeleteListener(index) {
    const updatedListeners = listeners.filter((_, i) => i !== index);
    setListeners(updatedListeners);
    saveListenersToElement(updatedListeners);
    if (editIndex === index) {
      setEditIndex(null);
    }
  }

  function handleDuplicateListener(index) {
    const listener = listeners[index];
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

    const messageFields = [];
    const statusFields = [];

    // Helper to create a field with <string> body value
    const createField = (name, value) => {
      const field = bpmnFactory.create('activiti:Field', { name });

      // Use activiti:String to serialize as <string>...</string>
      field.string = moddle.create('activiti:String', {
        text: String(value)
      });

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
          {/* Table */}
          <div className="modal-table-title">Danh sách thêm số</div>
          <div className="modal-table">
            <table>
              <thead>
                <tr>
                  <th>RESULT_CODE</th>
                  <th>MESSAGE</th>
                  <th>STATUS</th>
                  <th style={{ width: '180px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr className="selected">
                  <td>
                    <input
                      type="text"
                      value={newRow.resultCode}
                      onChange={(e) => setNewRow({ ...newRow, resultCode: e.target.value })}
                      placeholder="RESULT_CODE"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={newRow.message}
                      onChange={(e) => setNewRow({ ...newRow, message: e.target.value })}
                      placeholder="MESSAGE"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={newRow.status}
                      onChange={(e) => setNewRow({ ...newRow, status: e.target.value })}
                      placeholder="STATUS"
                    />
                  </td>
                  <td className="action-cell">
                    <button className="action-btn save-btn" onClick={handleAddListener}>Thêm</button>
                  </td>
                </tr>
                {listeners.map((listener, index) => (
                  <tr
                    key={index}
                    className={editIndex === index ? 'selected' : ''}
                  >
                    <td>
                      {editIndex === index ? (
                        <input
                          type="text"
                          value={listener.resultCode}
                          onChange={(e) => {
                            const updated = [...listeners];
                            updated[index] = { ...updated[index], resultCode: e.target.value };
                            setListeners(updated);
                          }}
                        />
                      ) : (
                        listener.resultCode
                      )}
                    </td>
                    <td>
                      {editIndex === index ? (
                        <input
                          type="text"
                          value={listener.message}
                          onChange={(e) => {
                            const updated = [...listeners];
                            updated[index] = { ...updated[index], message: e.target.value };
                            setListeners(updated);
                          }}
                        />
                      ) : (
                        listener.message
                      )}
                    </td>
                    <td>
                      {editIndex === index ? (
                        <input
                          type="text"
                          value={listener.status}
                          onChange={(e) => {
                            const updated = [...listeners];
                            updated[index] = { ...updated[index], status: e.target.value };
                            setListeners(updated);
                          }}
                        />
                      ) : (
                        listener.status
                      )}
                    </td>
                    <td className="action-cell">
                      {editIndex === index ? (
                        <>
                          <button className="action-btn save-btn" onClick={() => handleSaveEdit(index)}>Lưu</button>
                          <button className="action-btn delete-btn" onClick={() => setEditIndex(null)}>Huỷ</button>
                        </>
                      ) : (
                        <>
                          <button className="action-btn edit-btn" onClick={() => handleEditListener(index)}>Sửa</button>
                          <button className="action-btn info-btn" onClick={() => handleDuplicateListener(index)}>Sao chép</button>
                          <button className="action-btn delete-btn" onClick={() => handleDeleteListener(index)}>Xoá</button>
                        </>
                      )}
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
