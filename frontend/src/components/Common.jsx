import React from 'react';
import { AlertTriangle } from 'lucide-react';

export function StatusTile({ icon, label, value }) {
  return (
    <div className="status-tile">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{String(value).replaceAll('_', ' ')}</strong>
    </div>
  );
}

export function SectionTitle({ icon, label, compact = false }) {
  return (
    <div className={`section-title ${compact ? 'compact' : ''}`}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

export function Input({ label, value, onChange }) {
  return (
    <label>
      {label}
      <input type="text" value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function EmptyState({ icon, text }) {
  return (
    <div className="empty-state">
      {icon}
      <span>{text}</span>
    </div>
  );
}

export function SectionError({ message }) {
  return (
    <div className="section-error" role="alert" tabIndex={-1}>
      <AlertTriangle size={17} />
      <span>{message}</span>
    </div>
  );
}
