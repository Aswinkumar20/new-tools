/** Synthetic SARIF 2.1 report (education / research). */

export function buildSarifSampleObject(): Record<string, unknown> {
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'EasyLint',
            version: '1.4.0',
            rules: [
              {
                id: 'SEC001',
                name: 'HardcodedSecret',
                shortDescription: { text: 'Possible hardcoded secret' },
                defaultConfiguration: { level: 'error' }
              },
              {
                id: 'SEC014',
                name: 'SqlInjection',
                shortDescription: { text: 'Possible SQL injection sink' },
                defaultConfiguration: { level: 'warning' }
              },
              {
                id: 'PERF002',
                name: 'InefficientLoop',
                shortDescription: { text: 'Loop can be simplified' },
                defaultConfiguration: { level: 'note' }
              }
            ]
          }
        },
        results: [
          {
            ruleId: 'SEC001',
            level: 'error',
            message: { text: 'Possible hardcoded API key' },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: 'src/auth/token.ts' },
                  region: { startLine: 42, startColumn: 8, endLine: 42, snippet: { text: "const KEY = 'sk_live_demo';" } }
                }
              }
            ]
          },
          {
            ruleId: 'SEC001',
            level: 'error',
            message: { text: 'Hardcoded token in config' },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: 'src/config.ts' },
                  region: { startLine: 18, startColumn: 3, endLine: 18 }
                }
              }
            ]
          },
          {
            ruleId: 'SEC014',
            level: 'warning',
            message: { text: 'User input concatenated into SQL' },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: 'src/db.ts' },
                  region: { startLine: 91, startColumn: 12, endLine: 91, snippet: { text: 'query("SELECT * FROM users WHERE id=" + id)' } }
                }
              }
            ]
          },
          {
            ruleId: 'SEC014',
            level: 'warning',
            message: { text: 'Unparameterized delete statement' },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: 'src/db.ts' },
                  region: { startLine: 140, startColumn: 5, endLine: 140 }
                }
              }
            ]
          },
          {
            ruleId: 'PERF002',
            level: 'note',
            message: { text: 'Nested loop can use a Map lookup' },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: 'src/util.ts' },
                  region: { startLine: 7, startColumn: 1, endLine: 14 }
                }
              }
            ]
          }
        ]
      }
    ]
  };
}

export const SARIF_JSON_SAMPLE = JSON.stringify(buildSarifSampleObject(), null, 2);

export const SARIF_CSV_SAMPLE = `ruleId,level,file,line,message
SEC001,error,src/auth/token.ts,42,Possible hardcoded API key
SEC014,warning,src/db.ts,91,User input concatenated into SQL
PERF002,note,src/util.ts,7,Nested loop can use a Map lookup
`;
