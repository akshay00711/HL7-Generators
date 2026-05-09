# HL7 AI Workbench Workflow Diagram

This diagram shows how generated HL7, stored references, website imports, MySQL imports, validation, and saved items work together.

## Main Flow

```mermaid
flowchart TD
  A["Start HL7 AI Workbench"] --> B{"Choose task tab"}

  B --> C["Generate"]
  C --> C1["Configure version, report type, patient, provider, observations"]
  C1 --> C2["Click Generate"]
  C2 --> C3["Generated HL7 is available for Validator"]
  C3 --> C4{"Click Save?"}
  C4 -->|Yes| C5["Saved Generated HL7 history"]
  C4 -->|No| C6["Keep as unsaved working message"]
  C5 --> V
  C6 --> V

  B --> R["Sources"]
  R --> R1["Stored References"]
  R --> R2["Website Import"]
  R --> R3["MySQL Workbench Database"]

  R1 --> R1A["Select reference"]
  R1A --> R1B{"Reference content is HL7?"}
  R1B -->|Yes| V["Validator"]
  R1B -->|No| GREF["Use as generation context"]

  R2 --> R2A["Enter URL and optional name"]
  R2A --> R2B["Click Import"]
  R2B --> R1

  R3 --> R3A["Enter connection details"]
  R3A --> R3B["Click Test"]
  R3B --> R3C["Write SELECT query"]
  R3C --> R3D["Click Run Query"]
  R3D --> R3E{"HL7 row found?"}
  R3E -->|Use in Validator| V
  R3E -->|Import| R1
  R3B --> R3F{"Click Save DB?"}
  R3F -->|Yes| R3G["Saved database preset"]
  R3F -->|No| R3C

  B --> V
  V --> V1["Raw HL7 Message"]
  V1 --> V2["Parse"]
  V1 --> V3["Validate"]
  V2 --> V4["Readable segments and fields"]
  V3 --> V5["Errors, warnings, and info"]
```

## Reference Flow

```mermaid
flowchart LR
  W["Website page"] --> WI["Website Import"]
  M["MySQL query row"] --> MI["MySQL Import"]
  D["Default profiles"] --> SR["Stored References"]
  WI --> SR
  MI --> SR
  SR --> GEN["Generate with reference note"]
  SR --> UV["Use in Validator when content is an HL7 message"]
```

## What Each Save Does

| Action | What It Saves | Where It Appears Later |
| --- | --- | --- |
| `Save` after `Generate` | The generated HL7 message | `Saved Generated HL7` in the Validator tab |
| `Import` in Website Import | Website text as a reusable reference | `Stored References` |
| `Import` in MySQL | Query result content as a reusable reference | `Stored References` |
| `Save DB` | MySQL host, user, database, query, columns, and optional password | `Saved Database` dropdown |

## Validator Behavior

The Validator starts empty by default. HL7 content appears there only after one of these actions:

- Click `Generate` to create a new HL7 message.
- Click `Use in Validator` on a stored HL7 reference or MySQL query row.
- Click `Load to Validator` for a saved generated HL7 message.
- Paste or type HL7 manually into `Raw HL7 Message`.

After content is loaded, click `Parse` for a readable view or `Validate` for structural checks.

