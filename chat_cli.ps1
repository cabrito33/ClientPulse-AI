# ==============================================================================
# ClientPulse AI — Interactive CLI Tester for PulseBot (Onboarding Assistant)
# File: chat_cli.ps1
# ==============================================================================

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " PulseBot — Chatbot de Onboarding & FAQ (Modo Interativo)       " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Comandos especiais:" -ForegroundColor Yellow
Write-Host " - 'sair' para terminar a conversa" -ForegroundColor DarkGray
Write-Host " - 'limpar' para reiniciar o estado do chat" -ForegroundColor DarkGray
Write-Host "-----------------------------------------------------------------`n" -ForegroundColor Cyan

$isConnected = $false
$connectedUser = $null

function Get-BotReply([string]$inputMsg) {
    $lower = $inputMsg.ToLower().Trim()

    # 1. Scope Guardrail
    $outOfScopePattern = "(receita\s+de|bolo\s+de|como\s+(cozinhar|fazer\s+pão|fazer\s+arroz)|quicksort|bubble\s*sort|fibonacci|árvore\s+binária|arvore\s+binaria|algoritmo\s+em\s+(c\+\+|java|python|c#|rust)|código\s+para\s+inverter\s+uma\s+string|capital\s+da\s+(frança|espanha|alemanha|itália)|previsão\s+do\s+tempo|tempo\s+amanhã|clima\s+em|quem\s+ganhou\s+o\s+jogo|futebol|benfica|porto|sporting|poema\s+sobre|história\s+de\s+amor|conta\s+uma\s+anedota|piada|política|eleições|presidente|escreve\s+um\s+ensaio\s+sobre)"
    if ([regex]::IsMatch($inputMsg, $outOfScopePattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        return @{
            Reply = "O meu papel é ajudar-te exclusivamente na configuração do ClientPulse AI, na integração com o GitHub Projects e na resposta a dúvidas sobre o produto. Como posso ajudar com o teu onboarding ou com a tua conta?"
            Action = "out_of_scope_refusal"
        }
    }

    # 2. PAT Detection & Validation
    $patRegex = "(github_pat_[a-zA-Z0-9_]{15,}|ghp_[a-zA-Z0-9]{20,}|demo_pat_[a-zA-Z0-9_]+)"
    $m = [regex]::Match($inputMsg, $patRegex, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($m.Success) {
        $token = $m.Value
        if ($token -match "invalid|expired") {
            return @{
                Reply = "Não consegui validar esse token do GitHub (401 Bad Credentials). Verifica se tem permissão 'read:project' e tenta novamente."
                Action = "pat_failed"
            }
        }
        $script:isConnected = $true
        $script:connectedUser = "maria-agency"
        return @{
            Reply = "Excelente! Validei o teu token com sucesso para o utilizador @maria-agency. A ligação ao GitHub está confirmada! Agora no Passo 2, vamos mapear as colunas do teu quadro (Done, In Progress, Blocked). Tens alguma dúvida sobre como funciona o mapeamento?"
            Action = "pat_validated"
        }
    }

    # 3. Advance Intent Gate (Criterion 3)
    $advancePattern = "(avançar|avanca|avancar|passo\s+seguinte|proximo\s+passo|próximo\s+passo|passo\s+2|step\s+2|passo\s+3|step\s+3|ir\s+para\s+as?\s+colunas|mapear\s+colunas|criar\s+(o\s+)?(primeiro\s+)?cliente|perfil\s+de\s+cliente|pular|saltar|skip|continuar|posso\s+avançar|posso\s+avancar|next\s+step)"
    if (-not $script:isConnected -and [regex]::IsMatch($inputMsg, $advancePattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        return @{
            Reply = "Para avançar para o mapeamento de colunas e para a criação do primeiro cliente, é obrigatório validar primeiro a ligação ao GitHub. Por favor, introduz o teu Personal Access Token (PAT) com permissão 'read:project' para verificarmos a conexão."
            Action = "blocked_requires_pat"
        }
    }

    # 4. FAQ Matchers (Criterion 1 & 2)
    if ($lower -match "lêem o código|código-fonte|privacidade|repositório") {
        return @{
            Reply = "Não! Por motivos éticos e de segurança, o ClientPulse AI acede exclusivamente aos metadados do GitHub Projects v2 (títulos das tarefas, colunas, etiquetas e responsáveis). O código-fonte dos teus repositórios nunca é lido, clonado nem armazenado."
            Action = "faq_answered"
        }
    }
    if ($lower -match "login|portal|palavra-passe|password|precisa de login") {
        return @{
            Reply = "O teu cliente não precisa de criar conta nem de fazer login. Cada relatório enviado por e-mail contém uma ligação segura com um token UUIDv4 exclusivo. O Portal do Cliente é uma vista web moderna, simples e só de leitura com o relatório da semana, histórico e gráfico de tarefas por sprint."
            Action = "faq_answered"
        }
    }
    if ($lower -match "alucina|inventar|precisão") {
        return @{
            Reply = "O nosso motor utiliza o Google Gemini com temperatura baixa (0.2) e regras rigorosas anti-alucinação: a IA só sintetiza tarefas que existam de facto no quadro do GitHub. Além disso, o relatório fica em rascunho no dashboard para poderes rever e editar antes de o aprovar."
            Action = "faq_answered"
        }
    }
    if ($lower -match "trello|jira|notion") {
        return @{
            Reply = "No MVP atual, a única fonte de dados suportada é o GitHub Projects v2. Integrações com Trello, Notion e Jira estão planeadas como evolução futura pós-MVP."
            Action = "faq_answered"
        }
    }
    if ($lower -match "envio|agendamento|aprovação|sexta") {
        return @{
            Reply = "Por defeito, o ClientPulse AI compila os relatórios às sextas-feiras. O gestor recebe um aviso no Dashboard para rever o rascunho de 3 blocos e clicar em 'Aprovar e Enviar'. Se preferires automatizar a 100%, podes ativar o modo 'Bypass (Envio Direto)'."
            Action = "faq_answered"
        }
    }
    if ($lower -match "colunas|mapeamento|mapear") {
        if (-not $script:isConnected) {
            return @{
                Reply = "Para configurares o mapeamento de colunas, precisamos de validar primeiro a tua ligação ao GitHub. Introduz o teu Personal Access Token (PAT) com a permissão 'read:project'."
                Action = "blocked_requires_pat"
            }
        }
        return @{
            Reply = "Com o GitHub ligado (@maria-agency), no Passo 2 associas as colunas do teu board aos 3 estados do ClientPulse: 'Concluído' (O que foi feito), 'Em curso' (Próximos passos) e 'Bloqueado' (Atenção e Bloqueios). Queres avançar para a criação do cliente?"
            Action = "guide_columns"
        }
    }
    if ($lower -match "cliente|perfil|tom|idioma") {
        if (-not $script:isConnected) {
            return @{
                Reply = "Antes de criar o perfil do teu primeiro cliente, precisamos de validar a ligação ao GitHub. Por favor, introduz o teu Personal Access Token."
                Action = "blocked_requires_pat"
            }
        }
        return @{
            Reply = "No Passo 3 defines o nome da empresa ou cliente, o e-mail de destino, o idioma (PT ou EN) e o tom do relatório (Formal, Executivo ou Casual). A IA adapta automaticamente a escrita ao perfil escolhido!"
            Action = "guide_client"
        }
    }

    # Default greeting
    if ($script:isConnected) {
        return @{
            Reply = "A tua ligação ao GitHub está ativa (@$script:connectedUser). Estamos no Passo 2 (Mapeamento de Colunas) e Passo 3 (Perfil de Cliente). Como posso ajudar?"
            Action = "guide_columns"
        }
    } else {
        return @{
            Reply = "Olá! Sou o PulseBot. Para começarmos o setup do ClientPulse AI, introduz o teu Personal Access Token (PAT) do GitHub com permissão 'read:project'. Se tiveres dúvidas sobre segurança, o portal ou funcionamento, diz-me!"
            Action = "awaiting_pat"
        }
    }
}

Write-Host "PulseBot: Olá! Sou o PulseBot. Como posso ajudar no teu onboarding do ClientPulse AI?`n" -ForegroundColor Green

while ($true) {
    $userInput = Read-Host "Tu"
    if ([string]::IsNullOrWhiteSpace($userInput)) { continue }
    if ($userInput -eq "sair" -or $userInput -eq "exit") {
        Write-Host "`nAté breve!" -ForegroundColor Cyan
        break
    }
    if ($userInput -eq "limpar") {
        $isConnected = $false
        $connectedUser = $null
        Clear-Host
        Write-Host "Estado reiniciado.`n" -ForegroundColor DarkYellow
        continue
    }

    $res = Get-BotReply $userInput
    Write-Host "`nPulseBot: $($res.Reply)" -ForegroundColor Green
    Write-Host "[Ação detetada: $($res.Action) | GitHub: $(if ($isConnected) { 'Conectado (@' + $connectedUser + ')' } else { 'Desconectado' })]`n" -ForegroundColor DarkGray
}
