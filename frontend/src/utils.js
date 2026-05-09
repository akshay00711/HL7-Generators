export function labelize(value) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function historyOptionLabel(item) {
  return [
    historyDisplayName(item),
    labelize(item.report_type),
    `HL7 ${item.hl7_version}`,
    item.reference_name || '',
  ]
    .filter(Boolean)
    .join(' | ');
}

export function historyDisplayName(item) {
  return item.custom_name || item.message_control_id || `History #${item.id}`;
}

export function historyDetailLabel(item) {
  if (item.custom_name && item.message_control_id) {
    return item.message_control_id;
  }
  return item.reference_name || `HL7 ${item.hl7_version}`;
}

export function mysqlConnectionPayload(mysql) {
  return {
    host: mysql.host,
    port: Number(mysql.port),
    user: mysql.user,
    password: mysql.password,
    database: mysql.database,
  };
}

export function mysqlPresetLabel(database) {
  return [database.name, `${database.user}@${database.host}:${database.port}`, database.database].filter(Boolean).join(' | ');
}

export function isImportedReference(reference) {
  return ['website', 'mysql'].includes(reference?.source_type);
}

export function mysqlConnectionSignature(mysql) {
  return [mysql.host, mysql.port, mysql.user, mysql.password, mysql.database].map((value) => String(value ?? '').trim()).join('|');
}

export function mysqlRequiredDetailsPresent(mysql) {
  const port = Number(mysql.port);
  return (
    [mysql.host, mysql.port, mysql.user, mysql.database, mysql.query, mysql.content_column].every((value) => String(value ?? '').trim()) &&
    Number.isInteger(port) &&
    port >= 1 &&
    port <= 65535
  );
}

export function mysqlSaveDatabaseHint(mysql, canSave, currentSignature, successfulSignature) {
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

export async function responseErrorMessage(response) {
  const text = await response.text();
  if (!text) return `Request failed with ${response.status}`;
  return errorMessage(text);
}

export function errorMessage(value) {
  if (value instanceof Error) {
    return errorMessage(value.message);
  }

  if (Array.isArray(value)) {
    return formatValidationErrors(value);
  }

  if (value && typeof value === 'object') {
    if (value.detail) return errorMessage(value.detail);
    if (value.message) return errorMessage(value.message);
    return 'Something went wrong. Please check the details and try again.';
  }

  const message = typeof value === 'string' ? value : 'Something went wrong.';
  try {
    const parsed = JSON.parse(message);
    return errorMessage(parsed);
  } catch {
    return message;
  }
}

function formatValidationErrors(errors) {
  if (!errors.length) {
    return 'Please check the form fields and try again.';
  }

  const fieldMessages = errors.map(validationIssueMessage).filter(Boolean);
  const uniqueMessages = [...new Set(fieldMessages)];

  if (!uniqueMessages.length) {
    return 'Please check the highlighted fields and try again.';
  }

  return `Please fix these fields before continuing: ${uniqueMessages.join('; ')}.`;
}

function validationIssueMessage(issue) {
  const pathParts = Array.isArray(issue?.loc)
    ? issue.loc.map((part) => String(part)).filter((part) => part !== 'body')
    : [];
  const pathKey = pathParts.join('.');
  const fieldName = validationFieldLabel(pathParts);

  if (validationFieldHints[pathKey]) {
    return validationFieldHints[pathKey];
  }

  if (issue?.type === 'missing') {
    return `${fieldName} is required`;
  }

  if (issue?.type === 'string_too_short') {
    const minimumLength = Number(issue?.ctx?.min_length);
    if (minimumLength === 1) return `${fieldName} is required`;
    if (minimumLength > 1) return `${fieldName} must be at least ${minimumLength} characters`;
  }

  return `${fieldName}: ${issue?.msg || 'invalid value'}`;
}

function validationFieldLabel(pathParts) {
  const pathKey = pathParts.join('.');
  if (validationFieldLabels[pathKey]) return validationFieldLabels[pathKey];

  if (pathParts[0] === 'observations') {
    const rowNumber = Number(pathParts[1]);
    const numberLabel = Number.isInteger(rowNumber) ? ` ${rowNumber + 1}` : '';
    const fieldKey = `observations.${pathParts[pathParts.length - 1]}`;
    const fieldName = validationFieldLabels[fieldKey] || labelize(pathParts[pathParts.length - 1] || 'field');
    return `Observation${numberLabel} ${fieldName}`;
  }

  const lastPart = pathParts[pathParts.length - 1] || 'field';
  return validationFieldLabels[lastPart] || labelize(lastPart);
}

const validationFieldLabels = {
  'patient.patient_id': 'Patient ID',
  'patient.first_name': 'Patient First Name',
  'patient.last_name': 'Patient Last Name',
  'patient.date_of_birth': 'Date of Birth',
  'patient.sex': 'Patient Sex',
  'provider.provider_id': 'Provider ID',
  'provider.first_name': 'Provider First Name',
  'provider.last_name': 'Provider Last Name',
  'provider.npi': 'Provider NPI',
  'message': 'HL7 Message',
  'query': 'SELECT Query',
  'content_column': 'Content Column',
  'name_column': 'Name Column',
  'custom_name': 'Custom Name',
  'connection.host': 'Host',
  'connection.port': 'Port',
  'connection.user': 'User',
  'connection.password': 'Password',
  'connection.database': 'Database',
  'observations.identifier': 'Identifier',
  'observations.text': 'Text',
  'observations.value': 'Value',
  'observations.units': 'Units',
  'observations.reference_range': 'Reference Range',
  'observations.status': 'Status',
};

const validationFieldHints = {
  'patient.date_of_birth': 'Date of Birth must be 8 characters in YYYYMMDD format',
};

export function extractHl7CandidateFromMysqlRow(row, contentColumn) {
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

export function mysqlReferenceNameFromRow(row, mysql, rowIndex) {
  const customName = mysql.custom_name.trim();
  if (customName) return customName;

  const nameColumn = mysql.name_column.trim();
  const rowName = nameColumn ? String(row?.[nameColumn] ?? '').trim() : '';
  return rowName || `MySQL HL7 row ${rowIndex + 1}`;
}

export function looksLikeHl7(value) {
  if (value == null) return false;
  return normalizeExternalHl7(String(value)).trimStart().startsWith('MSH|');
}

export function normalizeExternalHl7(value) {
  return String(value)
    .replaceAll('\\r\\n', '\r')
    .replaceAll('\\r', '\r')
    .replaceAll('\\n', '\n');
}
