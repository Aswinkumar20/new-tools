/** Synthetic shop Kubernetes snippets (education / research). */

export const K8S_SAMPLE = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: shop
  labels:
    app: web
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
---
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: shop
spec:
  type: ClusterIP
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 8080
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: shop
  labels:
    app: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: shop
spec:
  selector:
    app: api
  ports:
    - port: 3000
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
  namespace: shop
spec:
  rules:
    - host: shop.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
`;

export const K8S_JSON_SAMPLE = `{
  "kind": "List",
  "items": [
    {
      "kind": "Deployment",
      "metadata": { "name": "web", "namespace": "shop", "labels": { "app": "web" } },
      "spec": {
        "replicas": 2,
        "selector": { "matchLabels": { "app": "web" } },
        "template": { "metadata": { "labels": { "app": "web" } } }
      }
    },
    {
      "kind": "Service",
      "metadata": { "name": "web", "namespace": "shop" },
      "spec": { "selector": { "app": "web" }, "ports": [{ "port": 80 }] }
    }
  ]
}
`;

export const K8S_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<kubernetes name="Shop">
  <workload kind="Deployment" name="web" namespace="shop" replicas="2" app="web"/>
  <service kind="Service" name="web" namespace="shop" selector="web" port="80"/>
  <link source="web" target="web" rel="selects"/>
</kubernetes>
`;

export const K8S_MARKDOWN_SAMPLE = `# Shop

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  labels:
    app: web
spec:
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
---
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web
  ports:
    - port: 80
\`\`\`
`;
