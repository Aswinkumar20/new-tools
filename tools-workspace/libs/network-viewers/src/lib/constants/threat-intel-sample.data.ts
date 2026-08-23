/** Synthetic STIX 2.1 bundle (education / research). */

export function buildThreatIntelSampleObject(): Record<string, unknown> {
  return {
    type: 'bundle',
    id: 'bundle--a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    spec_version: '2.1',
    objects: [
      {
        type: 'identity',
        id: 'identity--11111111-1111-1111-1111-111111111111',
        name: 'Lab SOC',
        identity_class: 'organization',
        description: 'Synthetic internal SOC identity'
      },
      {
        type: 'threat-actor',
        id: 'threat-actor--22222222-2222-2222-2222-222222222222',
        name: 'APT-Lab',
        aliases: ['Lab Panda'],
        description: 'Fictional actor used for education samples',
        threat_actor_types: ['nation-state']
      },
      {
        type: 'malware',
        id: 'malware--33333333-3333-3333-3333-333333333333',
        name: 'LabStealer',
        is_family: true,
        malware_types: ['trojan'],
        description: 'Synthetic infostealer family'
      },
      {
        type: 'attack-pattern',
        id: 'attack-pattern--44444444-4444-4444-4444-444444444444',
        name: 'Spearphishing Attachment',
        description: 'Phishing with a malicious attachment',
        external_references: [{ source_name: 'mitre-attack', external_id: 'T1566.001' }]
      },
      {
        type: 'indicator',
        id: 'indicator--55555555-5555-5555-5555-555555555551',
        name: 'Malicious C2 domain',
        indicator_types: ['malicious-activity'],
        pattern: "[domain-name:value = 'c2.malware.example']",
        pattern_type: 'stix',
        valid_from: '2024-03-01T00:00:00Z',
        confidence: 90
      },
      {
        type: 'indicator',
        id: 'indicator--55555555-5555-5555-5555-555555555552',
        name: 'C2 IPv4',
        indicator_types: ['malicious-activity'],
        pattern: "[ipv4-addr:value = '198.51.100.80']",
        pattern_type: 'stix',
        valid_from: '2024-03-01T00:00:00Z',
        confidence: 85
      },
      {
        type: 'indicator',
        id: 'indicator--55555555-5555-5555-5555-555555555553',
        name: 'LabStealer SHA-256',
        indicator_types: ['malicious-activity'],
        pattern: "[file:hashes.'SHA-256' = '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f']",
        pattern_type: 'stix',
        valid_from: '2024-03-02T00:00:00Z',
        confidence: 95
      },
      {
        type: 'indicator',
        id: 'indicator--55555555-5555-5555-5555-555555555554',
        name: 'Gate URL',
        labels: ['malicious-activity'],
        pattern: "[url:value = 'https://c2.malware.example/gate']",
        pattern_type: 'stix',
        valid_from: '2024-03-02T00:00:00Z',
        confidence: 80
      },
      {
        type: 'indicator',
        id: 'indicator--55555555-5555-5555-5555-555555555555',
        name: 'Drop mailbox',
        indicator_types: ['anomalous-activity'],
        pattern: "[email-addr:value = 'drop@malware.example']",
        pattern_type: 'stix',
        valid_from: '2024-03-03T00:00:00Z',
        confidence: 60
      },
      {
        type: 'relationship',
        id: 'relationship--66666666-6666-6666-6666-666666666661',
        relationship_type: 'indicates',
        source_ref: 'indicator--55555555-5555-5555-5555-555555555551',
        target_ref: 'malware--33333333-3333-3333-3333-333333333333'
      },
      {
        type: 'relationship',
        id: 'relationship--66666666-6666-6666-6666-666666666662',
        relationship_type: 'indicates',
        source_ref: 'indicator--55555555-5555-5555-5555-555555555553',
        target_ref: 'malware--33333333-3333-3333-3333-333333333333'
      },
      {
        type: 'relationship',
        id: 'relationship--66666666-6666-6666-6666-666666666663',
        relationship_type: 'uses',
        source_ref: 'threat-actor--22222222-2222-2222-2222-222222222222',
        target_ref: 'malware--33333333-3333-3333-3333-333333333333'
      },
      {
        type: 'relationship',
        id: 'relationship--66666666-6666-6666-6666-666666666664',
        relationship_type: 'uses',
        source_ref: 'malware--33333333-3333-3333-3333-333333333333',
        target_ref: 'attack-pattern--44444444-4444-4444-4444-444444444444'
      },
      {
        type: 'relationship',
        id: 'relationship--66666666-6666-6666-6666-666666666665',
        relationship_type: 'attributed-to',
        source_ref: 'threat-actor--22222222-2222-2222-2222-222222222222',
        target_ref: 'identity--11111111-1111-1111-1111-111111111111'
      }
    ]
  };
}

export const THREAT_JSON_SAMPLE = JSON.stringify(buildThreatIntelSampleObject(), null, 2);

export const THREAT_CSV_SAMPLE = `type,value,labels
domain,c2.malware.example,malicious-activity
ip,198.51.100.80,malicious-activity
url,https://c2.malware.example/gate,malicious-activity
`;

export const THREAT_XML_SAMPLE = `<ThreatIntel name="Lab TI XML" version="2.1">
  <Indicator type="domain" value="c2.malware.example" name="Malicious C2 domain" labels="malicious-activity"/>
  <Indicator type="ip" value="198.51.100.80" name="C2 IPv4" labels="malicious-activity"/>
  <Object kind="threat-actor" name="APT-Lab" aliases="Lab Panda"/>
  <Object kind="malware" name="LabStealer"/>
  <Relationship type="indicates" source="Malicious C2 domain" target="LabStealer"/>
  <Relationship type="uses" source="APT-Lab" target="LabStealer"/>
</ThreatIntel>
`;
