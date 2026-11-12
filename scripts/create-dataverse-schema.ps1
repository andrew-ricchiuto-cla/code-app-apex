param(
  [string]$OrgUrl = "https://org8c828ba2.crm.dynamics.com",
  [string]$Solution = "ApexSimulation",
  [switch]$WhatIf
)
# Creates (or completes) the Apex Dataverse schema in the given environment. Idempotent:
# existing tables/columns are skipped. Requires `az login` as a user with System Customizer
# or System Administrator in the target environment, and the solution + security roles
# (ApexPlayer, ApexFacilitator, ApexObserver) to already exist.
$ErrorActionPreference = "Stop"
$api = "$OrgUrl/api/data/v9.2"
$token = az account get-access-token --resource $OrgUrl --query accessToken -o tsv
$h = @{ Authorization = "Bearer $token"; Accept = "application/json"; "OData-MaxVersion" = "4.0"; "OData-Version" = "4.0"; "MSCRM.SolutionUniqueName" = $Solution }

function Label($text) {
  @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"; LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = $text; LanguageCode = 1033 }) }
}
function Post($url, $body) {
  if ($WhatIf) { "WHATIF POST $url"; return }
  Invoke-RestMethod -Method Post -Uri $url -Headers $h -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 20)))
}
function EntityExists($logical) {
  try { Invoke-RestMethod "$api/EntityDefinitions(LogicalName='$logical')?`$select=LogicalName" -Headers $h | Out-Null; $true } catch { $false }
}
function AttrExists($entity, $logical) {
  try { Invoke-RestMethod "$api/EntityDefinitions(LogicalName='$entity')/Attributes(LogicalName='$logical')?`$select=LogicalName" -Headers $h | Out-Null; $true } catch { $false }
}
function StringCol($schema, $display, $max = 100) {
  @{ "@odata.type" = "Microsoft.Dynamics.CRM.StringAttributeMetadata"; SchemaName = $schema; DisplayName = (Label $display); RequiredLevel = @{ Value = "None" }; MaxLength = $max; FormatName = @{ Value = "Text" } }
}
function MemoCol($schema, $display) {
  @{ "@odata.type" = "Microsoft.Dynamics.CRM.MemoAttributeMetadata"; SchemaName = $schema; DisplayName = (Label $display); RequiredLevel = @{ Value = "None" }; MaxLength = 1048576; Format = "TextArea" }
}
function IntCol($schema, $display) {
  @{ "@odata.type" = "Microsoft.Dynamics.CRM.IntegerAttributeMetadata"; SchemaName = $schema; DisplayName = (Label $display); RequiredLevel = @{ Value = "None" }; MinValue = -2147483648; MaxValue = 2147483647; Format = "None" }
}
function BoolCol($schema, $display) {
  @{ "@odata.type" = "Microsoft.Dynamics.CRM.BooleanAttributeMetadata"; SchemaName = $schema; DisplayName = (Label $display); RequiredLevel = @{ Value = "None" }; DefaultValue = $false
     OptionSet = @{ "@odata.type" = "Microsoft.Dynamics.CRM.BooleanOptionSetMetadata"; OptionSetType = "Boolean"
       TrueOption = @{ Value = 1; Label = (Label "Yes") }; FalseOption = @{ Value = 0; Label = (Label "No") } } }
}

$tables = @(
  @{ Schema = "mw_ApexGame"; Display = "Apex Game"; Plural = "Apex Games"; Desc = "Apex game: config, round clock, facilitators"
     Cols = @((IntCol "mw_CurrentRound" "Current Round"), (BoolCol "mw_UnderHood" "Under The Hood"), (MemoCol "mw_ConfigJson" "Config JSON"),
              (IntCol "mw_RoundPhase" "Round Phase"), (MemoCol "mw_FacilitatorsJson" "Facilitators JSON")) },
  @{ Schema = "mw_ApexTeam"; Display = "Apex Team"; Plural = "Apex Teams"; Desc = "Apex team within a game, with roster and captain"
     Cols = @((StringCol "mw_GameId" "Game Id"), (StringCol "mw_TeamKey" "Team Key"), (IntCol "mw_SortOrder" "Sort Order"),
              (MemoCol "mw_MembersJson" "Members JSON"), (StringCol "mw_CaptainUpn" "Captain UPN" 320)) },
  @{ Schema = "mw_ApexTeamRound"; Display = "Apex Team Round"; Plural = "Apex Team Rounds"; Desc = "Apex team decisions and facilitator ruling for one round"
     Cols = @((StringCol "mw_GameId" "Game Id"), (StringCol "mw_TeamKey" "Team Key"), (IntCol "mw_Round" "Round"), (MemoCol "mw_DecisionsJson" "Decisions JSON"),
              (BoolCol "mw_Submitted" "Submitted"), (MemoCol "mw_FacilitatorJson" "Facilitator JSON")) }
)

foreach ($t in $tables) {
  $logical = $t.Schema.ToLower()
  if (EntityExists $logical) { "table $logical exists" }
  else {
    "creating table $logical"
    Post "$api/EntityDefinitions" @{
      "@odata.type" = "Microsoft.Dynamics.CRM.EntityMetadata"; SchemaName = $t.Schema; DisplayName = (Label $t.Display); DisplayCollectionName = (Label $t.Plural)
      Description = (Label $t.Desc); OwnershipType = "UserOwned"; HasActivities = $false; HasNotes = $false; IsActivity = $false
      Attributes = @((StringCol "mw_Name" "Name" 200) + @{ IsPrimaryName = $true })
    } | Out-Null
    # Metadata locks briefly after table creation; adding columns immediately fails with 0x80040216.
    if (-not $WhatIf) { Start-Sleep 30 }
  }
  foreach ($c in $t.Cols) {
    $col = $c.SchemaName.ToLower()
    if (AttrExists $logical $col) { "  column $col exists" }
    else { "  creating column $col"; Post "$api/EntityDefinitions(LogicalName='$logical')/Attributes" $c | Out-Null; if (-not $WhatIf) { Start-Sleep 3 } }
  }
}

"publishing"
$xml = "<importexportxml><entities><entity>mw_apexgame</entity><entity>mw_apexteam</entity><entity>mw_apexteamround</entity></entities></importexportxml>"
Post "$api/PublishXml" @{ ParameterXml = $xml } | Out-Null

"granting privileges"
$grants = @{ ApexPlayer = @("Create", "Read", "Write"); ApexFacilitator = @("Create", "Read", "Write"); ApexObserver = @("Read") }
foreach ($roleName in $grants.Keys) {
  $role = (Invoke-RestMethod "$api/roles?`$select=roleid,name&`$filter=name eq '$roleName' and _parentroleid_value eq null" -Headers $h).value[0]
  if (-not $role) { "  role $roleName not found, skipping"; continue }
  $privs = @()
  foreach ($entity in "mw_apexgame", "mw_apexteam", "mw_apexteamround") {
    foreach ($verb in $grants[$roleName]) {
      $p = (Invoke-RestMethod "$api/privileges?`$select=privilegeid,name&`$filter=name eq 'prv$verb$entity'" -Headers $h).value[0]
      $privs += @{ "@odata.type" = "Microsoft.Dynamics.CRM.RolePrivilege"; PrivilegeId = $p.privilegeid; Depth = "Global" }
    }
  }
  "  $roleName <- $($privs.Count) privileges"
  Post "$api/roles($($role.roleid))/Microsoft.Dynamics.CRM.AddPrivilegesRole" @{ Privileges = $privs } | Out-Null
}
"done"
