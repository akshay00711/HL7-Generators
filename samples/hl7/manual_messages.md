# Manual HL7 Messages For Parser And Validator Testing

Use these messages when you want to test the `Raw HL7 Message`, `Parse`, and `Validate` controls without using MySQL.

## Valid ORU R01 Lab Message

Paste this into `Raw HL7 Message`, select HL7 version `2.5.1`, then click `Parse` and `Validate`.

```text
MSH|^~\&|MANUAL-LAB|METRO-LAB|HL7-AI-WORKBENCH|CITY-HOSPITAL|20260508103000||ORU^R01|MANUAL001|P|2.5.1
PID|1||P90001^^^MRN||Rao^Anaya||19870512|F|||42 Lake Road^^Bengaluru^KA^560001||9876543210
PV1|1|O|OPD^02^01||||DR7788^Sen^Mira||||||||||||VST-MANUAL-001
ORC|RE|ORD-MANUAL-001|FIL-MANUAL-001|||||||||DR7788^Sen^Mira
OBR|1|ORD-MANUAL-001|FIL-MANUAL-001|24323-8^Basic metabolic and blood panel^LN|||20260508101500|||||||||DR7788^Sen^Mira|||||||||F
OBX|1|NM|718-7^Hemoglobin^LN||13.2|g/dL|12.0-15.5|N|||F
OBX|2|NM|4548-4^Hemoglobin A1c^LN||5.7|%|4.0-5.6|H|||F
```

## Valid ADT A01 Admission Message

Paste this into `Raw HL7 Message`, select HL7 version `2.5.1`, then click `Validate`.

```text
MSH|^~\&|ADT-FEED|CITY-HOSPITAL|HL7-AI-WORKBENCH|CITY-HOSPITAL|20260508084500||ADT^A01|MANUALADT001|P|2.5.1
EVN|A01|20260508084500
PID|1||P90002^^^MRN||Mehta^Rohan||19771103|M|||21 Garden View^^Pune^MH^411001||9000011111
PV1|1|I|WARD^305^A||||DR310^Patel^Rina||||||||||||VST-MANUAL-ADT-001
```

## Invalid ORU R01 Message

Paste this into `Raw HL7 Message`, select HL7 version `2.5.1`, then click `Validate`. The validator should report missing `OBR` and `OBX` segments.

```text
MSH|^~\&|BROKEN-SYSTEM|REMOTE-LAB|HL7-AI-WORKBENCH|CITY-HOSPITAL|20260508133000||ORU^R01|MANUALBAD001|P|2.5.1
PID|1||PX9999^^^MRN||Broken^Message||19940502|F
```
