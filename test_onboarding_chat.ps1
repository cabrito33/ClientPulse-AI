# ==============================================================================
# ClientPulse AI — Automated Test Suite for [BE-27] #47
# File: test_onboarding_chat.ps1
# Issue: [BE-27] [P1] [L] Chatbot de onboarding e FAQ (US02) #47
# ==============================================================================

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Running Verification Tests for [BE-27] (US02) #47: Chatbot Backend" -ForegroundColor Cyan
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
# Test 1: File Existence & Export Checks
# ------------------------------------------------------------------------------
Write-Host "`n--- Test Suite 1: Architecture & File Integrity ---" -ForegroundColor Yellow

$onboardingChatPath = "supabase\functions\onboarding-chat\index.ts"
$nextChatRoutePath = "src\app\api\chat\route.ts"
$onboardingBotLibPath = "src\lib\onboarding-bot.ts"
$sharedGithubPath = "supabase\functions\_shared\github.ts"

Assert-Test "Supabase Edge Function exists" (Test-Path $onboardingChatPath)
Assert-Test "Next.js API route exists" (Test-Path $nextChatRoutePath)
Assert-Test "Onboarding Bot core library exists" (Test-Path $onboardingBotLibPath)
Assert-Test "Shared GitHub module exists" (Test-Path $sharedGithubPath)

$botLibContent = Get-Content $onboardingBotLibPath -Raw
$edgeChatContent = Get-Content $onboardingChatPath -Raw
$routeContent = Get-Content $nextChatRoutePath -Raw

Assert-Test "Bot Lib exports processOnboardingMessage" ($botLibContent -match "export async function processOnboardingMessage")
Assert-Test "Bot Lib exports validateGitHubPat" ($botLibContent -match "export async function validateGitHubPat")
Assert-Test "Bot Lib exports isOutOfScope" ($botLibContent -match "export function isOutOfScope")
Assert-Test "Bot Lib exports isAdvanceIntent" ($botLibContent -match "export function isAdvanceIntent")
Assert-Test "Route imports processOnboardingMessage" ($routeContent -match "processOnboardingMessage")
Assert-Test "Edge Function handles testGitHubToken" ($edgeChatContent -match "testGitHubToken")

# ------------------------------------------------------------------------------
# Test 2: Criterion 4 — Out of Scope Refusal
# ------------------------------------------------------------------------------
Write-Host "`n--- Test Suite 2: Acceptance Criterion 4 (Refusa perguntas fora do âmbito) ---" -ForegroundColor Yellow

$outOfScopeSamples = @(
    "Como fazer um bolo de chocolate fofinho?",
    "Escreve um algoritmo de quicksort em python",
    "Qual é a previsão do tempo para amanhã em Lisboa?",
    "Quem ganhou o jogo de futebol entre o Benfica e o Porto?",
    "Qual é a capital da França?",
    "Conta uma anedota engraçada sobre programadores",
    "Escreve uma história de amor sobre dois robots",
    "Como calcular a sequência de fibonacci em C++?"
)

$outOfScopePatternRegex = "(receita\s+de|bolo\s+de|como\s+(cozinhar|fazer\s+pão|fazer\s+arroz)|quicksort|bubble\s*sort|fibonacci|árvore\s+binária|arvore\s+binaria|algoritmo\s+em\s+(c\+\+|java|python|c#|rust)|código\s+para\s+inverter\s+uma\s+string|capital\s+da\s+(frança|espanha|alemanha|itália)|previsão\s+do\s+tempo|tempo\s+amanhã|clima\s+em|quem\s+ganhou\s+o\s+jogo|futebol|benfica|porto|sporting|poema\s+sobre|história\s+de\s+amor|conta\s+uma\s+anedota|piada|política|eleições|presidente|escreve\s+um\s+ensaio\s+sobre)"

foreach ($sample in $outOfScopeSamples) {
    $matched = [regex]::IsMatch($sample, $outOfScopePatternRegex, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    Assert-Test "Blocks out-of-scope question: '$sample'" $matched
}

$refusalPtMandate = "O meu papel é ajudar-te exclusivamente na configuração do ClientPulse AI"
Assert-Test "Edge Function contains standard PT refusal message" ($edgeChatContent.Contains($refusalPtMandate))
Assert-Test "Bot Lib contains standard PT refusal message" ($botLibContent.Contains($refusalPtMandate))

# ------------------------------------------------------------------------------
# Test 3: Criterion 3 — GitHub Connection Validation Gate
# ------------------------------------------------------------------------------
Write-Host "`n--- Test Suite 3: Acceptance Criterion 3 (Valida ligação antes de avançar) ---" -ForegroundColor Yellow

$advanceQueries = @(
    "Avançar para o passo 2",
    "Quero avançar",
    "Próximo passo por favor",
    "Ir para as colunas",
    "Passo seguinte",
    "Mapear colunas",
    "Criar primeiro cliente",
    "Posso avançar?",
    "Skip github"
)

$advancePatternRegex = "(avançar|avanca|avancar|passo\s+seguinte|proximo\s+passo|próximo\s+passo|passo\s+2|step\s+2|passo\s+3|step\s+3|ir\s+para\s+as?\s+colunas|mapear\s+colunas|criar\s+(o\s+)?(primeiro\s+)?cliente|perfil\s+de\s+cliente|pular|saltar|skip|continuar|posso\s+avançar|posso\s+avancar|next\s+step)"

foreach ($adv in $advanceQueries) {
    $matchedAdv = [regex]::IsMatch($adv, $advancePatternRegex, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    Assert-Test "Detects advance attempt: '$adv'" $matchedAdv
}

# Verify gate rule logic
Assert-Test "Edge Function blocks advance with 'blocked_requires_pat'" ($edgeChatContent.Contains("blocked_requires_pat"))
Assert-Test "Bot Lib blocks advance with 'blocked_requires_pat'" ($botLibContent.Contains("blocked_requires_pat"))
Assert-Test "Refuses advance if not connected" ($botLibContent.Contains("é obrigatório validar primeiro a ligação ao GitHub"))

# ------------------------------------------------------------------------------
# Test 4: Criterion 2 — Step Guidance (GitHub, Columns, 1st Client)
# ------------------------------------------------------------------------------
Write-Host "`n--- Test Suite 4: Acceptance Criterion 2 (Guia GitHub, colunas e 1º cliente) ---" -ForegroundColor Yellow

Assert-Test "Guides PAT creation with 'read:project'" ($botLibContent.Contains("read:project"))
Assert-Test "Guides column mapping to 3 states (Concluído, Em curso, Bloqueado)" (
    $botLibContent.Contains("Concluído") -and
    $botLibContent.Contains("Em curso") -and
    $botLibContent.Contains("Bloqueado")
)
Assert-Test "Guides 1st client profile (nome, e-mail, tom, idioma)" (
    $botLibContent.Contains("nome da empresa ou cliente") -and
    $botLibContent.Contains("e-mail de destino") -and
    $botLibContent.Contains("idioma") -and
    $botLibContent.Contains("tom do relatório")
)
Assert-Test "Edge Function guides 4-step workflow" ($edgeChatContent.Contains("ONBOARDING WORKFLOW (Step-by-step guidance)"))

# ------------------------------------------------------------------------------
# Test 5: Criterion 1 — Product Documentation Knowledge & FAQs
# ------------------------------------------------------------------------------
Write-Host "`n--- Test Suite 5: Acceptance Criterion 1 (Contexto da documentação & FAQs) ---" -ForegroundColor Yellow

# Privacy FAQ
Assert-Test "Privacy FAQ: Explains source code is never read/stored" (
    $botLibContent.Contains("código-fonte dos teus repositórios nunca é lido") -or
    $botLibContent.Contains("O código-fonte nunca é lido nem armazenado")
)

# Zero-Login Portal FAQ
Assert-Test "Portal FAQ: Explains zero-login UUID token access" (
    $botLibContent.Contains("não precisa de criar conta nem de fazer login") -and
    $botLibContent.Contains("UUID")
)

# Anti-Hallucination FAQ
Assert-Test "AI Engine FAQ: Explains Gemini temperature (0.2) and draft review" (
    $botLibContent.Contains("temperatura baixa (0.2)") -and
    $botLibContent.Contains("rever e editar")
)

# Scheduling FAQ
Assert-Test "Scheduling FAQ: Explains Friday schedule and bypass mode" (
    $botLibContent.Contains("sextas-feiras") -and
    $botLibContent.Contains("Bypass")
)

# Supported tools FAQ
Assert-Test "Tools FAQ: Explains GitHub Projects v2 in MVP, Trello/Jira post-MVP" (
    $botLibContent.Contains("GitHub Projects v2") -and
    $botLibContent.Contains("Trello") -and
    $botLibContent.Contains("Jira")
)

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
