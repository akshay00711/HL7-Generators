import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileCode2,
  Globe2,
  History,
  Moon,
  Plus,
  RefreshCw,
  Save,
  Send,
  Server,
  ShieldCheck,
  Sun,
  TableProperties,
  Trash2,
  WandSparkles,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const reportTypes = [
  { value: 'lab_result', label: 'Lab Result' },
  { value: 'radiology_report', label: 'Radiology Report' },
  { value: 'adt_admission', label: 'ADT Admission' },
  { value: 'discharge_summary', label: 'Discharge Summary' },
];

const versions = ['2.3', '2.4', '2.5', '2.5.1'];

const websiteExamples = [
  {
    label: 'Local Sample HL7 Reference',
    url: 'http://127.0.0.1:5173/sample-hl7-reference.html',
    name: 'Local Sample HL7 Reference Profile',
  },
  {
    label: 'HL7 v2.5.1 Observation Reporting',
    url: 'https://www.hl7.eu/HL7v2x/v251/std251/ch07.html',
    name: 'HL7 v2.5.1 Observation Reporting',
  },
];

const initialMysql = {
  connection_name: '',
  host: '127.0.0.1',
  port: '3306',
  user: 'root',
  password: '',
  save_password: false,
  database: '',
  query: 'SELECT name, content FROM hl7_references LIMIT 1',
  name_column: 'name',
  custom_name: '',
  content_column: 'content',
};

const mysqlConnectionKeys = new Set(['host', 'port', 'user', 'password', 'database']);
const mysqlReferenceDraftResetKeys = new Set(['host', 'port', 'user', 'database', 'query']);

const initialGenerator = {
  hl7_version: '2.5.1',
  report_type: 'lab_result',
  sending_application: 'HL7-AI-WORKBENCH',
  sending_facility: 'SEMICOLON-LAB',
  receiving_application: 'EHR',
  receiving_facility: 'CITY-HOSPITAL',
  visit_number: 'VST-20260508-001',
  order_id: 'ORD-90001',
  filler_order_id: 'FIL-44501',
  diagnosis_code: 'R53.83',
  diagnosis_text: 'Other fatigue',
  study_description: 'Chest X-ray',
  notes: 'Generated for HL7 troubleshooting and validation.',
  reference_id: null,
  save_to_history: false,
  patient: {
    patient_id: 'P100045',
    first_name: 'Anaya',
    last_name: 'Rao',
    date_of_birth: '19870512',
    sex: 'F',
    address: '42 Lake Road^^Bengaluru^KA^560001',
    phone: '9876543210',
  },
  provider: {
    provider_id: 'DR7788',
    first_name: 'Mira',
    last_name: 'Sen',
  },
  observations: [
    {
      identifier: '718-7',
      name: 'Hemoglobin',
      value: '13.2',
      unit: 'g/dL',
      reference_range: '12.0-15.5',
      abnormal_flag: 'N',
      value_type: 'NM',
      result_status: 'F',
    },
    {
      identifier: '4548-4',
      name: 'Hemoglobin A1c',
      value: '5.7',
      unit: '%',
      reference_range: '4.0-5.6',
      abnormal_flag: 'H',
      value_type: 'NM',
      result_status: 'F',
    },
  ],
};

const sampleMessage =
  'MSH|^~\\&|EXT-LAB|METRO-LAB|EHR|CITY-HOSPITAL|20260508103000||ORU^R01|EXT9981|P|2.5.1\\r' +
  'PID|1||P88902^^^MRN||Kapoor^Ishaan||19910217|M|||15 Palm Street^^Mumbai^MH^400001||9123456789\\r' +
  'PV1|1|O|OPD^02^01||||DR211^Mehta^Kavya||||||||||||VST-EXT-884\\r' +
  'ORC|RE|ORD-EXT-781|FIL-EXT-441|||||||||DR211^Mehta^Kavya\\r' +
  'OBR|1|ORD-EXT-781|FIL-EXT-441|24323-8^Basic metabolic and blood panel^LN|||20260508101500|||||||||DR211^Mehta^Kavya|||||||||F\\r' +
  'OBX|1|NM|2951-2^Sodium^LN||141|mmol/L|135-145|N|||F\\r';

function initialTheme() {
  if (typeof window === 'undefined') return 'light';

  const savedTheme = window.localStorage.getItem('hl7-ui-theme');
  if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function App() {
  const [theme, setTheme] = useState(initialTheme);
  const [generator, setGenerator] = useState(initialGenerator);
  const [rawMessage, setRawMessage] = useState(sampleMessage.replaceAll('\\r', '\r'));
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
    clearSectionError('history');
    try {
      const historyItem = await callApi('/api/history', {
        message: pendingGeneratedSave.message,
        report_type: pendingGeneratedSave.report_type,
        hl7_version: pendingGeneratedSave.hl7_version,
        reference_id: pendingGeneratedSave.reference_id,
      });
      setHistory((current) => [historyItem, ...current.filter((item) => item.id !== historyItem.id)].slice(0, 12));
      setPendingGeneratedSave(null);
      clearSectionError('history');
    } catch (apiError) {
      setSectionError('history', apiError);
    } finally {
      setLoading('');
    }
  }

  async function deleteHistoryMessage(item) {
    if (!item) return;
    if (!window.confirm(`Remove saved generated HL7 "${item.message_control_id || `#${item.id}`}"?`)) return;

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
    clearSectionError(errorSection);
    clearSectionError('inspector');

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

      <section className="overview-strip" aria-label="Workflow overview">
        <StatusTile icon={<ClipboardCheck size={19} />} label="Configure" value={generator.report_type} />
        <StatusTile icon={<Database size={19} />} label="Reference" value={selectedReference?.source_type || 'none'} />
        <StatusTile icon={<FileCode2 size={19} />} label="Segments" value={parsed?.segment_count || rawMessage.split('\r').filter(Boolean).length} />
        <StatusTile icon={<ShieldCheck size={19} />} label="Validation" value={validation ? (validation.valid ? 'valid' : 'review') : 'pending'} />
      </section>

      <section className="workspace-grid">
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
          error={sectionErrors.generator}
        />

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

        <section className="inspector-panel">
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
      </section>
    </main>
  );
}

function GeneratorPanel({
  generator,
  loading,
  updateGenerator,
  updateObservation,
  addObservation,
  removeObservation,
  generateMessage,
  saveGeneratedMessage,
  pendingGeneratedSave,
  error,
}) {
  const isObservationReport = generator.report_type === 'lab_result' || generator.report_type === 'radiology_report';

  return (
    <section className="generator-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Configurable inputs</p>
          <h2>Generate HL7</h2>
        </div>
        <div className="action-row generator-actions">
          <button className="icon-button strong generate-button" onClick={generateMessage} disabled={loading === 'generate' || loading === 'history-save'} title="Generate HL7 message">
            {loading === 'generate' ? <RefreshCw className="spin" size={18} /> : <WandSparkles size={18} />}
            Generate
          </button>
          {pendingGeneratedSave && (
            <button
              className="icon-button text-button save-generate-button"
              onClick={saveGeneratedMessage}
              disabled={loading === 'generate' || loading === 'history-save'}
              title="Save generated HL7 message"
            >
              {loading === 'history-save' ? <RefreshCw className="spin" size={18} /> : <Save size={18} />}
              Save
            </button>
          )}
        </div>
      </div>

      {error && <SectionError message={error} />}

      <section className="form-section section-message">
        <SectionTitle icon={<ClipboardCheck size={17} />} label="Message Setup" compact />
        <div className="form-grid two">
          <label>
            HL7 Version
            <select value={generator.hl7_version} onChange={(event) => updateGenerator(['hl7_version'], event.target.value)}>
              {versions.map((version) => (
                <option key={version} value={version}>
                  {version}
                </option>
              ))}
            </select>
          </label>
          <label>
            Report Type
            <select value={generator.report_type} onChange={(event) => updateGenerator(['report_type'], event.target.value)}>
              {reportTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="subsection-label">Routing</div>
        <div className="form-grid two">
          <Input label="Sending App" value={generator.sending_application} onChange={(value) => updateGenerator(['sending_application'], value)} />
          <Input label="Sending Facility" value={generator.sending_facility} onChange={(value) => updateGenerator(['sending_facility'], value)} />
          <Input label="Receiving App" value={generator.receiving_application} onChange={(value) => updateGenerator(['receiving_application'], value)} />
          <Input label="Receiving Facility" value={generator.receiving_facility} onChange={(value) => updateGenerator(['receiving_facility'], value)} />
        </div>
      </section>

      <section className="form-section section-patient">
        <SectionTitle icon={<Send size={17} />} label="Patient" compact />
        <div className="form-grid two">
          <Input label="Patient ID" value={generator.patient.patient_id} onChange={(value) => updateGenerator(['patient', 'patient_id'], value)} />
          <Input label="Date of Birth" value={generator.patient.date_of_birth} onChange={(value) => updateGenerator(['patient', 'date_of_birth'], value)} />
          <Input label="First Name" value={generator.patient.first_name} onChange={(value) => updateGenerator(['patient', 'first_name'], value)} />
          <Input label="Last Name" value={generator.patient.last_name} onChange={(value) => updateGenerator(['patient', 'last_name'], value)} />
          <label>
            Sex
            <select value={generator.patient.sex} onChange={(event) => updateGenerator(['patient', 'sex'], event.target.value)}>
              <option value="F">F</option>
              <option value="M">M</option>
              <option value="O">O</option>
              <option value="U">U</option>
            </select>
          </label>
          <Input label="Phone" value={generator.patient.phone} onChange={(value) => updateGenerator(['patient', 'phone'], value)} />
        </div>
        <div className="form-grid two">
          <Input label="Address" value={generator.patient.address} onChange={(value) => updateGenerator(['patient', 'address'], value)} />
        </div>
      </section>

      <section className="form-section section-clinical">
        <SectionTitle icon={<ShieldCheck size={17} />} label="Provider and Visit" compact />
        <div className="form-grid two">
          <Input label="Provider ID" value={generator.provider.provider_id} onChange={(value) => updateGenerator(['provider', 'provider_id'], value)} />
          <Input label="Visit Number" value={generator.visit_number} onChange={(value) => updateGenerator(['visit_number'], value)} />
          <Input label="Provider First" value={generator.provider.first_name} onChange={(value) => updateGenerator(['provider', 'first_name'], value)} />
          <Input label="Provider Last" value={generator.provider.last_name} onChange={(value) => updateGenerator(['provider', 'last_name'], value)} />
        </div>

        {isObservationReport ? (
          <>
            <div className="section-title with-action compact">
              <div>
                <FileCode2 size={17} />
                <span>Observations</span>
              </div>
              <button className="icon-only" onClick={addObservation} title="Add observation">
                <Plus size={18} />
              </button>
            </div>
            <div className="observation-list">
              {generator.observations.map((observation, index) => (
                <div className="observation-row" key={`${observation.identifier}-${index}`}>
                  <div className="form-grid observation-grid">
                    <Input label="Code" value={observation.identifier} onChange={(value) => updateObservation(index, 'identifier', value)} />
                    <Input label="Name" value={observation.name} onChange={(value) => updateObservation(index, 'name', value)} />
                    <Input label="Value" value={observation.value} onChange={(value) => updateObservation(index, 'value', value)} />
                    <Input label="Unit" value={observation.unit} onChange={(value) => updateObservation(index, 'unit', value)} />
                    <Input label="Range" value={observation.reference_range} onChange={(value) => updateObservation(index, 'reference_range', value)} />
                    <Input label="Flag" value={observation.abnormal_flag} onChange={(value) => updateObservation(index, 'abnormal_flag', value)} />
                  </div>
                  <button className="icon-only danger" onClick={() => removeObservation(index)} title="Remove observation">
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="subsection-label">Discharge Details</div>
            <div className="form-grid two">
              <Input label="Diagnosis Code" value={generator.diagnosis_code} onChange={(value) => updateGenerator(['diagnosis_code'], value)} />
              <Input label="Diagnosis Text" value={generator.diagnosis_text} onChange={(value) => updateGenerator(['diagnosis_text'], value)} />
            </div>
          </>
        )}
      </section>

      <section className="form-section section-notes">
        <SectionTitle icon={<BookOpen size={17} />} label="Notes" compact />
        <div className="form-grid two">
          <Input label="NTE Comment" value={generator.notes} onChange={(value) => updateGenerator(['notes'], value)} />
        </div>
      </section>
    </section>
  );
}

function ReferencePanel({
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
    <section className="reference-workbench-panel">
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
              <button className="icon-button text-button" onClick={previewMysqlQuery} disabled={loading === 'mysql-preview'} title="Run MySQL query">
                {loading === 'mysql-preview' ? <RefreshCw className="spin" size={17} /> : <TableProperties size={17} />}
                Run Query
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

function HistoryStrip({ history, loading, refreshHistory, loadHistoryMessage, deleteHistoryMessage, error }) {
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
                <span>{item.message_control_id || `#${item.id}`}</span>
                <strong>{labelize(item.report_type)}</strong>
                <small>{item.reference_name || item.hl7_version}</small>
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

function OutputPanel({ activeTab, parsed, validation }) {
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

function StatusTile({ icon, label, value }) {
  return (
    <div className="status-tile">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{String(value).replaceAll('_', ' ')}</strong>
    </div>
  );
}

function SectionTitle({ icon, label, compact = false }) {
  return (
    <div className={`section-title ${compact ? 'compact' : ''}`}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function Input({ label, value, onChange }) {
  return (
    <label>
      {label}
      <input type="text" value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div className="empty-state">
      {icon}
      <span>{text}</span>
    </div>
  );
}

function SectionError({ message }) {
  return (
    <div className="section-error">
      <AlertTriangle size={17} />
      <span>{message}</span>
    </div>
  );
}

function labelize(value) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function historyOptionLabel(item) {
  return [
    item.message_control_id || `History #${item.id}`,
    labelize(item.report_type),
    `HL7 ${item.hl7_version}`,
    item.reference_name || '',
  ]
    .filter(Boolean)
    .join(' | ');
}

function mysqlConnectionPayload(mysql) {
  return {
    host: mysql.host,
    port: Number(mysql.port),
    user: mysql.user,
    password: mysql.password,
    database: mysql.database,
  };
}

function mysqlPresetLabel(database) {
  return [database.name, `${database.user}@${database.host}:${database.port}`, database.database].filter(Boolean).join(' | ');
}

function isImportedReference(reference) {
  return ['website', 'mysql'].includes(reference?.source_type);
}

function mysqlConnectionSignature(mysql) {
  return [mysql.host, mysql.port, mysql.user, mysql.password, mysql.database].map((value) => String(value ?? '').trim()).join('|');
}

function mysqlRequiredDetailsPresent(mysql) {
  const port = Number(mysql.port);
  return (
    [mysql.host, mysql.port, mysql.user, mysql.database, mysql.query, mysql.content_column].every((value) => String(value ?? '').trim()) &&
    Number.isInteger(port) &&
    port >= 1 &&
    port <= 65535
  );
}

function mysqlSaveDatabaseHint(mysql, canSave, currentSignature, successfulSignature) {
  if (canSave) {
    return mysql.save_password ? 'Ready to save. Password will be stored locally.' : 'Ready to save. Password will not be saved.';
  }

  const missingFields = [];
  if (!mysql.host.trim()) missingFields.push('Host');
  if (!mysql.port.trim()) missingFields.push('Port');
  if (!mysql.user.trim()) missingFields.push('User');
  if (!mysql.database.trim()) missingFields.push('Database');
  if (!mysql.query.trim()) missingFields.push('SELECT Query');
  if (!mysql.content_column.trim()) missingFields.push('Content Column');

  if (missingFields.length) return `Fill ${missingFields.join(', ')} before saving.`;

  const port = Number(mysql.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return 'Enter a valid MySQL port from 1 to 65535 before saving.';

  if (!successfulSignature || currentSignature !== successfulSignature) return 'Click Test successfully for the current database details before saving.';

  return 'Complete the database details and click Test before saving.';
}

async function responseErrorMessage(response) {
  const text = await response.text();
  if (!text) return `Request failed with ${response.status}`;
  return errorMessage(text);
}

function errorMessage(value) {
  const message = typeof value === 'string' ? value : value?.message || 'Something went wrong.';
  try {
    const parsed = JSON.parse(message);
    if (typeof parsed.detail === 'string') return parsed.detail;
    if (parsed.detail) return JSON.stringify(parsed.detail);
  } catch {
    return message;
  }
  return message;
}

function extractHl7CandidateFromMysqlRow(row, contentColumn) {
  const preferredValue = row?.[contentColumn];
  if (looksLikeHl7(preferredValue)) {
    return { content: String(preferredValue), column: contentColumn };
  }

  const fallbackEntry = Object.entries(row || {}).find(([, value]) => looksLikeHl7(value));
  if (!fallbackEntry) {
    return { content: '', column: '' };
  }
  return { content: String(fallbackEntry[1]), column: fallbackEntry[0] };
}

function mysqlReferenceNameFromRow(row, mysql, rowIndex) {
  const customName = mysql.custom_name.trim();
  if (customName) return customName;

  const nameColumn = mysql.name_column.trim();
  const rowName = nameColumn ? String(row?.[nameColumn] ?? '').trim() : '';
  return rowName || `MySQL HL7 row ${rowIndex + 1}`;
}

function looksLikeHl7(value) {
  if (value == null) return false;
  return normalizeExternalHl7(String(value)).trimStart().startsWith('MSH|');
}

function normalizeExternalHl7(value) {
  return String(value)
    .replaceAll('\\r\\n', '\r')
    .replaceAll('\\r', '\r')
    .replaceAll('\\n', '\n');
}

export default App;
