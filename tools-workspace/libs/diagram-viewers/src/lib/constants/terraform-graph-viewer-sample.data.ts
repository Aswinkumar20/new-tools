/** Synthetic shop Terraform graph snippets (education / research). */

export const TF_SAMPLE = `digraph {
  compound = "true"
  newrank = "true"
  "[root] aws_vpc.shop" [label = "aws_vpc.shop"]
  "[root] aws_subnet.public" [label = "aws_subnet.public"]
  "[root] aws_security_group.web" [label = "aws_security_group.web"]
  "[root] aws_instance.web" [label = "aws_instance.web"]
  "[root] aws_vpc.shop" -> "[root] aws_subnet.public"
  "[root] aws_subnet.public" -> "[root] aws_instance.web"
  "[root] aws_security_group.web" -> "[root] aws_instance.web"
}
`;

export const TF_JSON_SAMPLE = `{
  "name": "Shop",
  "resources": [
    { "id": "aws_vpc.shop", "type": "aws_vpc", "name": "shop" },
    { "id": "aws_instance.web", "type": "aws_instance", "name": "web" }
  ],
  "edges": [
    { "source": "aws_vpc.shop", "target": "aws_instance.web", "label": "depends_on" }
  ]
}
`;

export const TF_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<terraform name="Shop">
  <resource id="aws_vpc.shop" type="aws_vpc" name="shop"/>
  <resource id="aws_instance.web" type="aws_instance" name="web"/>
  <edge source="aws_vpc.shop" target="aws_instance.web" label="depends_on"/>
</terraform>
`;

export const TF_MARKDOWN_SAMPLE = `# Shop

\`\`\`dot
digraph {
  "aws_vpc.shop" -> "aws_instance.web"
}
\`\`\`
`;
