/** Synthetic shop checkout Drools snippets (education / research). */

export const DRL_SAMPLE = `package com.shop;

import com.shop.Order;
import com.shop.Customer;

rule "Free shipping"
    salience 10
when
    $o : Order( total >= 50, itemCount > 0 )
then
    $o.setShipping("free");
end

rule "Express upgrade"
    salience 20
when
    $o : Order( total >= 100 )
    $c : Customer( vip == true )
then
    $o.setShipping("express");
end
`;

export const DRL_JSON_SAMPLE = `{
  "package": "com.shop",
  "name": "ShopRules",
  "rules": [
    {
      "name": "Free shipping",
      "salience": 10,
      "conditions": [
        { "fact": "Order", "constraints": "total >= 50" }
      ],
      "then": "$o.setShipping(\\"free\\");"
    }
  ]
}
`;

export const DRL_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rules name="ShopRules" package="com.shop">
  <rule name="Free shipping" salience="10">
    <condition fact="Order" constraints="total >= 50"/>
    <then>$o.setShipping("free");</then>
  </rule>
</rules>
`;

export const DRL_MARKDOWN_SAMPLE = `# ShopRules

## Free shipping
when Order(total >= 50)
then setShipping(free)
`;
