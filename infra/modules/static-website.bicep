param name string
param location string
param tags object

// The site is plain static files served from the `$web` container through the storage account's
// static website endpoint. Static website hosting needs anonymous reads, so blob public access is
// allowed here; the account holds nothing but public site files.
resource site 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: name
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: true
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
  }
}

resource blob 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: site
  name: 'default'
}

resource webContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blob
  name: '$web'
  properties: { publicAccess: 'None' }
}

output name string = site.name
@description('Origin of the site without a trailing slash, for the data account CORS rule.')
output origin string = take(site.properties.primaryEndpoints.web, length(site.properties.primaryEndpoints.web) - 1)
output url string = site.properties.primaryEndpoints.web
