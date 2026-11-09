param name string
param location string
param tags object

resource web 'Microsoft.Web/staticSites@2023-12-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    // Content is deployed from CI with a deployment token; no repository link is configured here.
    stagingEnvironmentPolicy: 'Disabled'
    allowConfigFileUpdates: true
  }
}

output name string = web.name
output defaultHostname string = web.properties.defaultHostname
