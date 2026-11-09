// Ensirekisteröinnit infrastructure for one environment.
//
//   az group create -n rg-regs-prod -l swedencentral
//   az deployment group create -g rg-regs-prod -f infra/main.bicep -p infra/main.prod.bicepparam
//
// Creates data storage (public `published` container, private `raw`), a Function App on Flex
// Consumption with a managed identity, Application Insights and a Static Web App.

targetScope = 'resourceGroup'

@description('Short name used as a prefix for all resources (3–12 lowercase letters/digits).')
@minLength(3)
@maxLength(12)
param appName string = 'regs'

@description('Environment suffix, for example dev or prod.')
param environment string = 'prod'

@description('Region for most resources. Finland has no Azure region; Sweden Central is the closest.')
param location string = resourceGroup().location

@description('Region for the Static Web App (a limited set of regions is supported).')
param staticWebAppLocation string = 'westeurope'

@description('Ingest schedule as an NCRONTAB expression in UTC. 08:00 and 12:00 UTC = 10:00/14:00 in winter.')
param ingestSchedule string = '0 0 8,12 * * *'

var suffix = toLower('${appName}${environment}')
var unique = uniqueString(resourceGroup().id)
var tags = {
  app: 'ensirekisteroinnit'
  environment: environment
}

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    name: 'appi-${suffix}'
    location: location
    tags: tags
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    dataAccountName: take('st${suffix}data${unique}', 24)
    runtimeAccountName: take('st${suffix}fn${unique}', 24)
    location: location
    tags: tags
    allowedOrigins: [
      'https://${web.outputs.defaultHostname}'
    ]
  }
}

module functionApp 'modules/function-app.bicep' = {
  name: 'function-app'
  params: {
    name: 'func-${suffix}-${unique}'
    planName: 'plan-${suffix}'
    location: location
    tags: tags
    runtimeStorageAccountName: storage.outputs.runtimeAccountName
    dataStorageAccountName: storage.outputs.dataAccountName
    appInsightsConnectionString: monitoring.outputs.connectionString
    ingestSchedule: ingestSchedule
  }
}

module web 'modules/static-web-app.bicep' = {
  name: 'static-web-app'
  params: {
    name: 'swa-${suffix}-${unique}'
    location: staticWebAppLocation
    tags: tags
  }
}

@description('Base URL of the published data; set as VITE_DATA_BASE_URL when building the frontend.')
output dataBaseUrl string = '${storage.outputs.dataBlobEndpoint}published'
output functionAppName string = functionApp.outputs.name
output staticWebAppName string = web.outputs.name
output staticWebAppUrl string = 'https://${web.outputs.defaultHostname}'
