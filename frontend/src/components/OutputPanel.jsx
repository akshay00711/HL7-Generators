import React from 'react';
import { AlertTriangle, CheckCircle2, FileCode2, ShieldCheck } from 'lucide-react';

import { labelize } from '../utils';
import { EmptyState } from './Common';

export function OutputPanel({ activeTab, parsed, validation }) {
  if (activeTab === 'validation') {
    return <ValidationPanel validation={validation} />;
  }
  if (activeTab === 'segments') {
    return <SegmentsPanel parsed={parsed} />;
  }
  return <ReadablePanel parsed={parsed} />;
}

function ReadablePanel({ parsed }) {
  if (!parsed) {
    return <EmptyState icon={<FileCode2 size={22} />} text="Parse or generate a message to see the readable view." />;
  }

  const summaryItems = Object.entries(parsed.summary);

  return (
    <div className="output-area">
      <div className="summary-grid">
        {summaryItems.map(([key, value]) => (
          <div className="summary-item" key={key}>
            <span>{labelize(key)}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="segment-timeline">
        {parsed.segments.map((segment) => (
          <article className="segment-block" key={`${segment.index}-${segment.name}`}>
            <header>
              <span>{segment.name}</span>
              <strong>{segment.description}</strong>
            </header>
            <p>{segment.raw}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function ValidationPanel({ validation }) {
  if (!validation) {
    return <EmptyState icon={<ShieldCheck size={22} />} text="Run validation to check generated or external HL7 messages." />;
  }

  return (
    <div className="output-area">
      <div className={`verdict ${validation.valid ? 'valid' : 'invalid'}`}>
        {validation.valid ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
        <div>
          <strong>{validation.valid ? 'Structurally valid' : 'Needs attention'}</strong>
          <span>
            {validation.errors} errors, {validation.warnings} warnings, {validation.infos} info
          </span>
        </div>
      </div>

      <div className="issue-list">
        {validation.issues.map((issue, index) => (
          <div className={`issue ${issue.severity}`} key={`${issue.message}-${index}`}>
            <span>{issue.severity}</span>
            <p>{issue.message}</p>
            <small>
              {[issue.segment, issue.field, issue.line ? `line ${issue.line}` : ''].filter(Boolean).join(' / ') || 'message'}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

function SegmentsPanel({ parsed }) {
  if (!parsed) {
    return <EmptyState icon={<FileCode2 size={22} />} text="Segment details appear after parsing a message." />;
  }

  return (
    <div className="output-area segment-table-area">
      {parsed.segments.map((segment) => (
        <details className="segment-detail" key={`${segment.index}-${segment.name}`}>
          <summary>
            <span>{segment.name}</span>
            <strong>{segment.description}</strong>
            <small>{segment.fields.length} fields</small>
          </summary>
          <div className="field-table">
            {segment.fields.map((field) => (
              <div className="field-row" key={field.position}>
                <span>{field.position}</span>
                <strong>{field.label}</strong>
                <code>{field.raw || '""'}</code>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
