export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export const reportTypes = [
  { value: 'lab_result', label: 'Lab Result' },
  { value: 'radiology_report', label: 'Radiology Report' },
  { value: 'adt_admission', label: 'ADT Admission' },
  { value: 'discharge_summary', label: 'Discharge Summary' },
];

export const versions = ['2.3', '2.4', '2.5', '2.5.1'];

export const websiteExamples = [
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

export const initialMysql = {
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

export const mysqlConnectionKeys = new Set(['host', 'port', 'user', 'password', 'database']);
export const mysqlReferenceDraftResetKeys = new Set(['host', 'port', 'user', 'database', 'query']);

export const initialGenerator = {
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

export function initialTheme() {
  if (typeof window === 'undefined') return 'light';

  const savedTheme = window.localStorage.getItem('hl7-ui-theme');
  if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function initialWorkspacePanel() {
  if (typeof window === 'undefined') return 'generate';

  if (window.location.hash === '#inspector-panel') return 'validate';
  if (window.location.hash === '#sources-panel') return 'sources';
  return 'generate';
}

export const workspaceHashes = {
  generate: '#generate-panel',
  validate: '#inspector-panel',
  sources: '#sources-panel',
};
