/** Synthetic API collection dump (education / research). */

export function buildApiSampleObject(): Record<string, unknown> {
  return {
    name: 'Orders API snapshot',
    baseUrl: 'https://api.example.com/v1',
    source: 'Synthetic education sample',
    requests: [
      {
        name: 'List orders',
        method: 'GET',
        url: 'https://api.example.com/v1/orders?limit=20&status=open',
        status: 200,
        statusText: 'OK',
        durationMs: 42,
        requestHeaders: [
          { name: 'Authorization', value: 'Bearer demo-token' },
          { name: 'Accept', value: 'application/json' }
        ],
        responseHeaders: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'X-Request-Id', value: 'req-100' }
        ],
        responseBody: '{"orders":[{"id":"o-1","total":19.5,"status":"open"},{"id":"o-2","total":8,"status":"open"}]}'
      },
      {
        name: 'Get order',
        method: 'GET',
        url: 'https://api.example.com/v1/orders/o-1',
        status: 200,
        statusText: 'OK',
        durationMs: 28,
        requestHeaders: [
          { name: 'Authorization', value: 'Bearer demo-token' },
          { name: 'Accept', value: 'application/json' }
        ],
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        responseBody: '{"id":"o-1","sku":"W-1","qty":1,"total":19.5,"status":"open"}'
      },
      {
        name: 'Create order',
        method: 'POST',
        url: 'https://api.example.com/v1/orders',
        status: 201,
        statusText: 'Created',
        durationMs: 96,
        requestHeaders: [
          { name: 'Authorization', value: 'Bearer demo-token' },
          { name: 'Content-Type', value: 'application/json' }
        ],
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        requestBody: '{"sku":"W-1","qty":1}',
        responseBody: '{"id":"o-19","sku":"W-1","qty":1,"status":"open"}'
      },
      {
        name: 'Update order',
        method: 'PATCH',
        url: 'https://api.example.com/v1/orders/o-19',
        status: 200,
        statusText: 'OK',
        durationMs: 54,
        requestHeaders: [
          { name: 'Authorization', value: 'Bearer demo-token' },
          { name: 'Content-Type', value: 'application/json' }
        ],
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        requestBody: '{"status":"paid"}',
        responseBody: '{"id":"o-19","status":"paid"}'
      },
      {
        name: 'Delete draft',
        method: 'DELETE',
        url: 'https://api.example.com/v1/orders/o-draft',
        status: 204,
        statusText: 'No Content',
        durationMs: 18,
        requestHeaders: [{ name: 'Authorization', value: 'Bearer demo-token' }],
        responseHeaders: [],
        responseBody: ''
      },
      {
        name: 'Unauthorized refund',
        method: 'POST',
        url: 'https://api.example.com/v1/orders/o-1/refund',
        status: 401,
        statusText: 'Unauthorized',
        durationMs: 12,
        requestHeaders: [
          { name: 'Authorization', value: 'Bearer expired' },
          { name: 'Content-Type', value: 'application/json' }
        ],
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        requestBody: '{"reason":"duplicate"}',
        responseBody: '{"error":"invalid_token","message":"Token expired"}'
      }
    ]
  };
}

export const API_JSON_SAMPLE = JSON.stringify(buildApiSampleObject(), null, 2);

export const API_HTTP_SAMPLE = `### List orders
GET https://api.example.com/v1/orders?limit=20
Authorization: Bearer demo-token
Accept: application/json

### Create order
POST https://api.example.com/v1/orders
Authorization: Bearer demo-token
Content-Type: application/json

{"sku":"W-1","qty":1}
`;
