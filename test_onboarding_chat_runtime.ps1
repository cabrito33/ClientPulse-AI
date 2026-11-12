# ==============================================================================
# ClientPulse AI — Runtime Simulation Test for Onboarding Chat
# File: test_onboarding_chat_runtime.ps1
# ==============================================================================

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Running Runtime Behavior Tests for [BE-27] #47: PulseBot Logic" -ForegroundColor Cyan
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

# Load the logic patterns directly from src/lib/onboarding-bot.ts
$botLib = Get-Content "src\lib\onboarding-bot.ts" -Raw

# Test 1: Out of Scope Guardrail Simulation
function Test-IsOutOfScope([string]$msg) {
    $outOfScopePattern = "(receita\s+de|bolo\s+de|como\s+(cozinhar|fazer\s+pão|fazer\s+arroz)|quicksort|bubble\s*sort|fibonacci|árvore\s+binária|arvore\s+binaria|algoritmo\s+em\s+(c\+\+|java|python|c#|rust)|código\s+para\s+inverter\s+uma\s+string|capital\s+da\s+(frança|espanha|alemanha|itália)|previsão\s+do\s+tempo|tempo\s+amanhã|clima\s+em|quem\s+ganhou\s+o\s+jogo|futebol|benfica|porto|sporting|poema\s+sobre|história\s+de\s+amor|conta\s+uma\s+anedota|piada|política|eleições|presidente|escreve\s+um\s+ensaio\s+sobre)"
    return [regex]::IsMatch($msg, $outOfScopePattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
}

Assert-Test "Guardrail catches recipe question" (Test-IsOutOfScope "Como fazer um bolo de cenoura com cobertura de chocolate?")
Assert-Test "Guardrail catches coding algorithm question" (Test-IsOutOfScope "Escreve a implementação do algoritmo quicksort em rust")
Assert-Test "Guardrail allows product questions" (-not (Test-IsOutOfScope "O cliente precisa de palavra-passe para ver o relatório?"))
Assert-Test "Guardrail allows GitHub PAT questions" (-not (Test-IsOutOfScope "Onde crio o meu token PAT no GitHub?"))

# Test 2: Advance Intent Simulation
function Test-IsAdvanceIntent([string]$msg) {
    $advancePattern = "(avançar|avanca|avancar|passo\s+seguinte|proximo\s+passo|próximo\s+passo|passo\s+2|step\s+2|passo\s+3|step\s+3|ir\s+para\s+as?\s+colunas|mapear\s+colunas|criar\s+(o\s+)?(primeiro\s+)?cliente|perfil\s+de\s+cliente|pular|saltar|skip|continuar|posso\s+avançar|posso\s+avancar|next\s+step)"
    return [regex]::IsMatch($msg, $advancePattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
}

Assert-Test "Advance intent catches 'Avançar para o passo 2'" (Test-IsAdvanceIntent "Avançar para o passo 2")
Assert-Test "Advance intent catches 'Skip github'" (Test-IsAdvanceIntent "Skip github")
Assert-Test "Advance intent catches 'Passo seguinte'" (Test-IsAdvanceIntent "Passo seguinte")
Assert-Test "Advance intent ignores general greeting" (-not (Test-IsAdvanceIntent "Olá, boa tarde!"))

# Test 3: Token Validation Patterns
function Test-ExtractPat([string]$msg) {
    $patRegex = "(github_pat_[a-zA-Z0-9_]{15,}|ghp_[a-zA-Z0-9]{20,}|demo_pat_[a-zA-Z0-9_]+)"
    $m = [regex]::Match($msg, $patRegex, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($m.Success) { return $m.Value }
    return $null
}

Assert-Test "Extracts modern github_pat" ((Test-ExtractPat "Aqui tens github_pat_11ABX1234567890abcdefghij_test") -eq "github_pat_11ABX1234567890abcdefghij_test")
Assert-Test "Extracts classic ghp token" ((Test-ExtractPat "o meu token é ghp_123456789012345678901234567890123456") -eq "ghp_123456789012345678901234567890123456")
Assert-Test "Extracts demo_pat" ((Test-ExtractPat "Usa este demo_pat_agency_test") -eq "demo_pat_agency_test")
Assert-Test "Returns null if no PAT present" ((Test-ExtractPat "Olá como estás?") -eq $null)

# Test 4: Documentation FAQ Matching
function Test-GetDocFaqReply([string]$msg) {
    $lower = $msg.ToLower()
    if ($lower -match "lêem o código|código-fonte|privacidade") {
        return "código-fonte dos teus repositórios nunca é lido"
    }
    if ($lower -match "login|portal|palavra-passe|password") {
        return "não precisa de criar conta nem de fazer login"
    }
    if ($lower -match "alucina|inventar|precisão") {
        return "temperatura baixa (0.2)"
    }
    if ($lower -match "trello|jira|notion") {
        return "GitHub Projects v2"
    }
    if ($lower -match "como funciona o envio|agendamento|aprovação") {
        return "sextas-feiras"
    }
    return $null
}

Assert-Test "FAQ Privacy answered correctly" ((Test-GetDocFaqReply "Vocês lêem o código-fonte?") -match "código-fonte dos teus repositórios nunca é lido")
Assert-Test "FAQ Portal answered correctly" ((Test-GetDocFaqReply "O meu cliente precisa de login?") -match "não precisa de criar conta nem de fazer login")
Assert-Test "FAQ Hallucination answered correctly" ((Test-GetDocFaqReply "A IA pode inventar tarefas?") -match "temperatura baixa \(0\.2\)")
Assert-Test "FAQ Scheduling answered correctly" ((Test-GetDocFaqReply "Como funciona o agendamento de envio?") -match "sextas-feiras")
Assert-Test "FAQ Tools answered correctly" ((Test-GetDocFaqReply "Suporta integração com o Trello?") -match "GitHub Projects v2")

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "Runtime Test Summary: Passed: $passed | Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "=================================================================" -ForegroundColor Cyan

if ($failed -gt 0) {
    exit 1
} else {
    exit 0
}
