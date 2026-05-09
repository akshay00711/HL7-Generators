-- HL7 AI Workbench sample MySQL data.
-- Run this in MySQL Workbench to create repeatable data for testing every app block.
-- It resets only the sample tables inside the hl7_reference_lab database.

CREATE DATABASE IF NOT EXISTS hl7_reference_lab;
USE hl7_reference_lab;

DROP TABLE IF EXISTS external_hl7_messages;
DROP TABLE IF EXISTS order_reports_detail;
DROP TABLE IF EXISTS hl7_references;

CREATE TABLE hl7_references (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  report_type VARCHAR(80) NOT NULL,
  hl7_version VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_reports_detail (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  report_name VARCHAR(255) NOT NULL,
  patient_id VARCHAR(80) NOT NULL,
  patient_name VARCHAR(160) NOT NULL,
  report_category VARCHAR(80) NOT NULL,
  hl7_version VARCHAR(20) NOT NULL,
  source_system VARCHAR(80) NOT NULL,
  status VARCHAR(40) NOT NULL,
  hl7_message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE external_hl7_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_system VARCHAR(80) NOT NULL,
  custom_label VARCHAR(255) NOT NULL,
  message_type VARCHAR(40) NOT NULL,
  expected_validation VARCHAR(20) NOT NULL,
  payload TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO hl7_references (name, report_type, hl7_version, content)
VALUES
(
  'Sample ORU R01 Lab Reference',
  'lab_result',
  '2.5.1',
  'ORU R01 lab result messages should include MSH, PID, PV1, ORC, OBR, and OBX. OBX-3 identifies the test, OBX-5 carries the result value, OBX-6 carries units, OBX-7 carries reference range, OBX-8 carries abnormal flag, and OBX-11 carries final/preliminary status.'
),
(
  'Sample ADT Visit Reference',
  'adt_admission',
  '2.5.1',
  'ADT visit messages should include MSH, EVN, PID, and PV1. ADT A01 represents admission or registration. ADT A03 represents discharge. PV1-2 carries patient class and PV1-19 carries the visit number.'
),
(
  'Sample Radiology Reference',
  'radiology_report',
  '2.5.1',
  'Radiology ORU R01 messages use OBR for the ordered study and OBX text fields for impression, findings, or report narrative. The report should preserve patient, provider, order, and result status context.'
);

INSERT INTO order_reports_detail (
  type,
  report_name,
  patient_id,
  patient_name,
  report_category,
  hl7_version,
  source_system,
  status,
  hl7_message
)
VALUES
(
  'HL72.3',
  'Sample HL7 2.3 Lab Report',
  'P23001',
  'Nisha Sharma',
  'lab_result',
  '2.3',
  'EXT-LAB',
  'final',
  'MSH|^~\\&|EXT-LAB|METRO-LAB|HL7-AI-WORKBENCH|CITY-HOSPITAL|20260508103000||ORU^R01|MYSQL23001|P|2.3\rPID|1||P23001^^^MRN||Sharma^Nisha||19820214|F|||88 Sample Street^^Jaipur^RJ^302001||9876500001\rPV1|1|O|OPD^05^01||||DR101^Iyer^Amit||||||||||||VST23001\rORC|RE|ORD23001|FIL23001|||||||||DR101^Iyer^Amit\rOBR|1|ORD23001|FIL23001|24323-8^Basic metabolic and blood panel^LN|||20260508101500|||||||||DR101^Iyer^Amit|||||||||F\rOBX|1|NM|718-7^Hemoglobin^LN||13.2|g/dL|12.0-15.5|N|||F\rOBX|2|NM|4548-4^Hemoglobin A1c^LN||5.8|%|4.0-5.6|H|||F'
),
(
  'HL72.5.1',
  'Sample HL7 2.5.1 Chemistry Report',
  'P25101',
  'Anaya Rao',
  'lab_result',
  '2.5.1',
  'EXT-LAB',
  'final',
  'MSH|^~\\&|EXT-LAB|METRO-LAB|HL7-AI-WORKBENCH|CITY-HOSPITAL|20260508113000||ORU^R01|MYSQL25101|P|2.5.1\rPID|1||P25101^^^MRN||Rao^Anaya||19870512|F|||42 Lake Road^^Bengaluru^KA^560001||9876543210\rPV1|1|O|OPD^02^01||||DR7788^Sen^Mira||||||||||||VST25101\rORC|RE|ORD25101|FIL25101|||||||||DR7788^Sen^Mira\rOBR|1|ORD25101|FIL25101|24323-8^Basic metabolic and blood panel^LN|||20260508111500|||||||||DR7788^Sen^Mira|||||||||F\rOBX|1|NM|2951-2^Sodium^LN||141|mmol/L|135-145|N|||F\rOBX|2|NM|2823-3^Potassium^LN||4.5|mmol/L|3.5-5.1|N|||F'
),
(
  'RAD251',
  'Sample Chest X-ray Report',
  'P25102',
  'Ishaan Kapoor',
  'radiology_report',
  '2.5.1',
  'RAD-PACS',
  'final',
  'MSH|^~\\&|RAD-PACS|METRO-RAD|HL7-AI-WORKBENCH|CITY-HOSPITAL|20260508123000||ORU^R01|RAD25102|P|2.5.1\rPID|1||P25102^^^MRN||Kapoor^Ishaan||19910217|M|||15 Palm Street^^Mumbai^MH^400001||9123456789\rPV1|1|O|RAD^01^01||||DR211^Mehta^Kavya||||||||||||VSTRAD25102\rORC|RE|ORDRAD25102|FILRAD25102|||||||||DR211^Mehta^Kavya\rOBR|1|ORDRAD25102|FILRAD25102|36643-5^Chest X-ray report^LN|||20260508120500|||||||||DR211^Mehta^Kavya|||||||||F\rOBX|1|TX|18782-3^Radiology Study observation^LN||No focal infiltrate. Cardiomediastinal silhouette is not enlarged.||||||F'
),
(
  'ADT251',
  'Sample ADT Admission',
  'P25103',
  'Rohan Mehta',
  'adt_admission',
  '2.5.1',
  'ADT-FEED',
  'registered',
  'MSH|^~\\&|ADT-FEED|CITY-HOSPITAL|HL7-AI-WORKBENCH|CITY-HOSPITAL|20260508084500||ADT^A01|ADT25103|P|2.5.1\rEVN|A01|20260508084500\rPID|1||P25103^^^MRN||Mehta^Rohan||19771103|M|||21 Garden View^^Pune^MH^411001||9000011111\rPV1|1|I|WARD^305^A||||DR310^Patel^Rina||||||||||||VSTADT25103'
),
(
  'ADT251',
  'Sample ADT Discharge',
  'P25104',
  'Farah Khan',
  'discharge_summary',
  '2.5.1',
  'ADT-FEED',
  'discharged',
  'MSH|^~\\&|ADT-FEED|CITY-HOSPITAL|HL7-AI-WORKBENCH|CITY-HOSPITAL|20260508164500||ADT^A03|ADT25104|P|2.5.1\rEVN|A03|20260508164500\rPID|1||P25104^^^MRN||Khan^Farah||19690921|F|||9 Central Avenue^^Delhi^DL^110001||9000022222\rPV1|1|I|WARD^402^B||||DR410^Roy^Dev||||||||||||VSTADT25104'
);

INSERT INTO external_hl7_messages (source_system, custom_label, message_type, expected_validation, payload)
VALUES
(
  'THIRD-PARTY-LAB',
  'Third-party valid ORU payload',
  'ORU_R01',
  'valid',
  'MSH|^~\\&|THIRD-PARTY-LAB|REMOTE-LAB|HL7-AI-WORKBENCH|CITY-HOSPITAL|20260508133000||ORU^R01|EXTVALID001|P|2.5.1\rPID|1||PX9001^^^MRN||Das^Mira||19940502|F|||10 Test Lane^^Kolkata^WB^700001||9333300001\rPV1|1|O|OPD^11^01||||DR720^Gupta^Naveen||||||||||||VSTEXT9001\rORC|RE|ORDEXT9001|FILEXT9001|||||||||DR720^Gupta^Naveen\rOBR|1|ORDEXT9001|FILEXT9001|58410-2^CBC panel^LN|||20260508130000|||||||||DR720^Gupta^Naveen|||||||||F\rOBX|1|NM|789-8^Erythrocytes^LN||4.8|10*6/uL|4.2-5.4|N|||F'
),
(
  'BROKEN-SYSTEM',
  'Invalid ORU missing OBR and OBX',
  'ORU_R01',
  'invalid',
  'MSH|^~\\&|BROKEN-SYSTEM|REMOTE-LAB|HL7-AI-WORKBENCH|CITY-HOSPITAL|20260508133000||ORU^R01|EXTBAD001|P|2.5.1\rPID|1||PX9999^^^MRN||Broken^Message||19940502|F'
);
