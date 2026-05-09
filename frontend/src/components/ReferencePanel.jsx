import React from 'react';
import {
  BookOpen,
  Database,
  Globe2,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  TableProperties,
  Trash2,
} from 'lucide-react';

import { websiteExamples } from '../config';
import { isImportedReference, mysqlPresetLabel } from '../utils';
import { Input, SectionError, SectionTitle } from './Common';

export function ReferencePanel({
  generator,
  loading,
  references,
  selectedReference,
  websiteUrl,
  websiteName,
  updateGenerator,
  setWebsiteUrl,
  setWebsiteName,
  importWebsiteReference,
  useWebsiteExample,
  refreshReferences,
  mysql,
  mysqlStatus,
  mysqlPreview,
  mysqlDatabases,
  savedMysqlDatabases,
  selectedSavedMysqlId,
  selectedSavedMysqlDatabase,
  canSaveMysqlDatabase,
  mysqlSaveHint,
  referenceError,
  websiteError,
  mysqlError,
  setSelectedSavedMysqlId,
  updateMysql,
  testMysqlConnection,
  previewMysqlQuery,
  importMysqlReference,
  saveMysqlDatabase,
  loadSavedMysqlDatabase,
  useMysqlRowInValidator,
  useStoredReferenceInValidator,
  deleteStoredReference,
}) {
  return (
    <section className="reference-workbench-panel" id="sources-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Sources and queries</p>
          <h2>External Reference Workbench</h2>
        </div>
        <button className="icon-button text-button" onClick={refreshReferences} title="Refresh references">
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <div className="reference-source-block">
        <section className="form-section section-reference">
          <SectionTitle icon={<Database size={17} />} label="Stored References" compact />
          {referenceError && <SectionError message={referenceError} />}
          <div className="form-grid two">
            <label>
              Database Reference
              <select
                value={generator.reference_id ?? ''}
                onChange={(event) => updateGenerator(['reference_id'], event.target.value ? Number(event.target.value) : null)}
              >
                <option value="">No reference</option>
                {references.map((reference) => (
                  <option key={reference.id} value={reference.id}>
                    {reference.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedReference ? (
            <div className="reference-preview">
              <div>
                <BookOpen size={17} />
                <strong>{selectedReference.name}</strong>
                <span>{selectedReference.source_type}</span>
              </div>
              <p>{selectedReference.content_summary}</p>
              <div className="reference-actions">
                <button
                  className="reference-action-button"
                  type="button"
                  onClick={useStoredReferenceInValidator}
                  disabled={loading === 'reference-use'}
                >
                  {loading === 'reference-use' ? <RefreshCw className="spin" size={15} /> : <ShieldCheck size={15} />}
                  Use in Validator
                </button>
                {isImportedReference(selectedReference) && (
                  <button
                    className="reference-action-button danger"
                    type="button"
                    onClick={() => deleteStoredReference(selectedReference)}
                    disabled={loading === 'reference-delete'}
                    title="Remove imported reference"
                  >
                    {loading === 'reference-delete' ? <RefreshCw className="spin" size={15} /> : <Trash2 size={15} />}
                    Remove
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="reference-preview muted">
              <div>
                <BookOpen size={17} />
                <strong>No reference selected</strong>
                <span>database</span>
              </div>
              <p>Select a stored reference, import a website, or query MySQL.</p>
            </div>
          )}
        </section>

        <section className="form-section section-website">
          <SectionTitle icon={<Globe2 size={17} />} label="Website Import" compact />
          {websiteError && <SectionError message={websiteError} />}
          <div className="website-example-row">
            <span>Example website</span>
            {websiteExamples.map((example) => (
              <button key={example.url} type="button" onClick={() => useWebsiteExample(example)}>
                {example.label}
              </button>
            ))}
          </div>
          <div className="website-import">
            <Input label="Website URL" value={websiteUrl} onChange={setWebsiteUrl} />
            <Input label="Reference Name" value={websiteName} onChange={setWebsiteName} />
            <button className="icon-button text-button strong" onClick={importWebsiteReference} disabled={loading === 'website'} title="Import website reference">
              {loading === 'website' ? <RefreshCw className="spin" size={17} /> : <Save size={17} />}
              Import
            </button>
          </div>
        </section>
      </div>

      <section className="form-section section-mysql">
        <div className="mysql-box">
          <div className="mysql-heading">
            <div>
              <Server size={18} />
              <strong>MySQL Workbench Database</strong>
            </div>
            <div className="action-row mysql-actions">
              <button className="icon-button text-button" onClick={testMysqlConnection} disabled={loading === 'mysql-test'} title="Test MySQL connection">
                {loading === 'mysql-test' ? <RefreshCw className="spin" size={17} /> : <Database size={17} />}
                Test
              </button>
            </div>
          </div>

          {mysqlError && <SectionError message={mysqlError} />}

          <div className="saved-database-panel">
            <Input label="Preset Name" value={mysql.connection_name} onChange={(value) => updateMysql('connection_name', value)} />
            <label>
              Saved Database
              <select value={selectedSavedMysqlId} onChange={(event) => setSelectedSavedMysqlId(event.target.value)}>
                <option value="">Choose saved database</option>
                {savedMysqlDatabases.map((database) => (
                  <option key={database.id} value={database.id}>
                    {mysqlPresetLabel(database)}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-row save-password-toggle" title="Optionally save this MySQL password in the local SQLite app database">
              <input
                type="checkbox"
                checked={Boolean(mysql.save_password)}
                onChange={(event) => updateMysql('save_password', event.target.checked)}
              />
              <span>Save password</span>
            </label>
            <span className="field-help password-save-help">Optional. Stored locally in this app database only when checked.</span>
            <div className="saved-database-actions">
              <button
                className="icon-button text-button strong"
                type="button"
                onClick={saveMysqlDatabase}
                disabled={loading === 'mysql-save' || !canSaveMysqlDatabase}
                title={canSaveMysqlDatabase ? 'Save database preset' : mysqlSaveHint}
              >
                {loading === 'mysql-save' ? <RefreshCw className="spin" size={17} /> : <Save size={17} />}
                Save DB
              </button>
              <button
                className="icon-button text-button"
                type="button"
                disabled={!selectedSavedMysqlDatabase}
                onClick={() => loadSavedMysqlDatabase(selectedSavedMysqlDatabase)}
                title="Load saved database preset"
              >
                <Database size={17} />
                Load
              </button>
            </div>
            <span className="field-help saved-database-help">{mysqlSaveHint}</span>
          </div>

          <div className="form-grid mysql-grid">
            <Input label="Host" value={mysql.host} onChange={(value) => updateMysql('host', value)} />
            <Input label="Port" value={mysql.port} onChange={(value) => updateMysql('port', value)} />
            <Input label="User" value={mysql.user} onChange={(value) => updateMysql('user', value)} />
            <Input label="Password" value={mysql.password} onChange={(value) => updateMysql('password', value)} />
            <Input label="Database" value={mysql.database} onChange={(value) => updateMysql('database', value)} />
          </div>

          {mysqlDatabases.length > 0 && (
            <div className="database-picker">
              <span>Available databases</span>
              <div>
                {mysqlDatabases.map((database) => (
                  <button key={database} type="button" onClick={() => updateMysql('database', database)}>
                    {database}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label>
            SELECT Query
            <textarea
              className="mysql-query"
              value={mysql.query}
              onChange={(event) => updateMysql('query', event.target.value)}
              spellCheck="false"
            />
            <span className="field-help">Use read-only SELECT queries. WHERE filters and a single trailing semicolon are supported.</span>
          </label>
          <button className="icon-button text-button strong mysql-run-query-button" onClick={previewMysqlQuery} disabled={loading === 'mysql-preview'} title="Run MySQL query">
            {loading === 'mysql-preview' ? <RefreshCw className="spin" size={17} /> : <TableProperties size={17} />}
            Run Query
          </button>

          <div className="form-grid mysql-import-grid">
            <Input label="Name Column" value={mysql.name_column} onChange={(value) => updateMysql('name_column', value)} />
            <Input label="Custom Reference Name" value={mysql.custom_name} onChange={(value) => updateMysql('custom_name', value)} />
            <Input label="Content Column" value={mysql.content_column} onChange={(value) => updateMysql('content_column', value)} />
            <button
              className="icon-button text-button strong mysql-import-button"
              onClick={importMysqlReference}
              disabled={loading === 'mysql-import'}
              title="Import MySQL reference"
            >
              {loading === 'mysql-import' ? <RefreshCw className="spin" size={17} /> : <Save size={17} />}
              Import
            </button>
          </div>
          <span className="field-help">
            Use Custom Reference Name when your query result has HL7 content but no name column. Content Column must point to the HL7 message field.
          </span>

          {mysqlStatus && <div className="db-status">{mysqlStatus}</div>}

          <div className="query-output">
            <div className="query-output-heading">
              <strong>{mysqlPreview ? `${mysqlPreview.row_count} rows` : 'Query Output'}</strong>
              <span>{mysqlPreview ? mysqlPreview.columns.join(', ') : 'Waiting for results'}</span>
            </div>
            {mysqlPreview ? (
              <div className="query-table-wrap">
                <table>
                  <thead>
                    <tr>
                      {mysqlPreview.columns.map((column) => (
                        <th key={column}>
                          <span className="query-cell-text" title={column}>
                            {column}
                          </span>
                        </th>
                      ))}
                      <th className="query-action-column">Validator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mysqlPreview.rows.map((row, rowIndex) => (
                      <tr key={`${row[mysql.name_column] || 'row'}-${rowIndex}`}>
                        {mysqlPreview.columns.map((column) => (
                          <td key={`${column}-${rowIndex}`}>
                            <span className="query-cell-text" title={String(row[column] ?? '')}>
                              {String(row[column] ?? '')}
                            </span>
                          </td>
                        ))}
                        <td className="query-action-column">
                          <button
                            className="table-action-button"
                            type="button"
                            onClick={() => useMysqlRowInValidator(row, rowIndex)}
                            disabled={loading === 'mysql-use'}
                            title="Load this row's HL7 content into the validator"
                          >
                            {loading === 'mysql-use' ? <RefreshCw className="spin" size={15} /> : <ShieldCheck size={15} />}
                            Use in Validator
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-query-state">
                <TableProperties size={18} />
                <span>No query results yet</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}
