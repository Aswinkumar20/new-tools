/** Synthetic DMN 1.3 loan-approval model (education / research). */

export const DMN_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
  id="Definitions_Loan" name="Loan approval" namespace="https://easytoolhub.local/dmn">
  <decision id="Decision_Score" name="Credit score band">
    <informationRequirement id="IR_Score_Fico">
      <requiredInput href="#Input_Fico"/>
    </informationRequirement>
    <decisionTable id="DT_Score" hitPolicy="UNIQUE">
      <input id="In_Fico" label="FICO">
        <inputExpression typeRef="number"><text>fico</text></inputExpression>
      </input>
      <output id="Out_Band" label="Band" typeRef="string"/>
      <rule id="Rule_Score_1">
        <inputEntry id="IE_S1"><text>&gt;= 740</text></inputEntry>
        <outputEntry id="OE_S1"><text>"Excellent"</text></outputEntry>
      </rule>
      <rule id="Rule_Score_2">
        <inputEntry id="IE_S2"><text>[670..739]</text></inputEntry>
        <outputEntry id="OE_S2"><text>"Good"</text></outputEntry>
      </rule>
      <rule id="Rule_Score_3">
        <inputEntry id="IE_S3"><text>&lt; 670</text></inputEntry>
        <outputEntry id="OE_S3"><text>"Fair"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
  <decision id="Decision_Eligibility" name="Eligibility">
    <informationRequirement id="IR_Elig_Score">
      <requiredDecision href="#Decision_Score"/>
    </informationRequirement>
    <informationRequirement id="IR_Elig_Amount">
      <requiredInput href="#Input_Amount"/>
    </informationRequirement>
    <authorityRequirement id="AR_Elig_Policy">
      <requiredAuthority href="#KS_Policy"/>
    </authorityRequirement>
    <decisionTable id="DT_Eligibility" hitPolicy="FIRST">
      <input id="In_Band" label="Band">
        <inputExpression typeRef="string"><text>band</text></inputExpression>
      </input>
      <input id="In_Amount" label="Amount">
        <inputExpression typeRef="number"><text>amount</text></inputExpression>
      </input>
      <output id="Out_Eligible" label="Eligible" typeRef="boolean"/>
      <rule id="Rule_Elig_1">
        <inputEntry id="IE_E1a"><text>"Excellent"</text></inputEntry>
        <inputEntry id="IE_E1b"><text>&lt; 250000</text></inputEntry>
        <outputEntry id="OE_E1"><text>true</text></outputEntry>
      </rule>
      <rule id="Rule_Elig_2">
        <inputEntry id="IE_E2a"><text>"Good"</text></inputEntry>
        <inputEntry id="IE_E2b"><text>&lt; 100000</text></inputEntry>
        <outputEntry id="OE_E2"><text>true</text></outputEntry>
      </rule>
      <rule id="Rule_Elig_3">
        <inputEntry id="IE_E3a"><text>-</text></inputEntry>
        <inputEntry id="IE_E3b"><text>-</text></inputEntry>
        <outputEntry id="OE_E3"><text>false</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
  <inputData id="Input_Fico" name="FICO score"/>
  <inputData id="Input_Amount" name="Loan amount"/>
  <inputData id="Input_Income" name="Annual income"/>
  <knowledgeSource id="KS_Policy" name="Credit policy"/>
</definitions>
`;

export const DMN_JSON_SAMPLE = JSON.stringify(
  {
    name: 'Loan approval',
    namespace: 'https://easytoolhub.local/dmn',
    tables: [
      {
        id: 'DT_Score',
        name: 'Credit score band',
        hitPolicy: 'UNIQUE',
        inputs: [{ label: 'FICO', expression: 'fico', typeRef: 'number' }],
        outputs: [{ label: 'Band', typeRef: 'string' }],
        rules: [
          { inputs: ['>= 740'], outputs: ['Excellent'] },
          { inputs: ['[670..739]'], outputs: ['Good'] },
          { inputs: ['< 670'], outputs: ['Fair'] }
        ]
      }
    ]
  },
  null,
  2
);

export const DMN_CSV_SAMPLE = `decision,hit_policy,inputs,outputs
Credit score band,UNIQUE,fico >= 740,Excellent
Credit score band,UNIQUE,fico [670..739],Good
Eligibility,FIRST,Excellent / amount < 250000,true
`;
