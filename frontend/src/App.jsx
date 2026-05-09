import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ClipboardCheck,
  Database,
  FileCode2,
  Moon,
  ShieldCheck,
  Sun,
  WandSparkles,
} from 'lucide-react';

import { GeneratorPanel } from './components/GeneratorPanel';
import { HistoryStrip } from './components/HistoryStrip';
import { OutputPanel } from './components/OutputPanel';
import { ReferencePanel } from './components/ReferencePanel';
import { SectionError, SectionTitle, StatusTile } from './components/Common';
import {
  API_BASE,
  initialGenerator,
  initialMysql,
  initialTheme,
  initialWorkspacePanel,
  mysqlConnectionKeys,
  mysqlReferenceDraftResetKeys,
  workspaceHashes,
} from './config';
import {
  errorMessage,
  extractHl7CandidateFromMysqlRow,
  historyDisplayName,
  mysqlConnectionPayload,
  mysqlConnectionSignature,
  mysqlReferenceNameFromRow,
  mysqlRequiredDetailsPresent,
  mysqlSaveDatabaseHint,
  normalizeExternalHl7,
  responseErrorMessage,
} from './utils';

function App() {
  const [theme, setTheme] = useState(initialTheme);
  const [activeWorkspace, setActiveWorkspace] = useState(initialWorkspacePanel);
  const [generator, setGenerator] = useState(initialGenerator);
  const [rawMessage, setRawMessage] = useState('');
  const [parsed, setParsed] = useState(null);
  const [validation, setValidation] = useState(null);
  const [activeTab, setActiveTab] = useState('readable');
  const [loading, setLoading] = useState('');
  const [sectionErrors, setSectionErrors] = useState({});
  const [references, setReferences] = useState([]);
  const [history, setHistory] = useState([]);
  const [websiteUrl, setWebsiteUrl] = useState('http://127.0.0.1:5173/sample-hl7-reference.html');
  const [websiteName, setWebsiteName] = useState('');
  const [mysql, setMysql] = useState(initialMysql);
  const [mysqlStatus, setMysqlStatus] = useState('');
  const [mysqlPreview, setMysqlPreview] = useState(null);
  const [mysqlDatabases, setMysqlDatabases] = useState([]);
  const [savedMysqlDatabases, setSavedMysqlDatabases] = useState([]);
  const [selectedSavedMysqlId, setSelectedSavedMysqlId] = useState('');
  const [successfulMysqlTestSignature, setSuccessfulMysqlTestSignature] = useState('');
  const [pendingGeneratedSave, setPendingGeneratedSave] = useState(null);
  const [generatedSaveName, setGeneratedSaveName] = useState('');
  const [generatedMessageReady, setGeneratedMessageReady] = useState(false);
  const [mysqlReferenceDraft, setMysqlReferenceDraft] = useState(null);

  const compactMessage = useMemo(() => rawMessage.replace(/\r/g, '\n'), [rawMessage]);
  const selectedReference = useMemo(
    () => references.find((reference) => reference.id === generator.reference_id) || null,
    [references, generator.reference_id]
  );
  const selectedSavedMysqlDatabase = useMemo(
    () => savedMysqlDatabases.find((database) => String(database.id) === selectedSavedMysqlId) || null,
    [savedMysqlDatabases, selectedSavedMysqlId]
  );
  const currentMysqlSignature = useMemo(() => mysqlConnectionSignature(mysql), [mysql.host, mysql.port, mysql.user, mysql.password, mysql.database]);
  const mysqlDetailsReady = useMemo(() => mysqlRequiredDetailsPresent(mysql), [mysql]);
  const canSaveMysqlDatabase = mysqlDetailsReady && currentMysqlSignature === successfulMysqlTestSignature;
  const mysqlSaveHint = mysqlSaveDatabaseHint(mysql, canSaveMysqlDatabase, currentMysqlSignature, successfulMysqlTestSignature);

  useEffect(() => {
    refreshReferences();
    refreshHistory();
    refreshSavedMysqlDatabases();
  }, []);

  useEffect(() => {
    if (selectedSavedMysqlId && !selectedSavedMysqlDatabase) {
      setSelectedSavedMysqlId('');
    }
  }, [selectedSavedMysqlId, selectedSavedMysqlDatabase]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('hl7-ui-theme', theme);
  }, [theme]);

  useEffect(() => {
    function syncWorkspaceFromHash() {
      setActiveWorkspace(initialWorkspacePanel());
    }

    window.addEventListener('hashchange', syncWorkspaceFromHash);
    return () => window.removeEventListener('hashchange', syncWorkspaceFromHash);
  }, []);

  useEffect(() => {
    const hasError = Object.values(sectionErrors).some(Boolean);
    if (!hasError) return undefined;

    const timeout = window.setTimeout(() => {
      const visibleError = Array.from(document.querySelectorAll('.section-error')).find((element) => element.offsetParent !== null);
      if (!visibleError) return;
      visibleError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      visibleError.focus({ preventScroll: true });
    }, 80);

    return () => window.clearTimeout(timeout);
  }, [sectionErrors, activeWorkspace]);

  function clearSectionError(section) {
    setSectionErrors((current) => {
      if (!current[section]) return current;
      return { ...current, [section]: '' };
    });
  }

  function setSectionError(section, value) {
    setSectionErrors((current) => ({ ...current, [section]: errorMessage(value) }));
  }

  async function getApi(path) {
    const response = await fetch(`${API_BASE}${path}`);
    if (!response.ok) {
      throw new Error(await responseErrorMessage(response));
    }
    return response.json();
  }

  async function callApi(path, payload) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await responseErrorMessage(response));
    }
    return response.json();
  }

  async function deleteApi(path) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(await responseErrorMessage(response));
    }
    return response.json();
  }

  async function generateMessage() {
    setLoading('generate');
    clearSectionError('generator');
    try {
      const data = await callApi('/api/generate', {
        ...generator,
        save_to_history: false,
      });
      setRawMessage(data.message);
      setParsed(data.parsed);
      setValidation(data.validation);
      setActiveTab('validation');
      setMysqlReferenceDraft(null);
      setGeneratedMessageReady(true);
      setGeneratedSaveName('');
      setPendingGeneratedSave({
        message: data.message,
        report_type: generator.report_type,
        hl7_version: generator.hl7_version,
        reference_id: generator.reference_id,
      });
    } catch (apiError) {
      setSectionError('generator', apiError);
    } finally {
      setLoading('');
    }
  }

  async function saveGeneratedMessage() {
    if (!pendingGeneratedSave) return;

    setLoading('history-save');
    clearSectionError('generator');
    clearSectionError('history');
    try {
      const customName = generatedSaveName.trim();
      const historyItem = await callApi('/api/history', {
        message: pendingGeneratedSave.message,
        custom_name: customName || null,
        report_type: pendingGeneratedSave.report_type,
        hl7_version: pendingGeneratedSave.hl7_version,
        reference_id: pendingGeneratedSave.reference_id,
      });
      setHistory((current) => [historyItem, ...current.filter((item) => item.id !== historyItem.id)].slice(0, 12));
      setPendingGeneratedSave(null);
      setGeneratedSaveName('');
      clearSectionError('generator');
      clearSectionError('history');
    } catch (apiError) {
      setSectionError('generator', apiError);
    } finally {
      setLoading('');
    }
  }

  async function deleteHistoryMessage(item) {
    if (!item) return;
    if (!window.confirm(`Remove saved generated HL7 "${historyDisplayName(item)}"?`)) return;

    setLoading('history-delete');
    clearSectionError('history');
    try {
      await deleteApi(`/api/history/${item.id}`);
      setHistory((current) => current.filter((historyItem) => historyItem.id !== item.id));
      clearSectionError('history');
    } catch (apiError) {
      setSectionError('history', apiError);
    } finally {
      setLoading('');
    }
  }

  async function parseMessage() {
    setLoading('parse');
    clearSectionError('inspector');
    try {
      const data = await callApi('/api/parse', { message: rawMessage });
      setParsed(data.parsed);
      setActiveTab('readable');
    } catch (apiError) {
      setSectionError('inspector', apiError);
    } finally {
      setLoading('');
    }
  }

  async function validateMessage() {
    setLoading('validate');
    clearSectionError('inspector');
    try {
      const data = await callApi('/api/validate', {
        message: rawMessage,
        hl7_version: generator.hl7_version,
      });
      setValidation(data.validation);
      setActiveTab('validation');
    } catch (apiError) {
      setSectionError('inspector', apiError);
    } finally {
      setLoading('');
    }
  }

  async function refreshReferences() {
    try {
      const data = await getApi('/api/references');
      setReferences(data);
      clearSectionError('reference');
    } catch (apiError) {
      setSectionError('reference', apiError);
    }
  }

  async function refreshHistory() {
    try {
      const data = await getApi('/api/history?limit=12');
      setHistory(data);
      clearSectionError('history');
    } catch (apiError) {
      setSectionError('history', apiError);
    }
  }

  async function refreshSavedMysqlDatabases() {
    try {
      const data = await getApi('/api/external-databases/mysql/saved');
      setSavedMysqlDatabases(data);
      clearSectionError('mysql');
    } catch (apiError) {
      setSectionError('mysql', apiError);
    }
  }

  function loadHistoryMessage(item) {
    if (!item?.message?.trim()) {
      setSectionError('history', 'This saved history item does not include HL7 message content. Generate a new message or refresh history.');
      return;
    }

    setRawMessage(normalizeExternalHl7(item.message));
    setParsed(null);
    setValidation(null);
    setActiveTab('validation');
    setPendingGeneratedSave(null);
    setGeneratedSaveName('');
    setGeneratedMessageReady(false);
    setMysqlReferenceDraft(null);
    clearSectionError('history');
    clearSectionError('inspector');
  }

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
  }

  async function importWebsiteReference() {
    if (!websiteUrl.trim()) return;
    setLoading('website');
    clearSectionError('website');
    try {
      const data = await callApi('/api/references/import-website', {
        url: websiteUrl.trim(),
        name: websiteName.trim() || null,
        report_type: generator.report_type,
        hl7_version: generator.hl7_version,
        save: true,
      });
      setReferences((current) => [data.reference, ...current.filter((reference) => reference.id !== data.reference.id)]);
      updateGenerator(['reference_id'], data.reference.id);
      setWebsiteName('');
      clearSectionError('website');
    } catch (apiError) {
      setSectionError('website', apiError);
    } finally {
      setLoading('');
    }
  }

  async function deleteStoredReference(reference) {
    if (!reference) return;
    if (!isImportedReference(reference)) {
      setSectionError('reference', 'Built-in database references cannot be removed.');
      return;
    }
    if (!window.confirm(`Remove imported reference "${reference.name}"?`)) return;

    setLoading('reference-delete');
    clearSectionError('reference');
    try {
      await deleteApi(`/api/references/${reference.id}`);
      setReferences((current) => current.filter((item) => item.id !== reference.id));
      if (generator.reference_id === reference.id) {
        updateGenerator(['reference_id'], null);
      }
      clearSectionError('reference');
    } catch (apiError) {
      setSectionError('reference', apiError);
    } finally {
      setLoading('');
    }
  }

  function useWebsiteExample(example) {
    setWebsiteUrl(example.url);
    setWebsiteName(example.name);
    clearSectionError('website');
  }

  async function testMysqlConnection() {
    const testedMysql = { ...mysql };
    const testedSignature = mysqlConnectionSignature(testedMysql);

    setLoading('mysql-test');
    setMysqlStatus('');
    setSuccessfulMysqlTestSignature('');
    clearSectionError('mysql');
    try {
      const data = await callApi('/api/external-databases/mysql/test', {
        connection: mysqlConnectionPayload(testedMysql),
      });
      setMysqlDatabases(data.databases || []);
      const statusMessage = `${data.message} ${data.server_version ? `Server ${data.server_version}` : ''}`.trim();
      if (data.database_found) {
        setSuccessfulMysqlTestSignature(testedSignature);
        setMysqlStatus(`${statusMessage} Save DB is now available.`);
        clearSectionError('mysql');
      } else if (testedMysql.database.trim()) {
        setMysqlStatus(statusMessage);
        setSectionError('mysql', `${data.message} Choose an available database, then click Test again before saving.`);
      } else {
        setMysqlStatus(statusMessage);
        setSectionError('mysql', 'Choose a database from the list, then click Test again before saving.');
      }
    } catch (apiError) {
      setSectionError('mysql', apiError);
    } finally {
      setLoading('');
    }
  }

  async function previewMysqlQuery() {
    setLoading('mysql-preview');
    setMysqlStatus('');
    clearSectionError('mysql');
    try {
      const data = await callApi('/api/external-databases/mysql/query', {
        connection: mysqlConnectionPayload(mysql),
        query: mysql.query,
        limit: 5,
      });
      setMysqlPreview(data);
      setMysqlReferenceDraft(null);
      setMysqlStatus(`Preview loaded ${data.row_count} row${data.row_count === 1 ? '' : 's'}.`);
    } catch (apiError) {
      setSectionError('mysql', apiError);
    } finally {
      setLoading('');
    }
  }

  async function importMysqlReference() {
    const draftCanBeImported =
      mysqlReferenceDraft?.content &&
      normalizeExternalHl7(mysqlReferenceDraft.content) === normalizeExternalHl7(rawMessage) &&
      looksLikeHl7(mysqlReferenceDraft.content);
    const selectedName = draftCanBeImported ? mysqlReferenceNameFromRow(mysqlReferenceDraft.row, mysql, mysqlReferenceDraft.rowIndex) : null;

    setLoading('mysql-import');
    setMysqlStatus('');
    clearSectionError('mysql');
    try {
      const reference = await callApi('/api/external-databases/mysql/import-reference', {
        connection: mysqlConnectionPayload(mysql),
        query: mysql.query,
        name_column: mysql.name_column,
        custom_name: mysql.custom_name.trim() || null,
        content_column: mysql.content_column,
        report_type: generator.report_type,
        hl7_version: generator.hl7_version,
        selected_name: selectedName,
        selected_content: draftCanBeImported ? mysqlReferenceDraft.content : null,
      });
      setReferences((current) => [reference, ...current.filter((item) => item.id !== reference.id)]);
      updateGenerator(['reference_id'], reference.id);
      setMysqlStatus(
        reference.already_exists
          ? `"${reference.name}" is already stored. Existing reference selected.`
          : draftCanBeImported
            ? `Imported "${reference.name}" from selected validator row ${mysqlReferenceDraft.rowIndex + 1}.`
            : `Imported "${reference.name}" from MySQL.`
      );
    } catch (apiError) {
      setSectionError('mysql', apiError);
    } finally {
      setLoading('');
    }
  }

  async function saveMysqlDatabase() {
    if (!canSaveMysqlDatabase) {
      setSectionError('mysql', mysqlSaveHint);
      return;
    }

    setLoading('mysql-save');
    setMysqlStatus('');
    clearSectionError('mysql');
    try {
      const savedDatabase = await callApi('/api/external-databases/mysql/saved', {
        name: mysql.connection_name.trim() || null,
        connection: mysqlConnectionPayload(mysql),
        query: mysql.query,
        name_column: mysql.name_column,
        custom_name: mysql.custom_name.trim() || null,
        content_column: mysql.content_column,
        save_password: mysql.save_password,
      });
      setSavedMysqlDatabases((current) => [savedDatabase, ...current.filter((database) => database.id !== savedDatabase.id)]);
      setSelectedSavedMysqlId(String(savedDatabase.id));
      setMysql((current) => ({ ...current, connection_name: savedDatabase.name }));
      const passwordStatus = savedDatabase.password_saved ? 'Password saved locally.' : 'Password was not saved.';
      setMysqlStatus(
        savedDatabase.already_exists
          ? `"${savedDatabase.name}" already exists. Existing preset selected. ${passwordStatus}`
          : `Saved "${savedDatabase.name}". ${passwordStatus}`
      );
    } catch (apiError) {
      setSectionError('mysql', apiError);
    } finally {
      setLoading('');
    }
  }

  function loadSavedMysqlDatabase(savedDatabase) {
    if (!savedDatabase) return;

    setMysql((current) => ({
      ...current,
      connection_name: savedDatabase.name,
      host: savedDatabase.host,
      port: String(savedDatabase.port),
      user: savedDatabase.user,
      password: savedDatabase.saved_password || '',
      save_password: Boolean(savedDatabase.password_saved),
      database: savedDatabase.database,
      query: savedDatabase.query,
      name_column: savedDatabase.name_column,
      custom_name: savedDatabase.custom_name || '',
      content_column: savedDatabase.content_column,
    }));
    setMysqlPreview(null);
    setMysqlDatabases([]);
    setSuccessfulMysqlTestSignature('');
    setMysqlReferenceDraft(null);
    setMysqlStatus(
      savedDatabase.password_saved
        ? `Loaded "${savedDatabase.name}" with the saved password. Click Test before saving changes.`
        : `Loaded "${savedDatabase.name}". Enter the password again if this MySQL user requires one.`
    );
    clearSectionError('mysql');
  }

  async function loadHl7IntoValidator({ hl7Text, loadingKey, successMessage, errorSection, errorPrefix, onSuccess }) {
    const normalizedHl7 = normalizeExternalHl7(hl7Text);

    setLoading(loadingKey);
    setRawMessage(normalizedHl7);
    setParsed(null);
    setValidation(null);
    setPendingGeneratedSave(null);
    setGeneratedSaveName('');
    setGeneratedMessageReady(false);
    clearSectionError(errorSection);
    clearSectionError('inspector');
    showWorkspacePanel('validate');

    try {
      const data = await callApi('/api/parse', { message: normalizedHl7 });
      if (!data?.parsed?.segment_count) {
        throw new Error('Parser did not find any HL7 segments to display.');
      }
      setParsed(data.parsed);
      setActiveTab('readable');
      onSuccess?.(successMessage);
      return true;
    } catch (apiError) {
      const parserViewError = `${errorPrefix} was loaded, but it could not be shown in parser view: ${errorMessage(apiError)}. The raw HL7 is still available in the validator.`;
      setActiveTab('validation');
      setSectionError(errorSection, parserViewError);
      setSectionError('inspector', parserViewError);
      return false;
    } finally {
      setLoading('');
    }
  }

  async function useMysqlRowInValidator(row, rowIndex) {
    const hl7Candidate = extractHl7CandidateFromMysqlRow(row, mysql.content_column);
    if (!hl7Candidate.content) {
      setMysqlStatus('');
      setMysqlReferenceDraft(null);
      setSectionError(
        'mysql',
        `Row ${rowIndex + 1} does not contain HL7 content that can be parsed or validated. Set Content Column to a field whose value starts with MSH|.`
      );
      return;
    }

    setMysqlStatus('');
    const loaded = await loadHl7IntoValidator({
      hl7Text: hl7Candidate.content,
      loadingKey: 'mysql-use',
      successMessage: `Loaded row ${rowIndex + 1} into the validator and parser view. DB Import will save this same HL7 message.`,
      errorSection: 'mysql',
      errorPrefix: `Row ${rowIndex + 1}`,
      onSuccess: setMysqlStatus,
    });
    if (loaded) {
      setMysqlReferenceDraft({
        row,
        rowIndex,
        content: normalizeExternalHl7(hl7Candidate.content),
        contentColumn: hl7Candidate.column,
      });
    } else {
      setMysqlReferenceDraft(null);
    }
  }

  async function useStoredReferenceInValidator() {
    if (!selectedReference?.content?.trim()) {
      setSectionError('reference', 'Select a stored reference that contains an HL7 message first.');
      return;
    }

    const normalizedContent = normalizeExternalHl7(selectedReference.content);
    if (!looksLikeHl7(normalizedContent)) {
      setSectionError('reference', `"${selectedReference.name}" does not look like an HL7 message. Choose a stored reference whose content starts with MSH|.`);
      return;
    }

    await loadHl7IntoValidator({
      hl7Text: normalizedContent,
      loadingKey: 'reference-use',
      successMessage: '',
      errorSection: 'reference',
      errorPrefix: `"${selectedReference.name}"`,
    });
    setMysqlReferenceDraft(null);
  }

  function updateMysql(key, value) {
    setMysql((current) => ({
      ...current,
      [key]: key === 'save_password' ? Boolean(value) : String(value),
    }));
    clearSectionError('mysql');
    if (mysqlConnectionKeys.has(key)) {
      setSuccessfulMysqlTestSignature('');
      setMysqlStatus('');
    }
    if (mysqlReferenceDraftResetKeys.has(key)) {
      setMysqlReferenceDraft(null);
    }
  }

  function updateGenerator(path, value) {
    setGenerator((current) => {
      const next = structuredClone(current);
      let cursor = next;
      for (const key of path.slice(0, -1)) cursor = cursor[key];
      cursor[path.at(-1)] = value;
      return next;
    });
  }

  function updateObservation(index, key, value) {
    setGenerator((current) => {
      const observations = current.observations.map((observation, itemIndex) =>
        itemIndex === index ? { ...observation, [key]: value } : observation
      );
      return { ...current, observations };
    });
  }

  function addObservation() {
    setGenerator((current) => ({
      ...current,
      observations: [
        ...current.observations,
        {
          identifier: '2951-2',
          name: 'Sodium',
          value: '141',
          unit: 'mmol/L',
          reference_range: '135-145',
          abnormal_flag: 'N',
          value_type: 'NM',
          result_status: 'F',
        },
      ],
    }));
  }

  function removeObservation(index) {
    setGenerator((current) => ({
      ...current,
      observations: current.observations.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function showWorkspacePanel(panel) {
    setActiveWorkspace(panel);
    window.history.replaceState(null, '', workspaceHashes[panel]);
    window.requestAnimationFrame(() => {
      document.querySelector('.workspace-grid')?.scrollIntoView({ block: 'start' });
    });
  }

  function viewGeneratedInValidator() {
    if (!rawMessage.trim()) {
      setSectionError('generator', 'Generate an HL7 message first.');
      return;
    }
    setActiveTab('validation');
    showWorkspacePanel('validate');
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">AI-assisted HL7 v2 testing</p>
          <h1>HL7 AI Workbench</h1>
        </div>
        <div className="topbar-actions">
          <button className="theme-toggle" type="button" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <div className="status-pill">
            <Activity size={16} />
            Python API: {API_BASE.replace('http://', '')}
          </div>
        </div>
      </section>

      <section className="dashboard-layout">
        <aside className="workflow-sidebar" aria-label="Workflow status and navigation">
          <div className="workflow-card">
            <p className="eyebrow">Workflow</p>
            <h2>Build, test, validate</h2>
            <div className="quick-nav" role="tablist" aria-label="Workbench sections">
              <button type="button" className={activeWorkspace === 'generate' ? 'active' : ''} role="tab" aria-selected={activeWorkspace === 'generate'} onClick={() => showWorkspacePanel('generate')}>
                <WandSparkles size={16} />
                Generate
              </button>
              <button type="button" className={activeWorkspace === 'validate' ? 'active' : ''} role="tab" aria-selected={activeWorkspace === 'validate'} onClick={() => showWorkspacePanel('validate')}>
                <ShieldCheck size={16} />
                Validate
              </button>
              <button type="button" className={activeWorkspace === 'sources' ? 'active' : ''} role="tab" aria-selected={activeWorkspace === 'sources'} onClick={() => showWorkspacePanel('sources')}>
                <Database size={16} />
                Sources
              </button>
            </div>
          </div>

          <section className="overview-strip" aria-label="Workflow overview">
            <StatusTile icon={<ClipboardCheck size={19} />} label="Configure" value={generator.report_type} />
            <StatusTile icon={<Database size={19} />} label="Reference" value={selectedReference?.source_type || 'none'} />
            <StatusTile icon={<FileCode2 size={19} />} label="Segments" value={parsed?.segment_count || rawMessage.split('\r').filter(Boolean).length} />
            <StatusTile icon={<ShieldCheck size={19} />} label="Validation" value={validation ? (validation.valid ? 'valid' : 'review') : 'pending'} />
          </section>
        </aside>

        <section className="workspace-grid">
          {activeWorkspace === 'generate' && (
            <GeneratorPanel
              generator={generator}
              loading={loading}
              updateGenerator={updateGenerator}
              updateObservation={updateObservation}
              addObservation={addObservation}
              removeObservation={removeObservation}
              generateMessage={generateMessage}
              saveGeneratedMessage={saveGeneratedMessage}
              pendingGeneratedSave={pendingGeneratedSave}
              generatedSaveName={generatedSaveName}
              setGeneratedSaveName={setGeneratedSaveName}
              generatedMessageReady={generatedMessageReady}
              viewGeneratedInValidator={viewGeneratedInValidator}
              error={sectionErrors.generator}
            />
          )}

          {activeWorkspace === 'validate' && (
            <section className="inspector-panel" id="inspector-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Generated or external message</p>
                  <h2>HL7 Message Inspector</h2>
                </div>
                <div className="action-row">
                  <button className="icon-button text-button" onClick={parseMessage} disabled={loading === 'parse'} title="Parse message">
                    <FileCode2 size={17} />
                    Parse
                  </button>
                  <button className="icon-button text-button strong" onClick={validateMessage} disabled={loading === 'validate'} title="Validate message">
                    <ShieldCheck size={17} />
                    Validate
                  </button>
                </div>
              </div>

              <section className="inspector-section message-editor-section">
                <SectionTitle icon={<FileCode2 size={17} />} label="Raw HL7 Message" compact />
                <textarea
                  className="message-box"
                  value={compactMessage}
                  onChange={(event) => {
                    setRawMessage(event.target.value.replace(/\n/g, '\r'));
                    setPendingGeneratedSave(null);
                    setGeneratedSaveName('');
                    setGeneratedMessageReady(false);
                    setMysqlReferenceDraft(null);
                  }}
                  spellCheck="false"
                  aria-label="HL7 message"
                />
              </section>

              {sectionErrors.inspector && <SectionError message={sectionErrors.inspector} />}

              <HistoryStrip
                history={history}
                loading={loading}
                refreshHistory={refreshHistory}
                loadHistoryMessage={loadHistoryMessage}
                deleteHistoryMessage={deleteHistoryMessage}
                error={sectionErrors.history}
              />

              <section className="inspector-section output-section">
                <div className="tabs" role="tablist" aria-label="Message output">
                  <button className={activeTab === 'readable' ? 'active' : ''} onClick={() => setActiveTab('readable')}>
                    Readable
                  </button>
                  <button className={activeTab === 'validation' ? 'active' : ''} onClick={() => setActiveTab('validation')}>
                    Validation
                  </button>
                  <button className={activeTab === 'segments' ? 'active' : ''} onClick={() => setActiveTab('segments')}>
                    Segments
                  </button>
                </div>

                <OutputPanel activeTab={activeTab} parsed={parsed} validation={validation} />
              </section>
            </section>
          )}

          {activeWorkspace === 'sources' && (
            <ReferencePanel
              generator={generator}
              loading={loading}
              references={references}
              selectedReference={selectedReference}
              websiteUrl={websiteUrl}
              websiteName={websiteName}
              updateGenerator={updateGenerator}
              setWebsiteUrl={setWebsiteUrl}
              setWebsiteName={setWebsiteName}
              importWebsiteReference={importWebsiteReference}
              useWebsiteExample={useWebsiteExample}
              refreshReferences={refreshReferences}
              mysql={mysql}
              mysqlStatus={mysqlStatus}
              mysqlPreview={mysqlPreview}
              mysqlDatabases={mysqlDatabases}
              savedMysqlDatabases={savedMysqlDatabases}
              selectedSavedMysqlId={selectedSavedMysqlId}
              selectedSavedMysqlDatabase={selectedSavedMysqlDatabase}
              canSaveMysqlDatabase={canSaveMysqlDatabase}
              mysqlSaveHint={mysqlSaveHint}
              referenceError={sectionErrors.reference}
              websiteError={sectionErrors.website}
              mysqlError={sectionErrors.mysql}
              setSelectedSavedMysqlId={setSelectedSavedMysqlId}
              updateMysql={updateMysql}
              testMysqlConnection={testMysqlConnection}
              previewMysqlQuery={previewMysqlQuery}
              importMysqlReference={importMysqlReference}
              saveMysqlDatabase={saveMysqlDatabase}
              loadSavedMysqlDatabase={loadSavedMysqlDatabase}
              useMysqlRowInValidator={useMysqlRowInValidator}
              useStoredReferenceInValidator={useStoredReferenceInValidator}
              deleteStoredReference={deleteStoredReference}
            />
          )}
        </section>
      </section>
    </main>
  );
}


export default App;
