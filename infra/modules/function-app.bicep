param name string
param planName string
param location string
param tags object
param runtimeStorageAccountName string
param dataStorageAccountName string
param appInsightsConnectionString string
param ingestSchedule string

// Built-in role definition ids (https://learn.microsoft.com/azure/role-based-access-control/built-in-roles)
var storageBlobDataOwner = 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
var storageBlobDataContributor = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var storageQueueDataContributor = '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
var storageTableDataContributor = '0a9a7e1f-b9d0-4642-a12a-27d3a11d8e9c'

resource runtimeStorage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: runtimeStorageAccountName
}

resource dataStorage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: dataStorageAccountName
}

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: planName
  location: location
  tags: tags
  kind: 'functionapp'
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true
  }
}

resource app 'Microsoft.Web/sites@2024-04-01' = {
  name: name
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${runtimeStorage.properties.primaryEndpoints.blob}deploy'
          authentication: { type: 'SystemAssignedIdentity' }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 40
        instanceMemoryMB: 2048
      }
      runtime: {
        name: 'node'
        version: '22'
      }
    }
    siteConfig: {
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      appSettings: [
        { name: 'AzureWebJobsStorage__accountName', value: runtimeStorageAccountName }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
        { name: 'DATA_STORAGE_ACCOUNT_URL', value: dataStorage.properties.primaryEndpoints.blob }
        { name: 'PUBLISHED_CONTAINER', value: 'published' }
        { name: 'RAW_CONTAINER', value: 'raw' }
        { name: 'INGEST_SCHEDULE', value: ingestSchedule }
      ]
    }
  }
}

// The Functions host needs blob, queue and table access to its own runtime account.
resource runtimeBlobOwner 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: runtimeStorage
  name: guid(runtimeStorage.id, app.id, storageBlobDataOwner)
  properties: {
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataOwner)
  }
}

resource runtimeQueue 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: runtimeStorage
  name: guid(runtimeStorage.id, app.id, storageQueueDataContributor)
  properties: {
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageQueueDataContributor)
  }
}

resource runtimeTable 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: runtimeStorage
  name: guid(runtimeStorage.id, app.id, storageTableDataContributor)
  properties: {
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageTableDataContributor)
  }
}

// The ingest job only needs to write blobs in the data account.
resource dataBlobContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: dataStorage
  name: guid(dataStorage.id, app.id, storageBlobDataContributor)
  properties: {
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributor)
  }
}

output name string = app.name
output principalId string = app.identity.principalId
