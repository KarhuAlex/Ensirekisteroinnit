param dataAccountName string
param runtimeAccountName string
param location string
param tags object

@description('Origins allowed to read the published data from the browser (CORS).')
param allowedOrigins array

// Data account. The `published` container is world-readable (open data, CC BY 4.0) and `raw` stays
// private. Nothing else here is public.
resource data 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: dataAccountName
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

resource dataBlob 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: data
  name: 'default'
  properties: {
    cors: {
      corsRules: [
        {
          allowedOrigins: allowedOrigins
          allowedMethods: ['GET', 'HEAD']
          allowedHeaders: ['*']
          exposedHeaders: ['ETag']
          maxAgeInSeconds: 3600
        }
      ]
    }
  }
}

resource published 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: dataBlob
  name: 'published'
  properties: { publicAccess: 'Blob' }
}

resource raw 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: dataBlob
  name: 'raw'
  properties: { publicAccess: 'None' }
}

// Published releases are deliberately not expired by age. If the source stops updating, for
// example during Traficom's database migration, the current release can be months old and must
// keep being served. Releases are small, so keeping them all is cheap. Only the raw archive, which
// is never served, is tiered and eventually deleted.
resource lifecycle 'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01' = {
  parent: data
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          name: 'archive-raw'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: ['blockBlob']
              prefixMatch: ['raw/']
            }
            actions: {
              baseBlob: {
                tierToCool: { daysAfterModificationGreaterThan: 30 }
                delete: { daysAfterModificationGreaterThan: 730 }
              }
            }
          }
        }
      ]
    }
  }
}

// Runtime account: Functions host state and deployment packages. Fully private.
resource runtime 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: runtimeAccountName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
  }
}

resource runtimeBlob 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: runtime
  name: 'default'
}

resource deployContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: runtimeBlob
  name: 'deploy'
  properties: { publicAccess: 'None' }
}

output dataAccountName string = data.name
output runtimeAccountName string = runtime.name
output dataBlobEndpoint string = data.properties.primaryEndpoints.blob
output deployContainerName string = deployContainer.name
