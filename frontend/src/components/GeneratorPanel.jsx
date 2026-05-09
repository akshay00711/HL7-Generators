import React from 'react';
import {
  BookOpen,
  ClipboardCheck,
  FileCode2,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  WandSparkles,
} from 'lucide-react';

import { reportTypes, versions } from '../config';
import { Input, SectionError, SectionTitle } from './Common';

export function GeneratorPanel({
  generator,
  loading,
  updateGenerator,
  updateObservation,
  addObservation,
  removeObservation,
  generateMessage,
  saveGeneratedMessage,
  pendingGeneratedSave,
  generatedSaveName,
  setGeneratedSaveName,
  generatedMessageReady,
  viewGeneratedInValidator,
  error,
}) {
  const isObservationReport = generator.report_type === 'lab_result' || generator.report_type === 'radiology_report';

  return (
    <section className="generator-panel" id="generate-panel">
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
            <>
              <label className="save-name-field">
                Save Name
                <input
                  type="text"
                  value={generatedSaveName}
                  onChange={(event) => setGeneratedSaveName(event.target.value)}
                  placeholder="Optional custom name"
                  aria-label="Generated HL7 save name"
                />
              </label>
              <button
                className="icon-button text-button save-generate-button"
                onClick={saveGeneratedMessage}
                disabled={loading === 'generate' || loading === 'history-save'}
                title="Save generated HL7 message"
              >
                {loading === 'history-save' ? <RefreshCw className="spin" size={18} /> : <Save size={18} />}
                Save
              </button>
            </>
          )}
          {generatedMessageReady && (
            <button
              className="icon-button text-button view-validator-button"
              onClick={viewGeneratedInValidator}
              disabled={loading === 'generate'}
              title="View generated HL7 in the validator"
            >
              <ShieldCheck size={18} />
              View in Validator
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
