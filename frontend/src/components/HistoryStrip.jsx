import React, { useEffect, useState } from 'react';
import { History, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';

import { historyDetailLabel, historyDisplayName, historyOptionLabel, labelize } from '../utils';
import { SectionError } from './Common';

export function HistoryStrip({ history, loading, refreshHistory, loadHistoryMessage, deleteHistoryMessage, error }) {
  const [selectedHistoryId, setSelectedHistoryId] = useState('');
  const selectedHistoryItem = history.find((item) => String(item.id) === selectedHistoryId) || null;

  useEffect(() => {
    if (selectedHistoryId && !selectedHistoryItem) {
      setSelectedHistoryId('');
    }
  }, [selectedHistoryId, selectedHistoryItem]);

  function selectHistoryItem(historyId) {
    setSelectedHistoryId(historyId);
  }

  return (
    <div className="history-strip">
      <div className="history-heading">
        <div>
          <History size={17} />
          <strong>Saved Generated HL7</strong>
        </div>
        <button className="icon-only" onClick={refreshHistory} title="Refresh history">
          <RefreshCw size={16} />
        </button>
      </div>
      {error && <SectionError message={error} />}
      {history.length ? (
        <>
          <div className="history-loader">
            <label>
              Generated HL7 Dropdown
              <select value={selectedHistoryId} onChange={(event) => selectHistoryItem(event.target.value)}>
                <option value="">Choose a saved generated message</option>
                {history.map((item) => (
                  <option key={item.id} value={item.id}>
                    {historyOptionLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <button className="icon-button text-button strong" type="button" disabled={!selectedHistoryItem} onClick={() => loadHistoryMessage(selectedHistoryItem)}>
              <ShieldCheck size={17} />
              Load to Validator
            </button>
            <button
              className="icon-button text-button danger"
              type="button"
              disabled={!selectedHistoryItem || loading === 'history-delete'}
              onClick={() => deleteHistoryMessage(selectedHistoryItem)}
              title="Remove saved generated HL7"
            >
              {loading === 'history-delete' ? <RefreshCw className="spin" size={17} /> : <Trash2 size={17} />}
              Remove
            </button>
          </div>
          <div className="history-list">
            {history.map((item) => (
              <button
                className={`history-item ${String(item.id) === selectedHistoryId ? 'selected' : ''}`}
                type="button"
                key={item.id}
                onClick={() => selectHistoryItem(String(item.id))}
                aria-pressed={String(item.id) === selectedHistoryId}
              >
                <span>{historyDisplayName(item)}</span>
                <strong>{labelize(item.report_type)}</strong>
                <small>{historyDetailLabel(item)}</small>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="history-empty">No saved messages yet.</div>
      )}
    </div>
  );
}
