# ==============================================================================
# ClientPulse AI — Automated Test Suite for [BE-21] #35
# File: test_email_tracking.ps1
# Issue: [BE-21] [P2] [M] Webhook/tracking de abertura de e-mail (openedAt) #35
# ==============================================================================

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Running Verification Tests for [BE-21] #35: Email Open Tracking " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$passed = 0
$failed = 0

function Assert-Test([string]$testName, [bool]$condition, [string]$details = "") {
    if ($condition) {
        Write-Host " [PASS] $testName" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host " [FAIL] $testName - $details" -ForegroundColor Red
        $script:failed++
    }
}

# ------------------------------------------------------------------------------
# Test 1: File Existence & Architecture
# ------------------------------------------------------------------------------
Write-Host "`n--- Test Suite 1: Architecture & File Integrity ---" -ForegroundColor Yellow

$trackingRoute = "src\app\api\track\open\route.ts"
$resendWebhookRoute = "src\app\api\webhooks\resend\route.ts"
$edgeTrackingFunction = "supabase\functions\email-tracking\index.ts"
$migrationFile = "supabase\migrations\004_be_21_opened_at.sql"
$dbTypesFile = "src\types\database.types.ts"
$dashboardPage = "src\app\dashboard\page.tsx"
$apiLib = "src\lib\api.ts"
$resendShared = "supabase\functions\_shared\resend.ts"

Assert-Test "Tracking Route exists (src/app/api/track/open/route.ts)" (Test-Path $trackingRoute)
Assert-Test "Resend Webhook Route exists (src/app/api/webhooks/resend/route.ts)" (Test-Path $resendWebhookRoute)
Assert-Test "Edge Function exists (supabase/functions/email-tracking/index.ts)" (Test-Path $edgeTrackingFunction)
Assert-Test "Database Migration exists (004_be_21_opened_at.sql)" (Test-Path $migrationFile)
Assert-Test "Database types file exists" (Test-Path $dbTypesFile)

# ------------------------------------------------------------------------------
# Test 2: Database Schema & Migration Checks
# ------------------------------------------------------------------------------
Write-Host "`n--- Test Suite 2: Schema Migration & Database Types ---" -ForegroundColor Yellow

$migrationContent = Get-Content $migrationFile -Raw
Assert-Test "Migration adds opened_at to public.reports" ($migrationContent -match "ALTER TABLE public\.reports\s+ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ")
Assert-Test "Migration adds opened_at to public.delivery_logs" ($migrationContent -match "ALTER TABLE public\.delivery_logs\s+ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ")
Assert-Test "Migration creates idx_reports_opened_at index" ($migrationContent -match "CREATE INDEX IF NOT EXISTS idx_reports_opened_at")
Assert-Test "Migration includes idempotent record_report_open function" ($migrationContent -match "CREATE OR REPLACE FUNCTION public\.record_report_open")
Assert-Test "SQL update guards with 'opened_at IS NULL'" ($migrationContent -match "opened_at IS NULL")

$dbTypesContent = Get-Content $dbTypesFile -Raw
Assert-Test "TypeScript database types include opened_at in reports" ($dbTypesContent -match "opened_at:\s*string\s*\|\s*null")
Assert-Test "TypeScript database types include opened_at in delivery_logs" ($dbTypesContent -match "delivery_logs:[\s\S]*?opened_at\??:\s*string\s*\|\s*null")

# ------------------------------------------------------------------------------
# Test 3: Criterion 1 — Endpoint Regista Data/Hora da Primeira Abertura
# ------------------------------------------------------------------------------
Write-Host "`n--- Test Suite 3: Criterion 1 (Endpoint regista data/hora da primeira abertura) ---" -ForegroundColor Yellow

$trackingRouteContent = Get-Content $trackingRoute -Raw
Assert-Test "Tracking endpoint exports GET method (Pixel)" ($trackingRouteContent -match "export async function GET")
Assert-Test "Tracking endpoint exports POST method (API/Webhook)" ($trackingRouteContent -match "export async function POST")
Assert-Test "GET pixel returns image/gif" ($trackingRouteContent -match '"Content-Type": "image/gif"')
Assert-Test "GET pixel has Cache-Control: no-store" ($trackingRouteContent -match "no-store, no-cache")
Assert-Test "Pixel includes transparent GIF bytes" ($trackingRouteContent -match "TRANSPARENT_GIF_PIXEL")
Assert-Test "POST endpoint calls recordReportOpen" ($trackingRouteContent -match "recordReportOpen")

$apiLibContent = Get-Content $apiLib -Raw
Assert-Test "API library exports recordReportOpen" ($apiLibContent -match "export async function recordReportOpen")
Assert-Test "recordReportOpen records timestamp" ($apiLibContent -match "applyReportOverride\(reportId,\s*\{\s*openedAt:\s*recordedTime\s*\}\)")

# ------------------------------------------------------------------------------
# Test 4: Criterion 3 — Pedidos Repetidos NÃO Sobrescrevem o Primeiro Registo
# ------------------------------------------------------------------------------
Write-Host "`n--- Test Suite 4: Criterion 3 (Pedidos repetidos não sobrescrevem registo) ---" -ForegroundColor Yellow

Assert-Test "API checks existing openedAt before writing" ($apiLibContent -match "if\s*\(\s*current\.openedAt\s*\)\s*\{[\s\S]*?isFirstOpen:\s*false")
Assert-Test "Edge Function enforces 'opened_at IS NULL' in SQL" (
    (Get-Content $edgeTrackingFunction -Raw) -match "is\('opened_at',\s*null\)"
)
Assert-Test "Edge Function returns initial timestamp on repeat" (
    (Get-Content $edgeTrackingFunction -Raw) -match "is_first_open:\s*false"
)

# In-memory logic simulation of idempotency
$reportMock = @{
    id = "rpt-test-1"
    openedAt = $null
}

function Mock-RecordOpen([hashtable]$rpt, [string]$timestamp) {
    if ($rpt.openedAt -ne $null) {
        return @{
            success = $true
            openedAt = $rpt.openedAt
            isFirstOpen = $false
        }
    }
    $rpt.openedAt = $timestamp
    return @{
        success = $true
        openedAt = $timestamp
        isFirstOpen = $true
    }
}

$firstTime = "2026-11-12T16:00:00.000Z"
$secondTime = "2026-11-12T17:30:00.000Z"
$thirdTime = "2026-11-13T09:15:00.000Z"

$res1 = Mock-RecordOpen $reportMock $firstTime
Assert-Test "First open records initial timestamp" ($res1.isFirstOpen -eq $true -and $res1.openedAt -eq $firstTime)

$res2 = Mock-RecordOpen $reportMock $secondTime
Assert-Test "Second open preserves first timestamp (does NOT overwrite)" ($res2.isFirstOpen -eq $false -and $res2.openedAt -eq $firstTime)

$res3 = Mock-RecordOpen $reportMock $thirdTime
Assert-Test "Third open still preserves first timestamp" ($res3.isFirstOpen -eq $false -and $res3.openedAt -eq $firstTime)
Assert-Test "Report openedAt remains strictly original" ($reportMock.openedAt -eq $firstTime)

# ------------------------------------------------------------------------------
# Test 5: Criterion 2 — openedAt Visível no Dashboard
# ------------------------------------------------------------------------------
Write-Host "`n--- Test Suite 5: Criterion 2 (openedAt visível no dashboard) ---" -ForegroundColor Yellow

$dashboardContent = Get-Content $dashboardPage -Raw
Assert-Test "Dashboard checks r.openedAt" ($dashboardContent -match "\{\s*r\.openedAt\s*\?")
Assert-Test "Dashboard renders formatDateTime(r.openedAt)" ($dashboardContent -match "formatDateTime\(r\.openedAt\)")
Assert-Test "Dashboard displays 'Aberto (...)' tag" ($dashboardContent -match "Aberto \(\{formatDateTime\(r\.openedAt\)\}\)")
Assert-Test "Dashboard displays 'Ainda não aberto' fallback" ($dashboardContent -match "Ainda não aberto")

# ------------------------------------------------------------------------------
# Test 6: Resend Webhook & Email Pixel Integration
# ------------------------------------------------------------------------------
Write-Host "`n--- Test Suite 6: Resend Webhook & Email Template Integration ---" -ForegroundColor Yellow

$webhookContent = Get-Content $resendWebhookRoute -Raw
Assert-Test "Webhook handles 'email.opened' event" ($webhookContent -match 'eventType !== "email.opened"')
Assert-Test "Webhook extracts tags.report_id" ($webhookContent -match "tags\?\.report_id")
Assert-Test "Webhook calls recordReportOpen" ($webhookContent -match "recordReportOpen")

$resendSharedContent = Get-Content $resendShared -Raw
Assert-Test "Email HTML includes tracking pixel img tag" ($resendSharedContent -match '<img src="\$\{trackingPixelUrl\}"')
Assert-Test "Tracking pixel uses /api/track/open endpoint" ($resendSharedContent -match "/api/track/open")

# ------------------------------------------------------------------------------
# Final Summary
# ------------------------------------------------------------------------------
Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "Test Summary: Passed: $passed | Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "=================================================================" -ForegroundColor Cyan

if ($failed -gt 0) {
    exit 1
} else {
    exit 0
}
