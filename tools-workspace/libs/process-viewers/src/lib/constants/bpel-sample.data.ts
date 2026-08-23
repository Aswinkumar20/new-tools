/** Synthetic WS-BPEL 2.0 loan-approval process (education / research). */

export const BPEL_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<bpel:process name="LoanApproval" targetNamespace="https://easytoolhub.local/bpel"
  xmlns:bpel="http://docs.oasis-open.org/wsbpel/2.0/process/executable">
  <bpel:partnerLinks>
    <bpel:partnerLink name="customer" partnerLinkType="loanLT" myRole="approver" partnerRole="requester"/>
    <bpel:partnerLink name="creditAgency" partnerLinkType="creditLT" partnerRole="rater"/>
    <bpel:partnerLink name="assessor" partnerLinkType="assessLT" partnerRole="risk"/>
  </bpel:partnerLinks>
  <bpel:variables>
    <bpel:variable name="request" messageType="loanRequest"/>
    <bpel:variable name="risk" messageType="riskReport"/>
    <bpel:variable name="credit" messageType="creditReport"/>
    <bpel:variable name="response" messageType="loanResponse"/>
  </bpel:variables>
  <bpel:sequence name="Main">
    <bpel:receive name="ReceiveRequest" partnerLink="customer" operation="request" variable="request" createInstance="yes"/>
    <bpel:if name="SmallAmount">
      <bpel:condition>$request.amount &lt; 10000</bpel:condition>
      <bpel:sequence name="LowRiskPath">
        <bpel:invoke name="InvokeAssessor" partnerLink="assessor" operation="check" inputVariable="request" outputVariable="risk"/>
        <bpel:assign name="ApproveLowRisk"/>
      </bpel:sequence>
      <bpel:else>
        <bpel:sequence name="FullCreditPath">
          <bpel:invoke name="InvokeCredit" partnerLink="creditAgency" operation="check" inputVariable="request" outputVariable="credit"/>
          <bpel:if name="CreditOk">
            <bpel:invoke name="NotifyApprove" partnerLink="customer" operation="callback" inputVariable="response"/>
            <bpel:else>
              <bpel:throw name="RejectLoan" faultName="loanRejected"/>
            </bpel:else>
          </bpel:if>
        </bpel:sequence>
      </bpel:else>
    </bpel:if>
    <bpel:reply name="SendReply" partnerLink="customer" operation="request" variable="response"/>
  </bpel:sequence>
</bpel:process>
`;

export const BPEL_JSON_SAMPLE = JSON.stringify(
  {
    name: 'LoanApproval',
    namespace: 'https://easytoolhub.local/bpel',
    partners: [
      { name: 'customer', type: 'loanLT', myRole: 'approver', partnerRole: 'requester' },
      { name: 'creditAgency', type: 'creditLT', partnerRole: 'rater' }
    ],
    variables: [
      { name: 'request', type: 'loanRequest' },
      { name: 'response', type: 'loanResponse' }
    ],
    activities: [
      { name: 'ReceiveRequest', kind: 'receive', partner: 'customer', operation: 'request' },
      { name: 'InvokeCredit', kind: 'invoke', partner: 'creditAgency', operation: 'check', parent: 'Main' },
      { name: 'SendReply', kind: 'reply', partner: 'customer', operation: 'request' }
    ]
  },
  null,
  2
);

export const BPEL_CSV_SAMPLE = `kind,name,partner,operation,parent
receive,ReceiveRequest,customer,request,
invoke,InvokeAssessor,assessor,check,LowRiskPath
invoke,InvokeCredit,creditAgency,check,FullCreditPath
reply,SendReply,customer,request,
`;
