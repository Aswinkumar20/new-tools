/** Synthetic HTTP conversation trace (education / research). */

export const HTTP_TRACE_TEXT_SAMPLE = `# HTTP TRACE Checkout flow
>>> GET / HTTP/1.1
Host: shop.example.com
Accept: text/html
User-Agent: EasyToolHub-Trace/1.0

<<< HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Cache-Control: public, max-age=60

<!doctype html><html><body>Shop</body></html>

>>> GET /assets/app.css HTTP/1.1
Host: cdn.example.com
Accept: text/css

<<< HTTP/1.1 200 OK
Content-Type: text/css

body{font-family:sans-serif}

>>> GET /api/v1/products?limit=8 HTTP/1.1
Host: api.example.com
Accept: application/json

<<< HTTP/1.1 200 OK
Content-Type: application/json

{"items":[{"id":1,"name":"Widget","price":19.5}]}

>>> POST /api/v1/cart HTTP/1.1
Host: api.example.com
Content-Type: application/json
Accept: application/json

{"sku":"W-1","qty":1}

<<< HTTP/1.1 201 Created
Content-Type: application/json

{"ok":true,"id":"c-19"}

>>> GET /assets/missing.woff2 HTTP/1.1
Host: cdn.example.com
Accept: font/woff2

<<< HTTP/1.1 404 Not Found
Content-Type: text/plain

not found

>>> PATCH /api/v1/orders/o-42 HTTP/1.1
Host: api.example.com
Content-Type: application/json
Accept: application/json

{"status":"paid"}

<<< HTTP/1.1 200 OK
Content-Type: application/json

{"id":"o-42","status":"paid"}
`;
