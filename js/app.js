     

     /* ============================================================
       SISTEMA DE AUTENTICAÇÃO
       ============================================================ */

    async function fazerLogin() {
    const email = document.getElementById('log-email').value.trim().toLowerCase();
    const senha = document.getElementById('log-senha').value.trim();
    const errorMsg = document.getElementById('login-error');

    try {
        const senhaHash = await gerarHash(senha);

        const { data: usuario, error } = await supabaseClient
            .from('usuarios')
            .select('*')
            .eq('email', email)
            .eq('senha', senhaHash)
            .eq('ativo', true)
            .maybeSingle();

        if (error) throw error;

        if (usuario) {
            currentUser = usuario;
            localStorage.setItem('sigti_user', JSON.stringify(usuario));

            // --- AQUI ESTÁ A SOLUÇÃO DO NOME ---
            document.getElementById('user-name').innerText = usuario.nome;
            document.getElementById('user-role').innerText = usuario.is_ti ? "Administrador TI" : "Colaborador";
            
            // Mostra o menu de admin se for TI
            if (usuario.is_ti) {
                document.getElementById('admin-menu').style.display = 'block';
            }

            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('sidebar').style.display = 'flex';
            document.getElementById('app').style.display = 'block';
            
            navegar('solicitacoes');
        } else {
            errorMsg.style.display = 'block';
        }

    } catch (err) {
        console.error("Erro no Login:", err);
        alert("Erro técnico: " + err.message);
    }
}

async function gerarHash(texto) {
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

        /* ============================================================
           ROTEAMENTO E NAVEGAÇÃO
           ============================================================ */
    function navegar(tela, el) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    if (el && el.classList) { el.classList.add('active'); }

    const container = document.getElementById('view-container');
    if (!container) return;

    switch(tela) {
        case 'solicitacoes':
            renderSolicitacoes();
            break;
        case 'estoque':
            renderEstoque();
            break;
        case 'usuarios':
            renderUsuarios();
            break;
        case 'termos':
            renderTermos();
            break;
        case 'historico':
            renderHistorico();
            break;
        case 'perfil': // <--- O "pulo do gato" está aqui
            renderPerfil();
            break;
    }
}

        /* ============================================================
           TELA: ORDENS DE SERVIÇO
           ============================================================ */
        async function renderSolicitacoes() {
        const container = document.getElementById('view-container');
        const resumo = await buscarResumoEstoque();

    container.innerHTML = `
        <div class="header-page">
            <h1>Ordens de Serviço</h1>
            <button onclick="abrirModalOS()">+ Nova Solicitação</button>
        </div>

        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <span class="badge" style="background: ${resumo.Notebook > 0 ? '#dcfce7' : '#fee2e2'}; color: ${resumo.Notebook > 0 ? '#166534' : '#991b1b'}; padding: 8px 12px;">
                💻 Notebooks: ${resumo.Notebook > 0 ? resumo.Notebook + ' disponíveis' : 'Indisponível no momento'}
            </span>
            <span class="badge" style="background: ${resumo.Projetor > 0 ? '#dcfce7' : '#fee2e2'}; color: ${resumo.Projetor > 0 ? '#166534' : '#991b1b'}; padding: 8px 12px;">
                📽️ Projetores: ${resumo.Projetor > 0 ? resumo.Projetor + ' disponíveis' : 'Indisponível no momento'}
            </span>
        </div>
        
        <div class="card" id="form-os" style="display:none; margin-bottom:32px; border-top: 4px solid var(--accent);">
            <h3 style="margin-bottom:20px;">Detalhes do Pedido</h3>
            <div class="form-grid">
                <div>
                    <label>Tipo de Equipamento/Serviço</label>
                    <select id="os-tipo">
                        <option value="Notebook">Notebook ${resumo.Notebook === 0 ? '⚠️ (Sem estoque)' : ''}</option>
                        <option value="Projetor">Projetor ${resumo.Projetor === 0 ? '⚠️ (Sem estoque)' : ''}</option>
                        <option value="Manutenção">Manutenção / Assistência</option>
                        <option value="Outros">Acessórios / Outros</option>
                    </select>
                </div>
                <div style="grid-column: span 2">
                    <label>Justificativa ou Descrição do Problema</label>
                    <input type="text" id="os-desc" placeholder="Ex: Uso em aula de laboratório ou Tecla X parou de funcionar">
                </div>
            </div>
            <div style="display:flex; gap:10px;">
                <button id="btn-enviar-os" onclick="enviarOS()">Confirmar Abertura</button>
                <button class="outline" onclick="abrirModalOS()">Cancelar</button>
            </div>
        </div>

        <div class="card">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th><th>Data</th><th>Colaborador</th><th>Tipo</th><th>Status</th><th>Ação</th>
                        </tr>
                    </thead>
                    <tbody id="lista-os"></tbody>
                </table>
            </div>
        </div>
    `;
    carregarTabelaOS();
}

    function abrirModalOS() {
            const f = document.getElementById('form-os');
            f.style.display = f.style.display === 'none' ? 'block' : 'none';
        }


        async function buscarResumoEstoque() {
            try {
            const { data: itens, error } = await supabaseClient
            .from('estoque')
            .select('tipo, status');

            if (error) throw error;

            return {
            Notebook: itens.filter(i => i.tipo === 'Notebook' && i.status === 'disponivel').length,
            Projetor: itens.filter(i => i.tipo === 'Projetor' && i.status === 'disponivel').length
        };
        } catch (err) {
        return { Notebook: 0, Projetor: 0 };
             }
}


    async function enviarOS() {

    const btn = document.getElementById('btn-enviar-os');

    if (btn.disabled) return; // evita clique duplo

    btn.disabled = true;
    btn.innerText = "Enviando...";

    const tipo = document.getElementById('os-tipo').value;
    const desc = document.getElementById('os-desc').value;

    if (!desc) {
        alert("Descreva o problema!");
        btn.disabled = false;
        btn.innerText = "Confirmar Abertura";
        return;
    }

    try {

        const { error } = await supabaseClient
            .from('solicitacoes')
            .insert([{
                usuario_id: currentUser.id,
                usuario_nome: currentUser.nome,
                tipo: tipo,
                descricao: desc,
                status: 'pendente'
            }]);

        if (error) throw error;

        await supabaseClient.functions.invoke('enviar-email-os', {
            body: {
                usuario_nome: currentUser.nome,
                descricao: desc
            }
        });

        alert("Solicitação enviada com sucesso!");

        fecharModal();
        renderSolicitacoes();

    } catch (err) {
        console.error(err);
        alert("Erro ao enviar solicitação.");

        btn.disabled = false;
        btn.innerText = "Confirmar Abertura";
    }
}

        /* ============================================================
           LÓGICA DE APROVAÇÃO (ID 2026001)
           ============================================================ */

     async function processarOS(id, uid, tipo, nome) {
    try {

        // 1️⃣ Buscar OS
        const { data: os, error: errOS } = await supabaseClient
            .from('solicitacoes')
            .select('*')
            .eq('id', id)
            .single();

        if (errOS) throw new Error("Erro ao buscar OS");

        const descricaoOriginalDaOS = os.descricao;
        let patrimonio = "SERVIÇO";

        // 🔧 MANUTENÇÃO
        if (tipo === 'Manutenção') {

            // Se estiver pendente → colocar em andamento
            if (os.status === 'pendente') {
                await supabaseClient
                    .from('solicitacoes')
                    .update({ status: 'em_andamento' })
                    .eq('id', id);

                alert("OS colocada em andamento.");
                navegar('solicitacoes');
                return;
            }

            // Se já estiver em andamento → concluir e gerar termo
            if (os.status !== 'em_andamento') {
                alert("Essa OS já foi finalizada.");
                return;
            }
        }

        // 🖥️ Notebook ou Projetor → buscar estoque
        if (tipo === 'Notebook' || tipo === 'Projetor') {

            const { data: estoque, error: errE } = await supabaseClient
                .from('estoque')
                .select('*')
                .eq('tipo', tipo)
                .eq('status', 'disponivel');

            if (errE) throw new Error("Erro ao buscar estoque");

            if (!estoque || estoque.length === 0) {
                alert(`ERRO: Não há ${tipo} disponível no estoque.`);
                return;
            }

            const listaCodigos = estoque.map(i => i.patrimonio);
            const input = prompt(`Selecione um patrimônio disponível:\n${listaCodigos.join(" | ")}`);

            if (!input || !listaCodigos.includes(input)) {
                alert("Patrimônio inválido.");
                return;
            }

            patrimonio = input;

            const { error: errPatch } = await supabaseClient
                .from('estoque')
                .update({ status: 'emprestado' })
                .eq('patrimonio', patrimonio);

            if (errPatch) throw new Error("Erro ao atualizar estoque");
        }

        // 📌 3️⃣ GERAR ID SEQUENCIAL
        const anoAtual = new Date().getFullYear();

        const { data: todosTermos, error: errT } = await supabaseClient
            .from('termos')
            .select('solicitacao_id');

        if (errT) throw new Error("Erro ao buscar termos");

        const termosDoAno = todosTermos.filter(t =>
            t.solicitacao_id &&
            t.solicitacao_id.toString().startsWith(anoAtual.toString())
        );

        let proximoNumero = 1;

        if (termosDoAno.length > 0) {
            const sequenciais = termosDoAno.map(t => {
                const numero = t.solicitacao_id.toString().substring(4);
                return parseInt(numero) || 0;
            });
            proximoNumero = Math.max(...sequenciais) + 1;
        }

        const idCustom = `${anoAtual}${proximoNumero.toString().padStart(3, '0')}`;

        // 📝 4️⃣ SALVAR TERMO
        const { error: errSalvar } = await supabaseClient
            .from('termos')
            .insert([{
                solicitacao_id: idCustom,
                usuario_id: uid,
                usuario_nome: nome,
                equipamento_cod: patrimonio,
                tipo: tipo,
                descricao: descricaoOriginalDaOS,
                data_geracao: new Date().toLocaleDateString('pt-BR')
            }]);

        if (errSalvar) throw new Error("Erro ao gerar termo no banco");

        // 🔄 5️⃣ Atualizar status da OS
        const novoStatus = tipo === 'Manutenção' ? 'concluido' : 'aprovado';

        const { error: errFinal } = await supabaseClient
            .from('solicitacoes')
            .update({ status: novoStatus })
            .eq('id', id);

        if (errFinal) throw new Error("Erro ao finalizar solicitação");

        alert(`Ordem de Serviço #${idCustom} gerada com sucesso!`);
        navegar('solicitacoes');

    } catch (erro) {
        console.error("Erro no processamento:", erro);
        alert("Erro técnico: " + erro.message);
    }
}
        async function carregarTabelaOS() {
            const { data: lista, error } = await supabaseClient
        .from('solicitacoes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro ao carregar OS:", error);
        return;
    }

    const tbody = document.getElementById('lista-os');
    if (!tbody) return;

   tbody.innerHTML = lista.map(os => {

    let botao = '---';

    if (currentUser.is_ti) {

        if (os.status === 'pendente') {
            botao = `
                <button onclick="processarOS('${os.id}', '${os.usuario_id}', '${os.tipo}', '${os.usuario_nome}')" 
                    style="padding:6px 12px; font-size:12px;">
                    Iniciar
                </button>`;
        }

        else if (os.status === 'em_andamento') {
            botao = `
                <button onclick="processarOS('${os.id}', '${os.usuario_id}', '${os.tipo}', '${os.usuario_nome}')" 
                    style="padding:6px 12px; font-size:12px;">
                    Concluir
                </button>`;
        }
    }

    return `
        <tr>
            <td>#${os.id}</td>
            <td>${new Date(os.created_at || Date.now()).toLocaleDateString()}</td>
            <td>${os.usuario_nome}</td>
            <td><b>${os.tipo}</b></td>
            <td><span class="badge status-${os.status}">${os.status}</span></td>
            <td>${botao}</td>
        </tr>
    `;
}).join('');
}
/* ============================================================
   TELA: GESTÃO DE ESTOQUE
   ============================================================ */
async function renderEstoque() {
    const container = document.getElementById('view-container');
    container.innerHTML = `
        <div class="header-page">
            <h1>Controle de Estoque</h1>
        </div>
        <div class="card">
            <h3 style="margin-bottom:15px">Cadastrar Novo Item</h3>
            <div class="form-grid">
                <input type="text" id="est-pat" placeholder="Número do Patrimônio">
                <select id="est-tipo">
                    <option>Notebook</option>
                    <option>Projetor</option>
                    <option>Monitor</option>
                </select>
                <input type="text" id="est-mod" placeholder="Modelo / Marca">
                <button onclick="cadastrarEstoque()">Adicionar ao Banco</button>
            </div>
        </div>
        <div class="card">
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>Patrimônio</th><th>Tipo</th><th>Modelo</th><th>Status</th></tr>
                    </thead>
                    <tbody id="lista-estoque"></tbody>
                </table>
            </div>
        </div>
    `;
    carregarTabelaEstoque();
}

async function cadastrarEstoque() {
    const p = document.getElementById('est-pat').value;
    const t = document.getElementById('est-tipo').value;
    const m = document.getElementById('est-mod').value;

    if (!p) return alert("Patrimônio obrigatório.");

    const { error } = await supabaseClient
        .from('estoque')
        .insert([{
            patrimonio: p,
            tipo: t,
            modelo: m,
            status: 'disponivel'
        }]);

    if (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar no banco. Verifique se o patrimônio já existe.");
    } else {
        alert("Item cadastrado!");
        document.getElementById('est-pat').value = '';
        document.getElementById('est-mod').value = '';
        carregarTabelaEstoque();
    }
} 
async function carregarTabelaEstoque() {
    const { data: dados, error } = await supabaseClient
        .from('estoque')
        .select('*')
        .order('patrimonio', { ascending: true });

    if (error) {
        console.error("Erro ao carregar:", error);
        return;
    }

    const container = document.getElementById('lista-estoque');
    if (!container) return;

    container.innerHTML = dados.map(i => `
        <tr>
            <td>${i.patrimonio}</td>
            <td>${i.tipo}</td>
            <td>${i.modelo || '---'}</td>
            <td>
                <span class="badge status-${i.status === 'disponivel' ? 'aprovado' : 'uso'}">
                    ${i.status}
                </span>
            </td>
        </tr>
    `).join('');
}

        /* ============================================================
           TELA: GESTÃO DE USUÁRIOS
           ============================================================ */
        async function renderUsuarios() {
            const container = document.getElementById('view-container');
            container.innerHTML = `
                <h1>Gestão de Pessoas</h1>
                
                <div class="card">
                    <h3>Novo Acesso</h3>
                    <div class="form-grid">
                        <input type="text" id="u-nome" placeholder="Nome Completo">
                        <input type="number" id="u-mat" placeholder="Matrícula">
                        <input type="email" id="u-email" placeholder="E-mail Corporativo" autocomplete="new-password">
                        <input type="password" id="u-senha" placeholder="Senha Provisória" autocomplete="new-password">
                        <select id="u-ti">
                            <option value="false">Colaborador</option>
                            <option value="true">TI / Admin</option>
                        </select>
                        <button onclick="salvarUsuario()">Criar Acesso</button>
                    </div>
                </div>

                <div class="card">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 15px; align-items: center; gap: 10px;">
                        <h3 style="margin:0">Lista de Colaboradores</h3>
                        <label style="font-size: 12px; color: #64748b; cursor: pointer;">
                            <input type="checkbox" id="chk-mostrar-inativos" onchange="carregarTabelaUsuarios()"> 
                            Exibir Desativados
                        </label>
                    </div>
                    
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>MAT</th>
                                    <th>Nome</th>
                                    <th>E-mail</th>
                                    <th>Perfil</th>
                                    <th>Status</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody id="lista-usuarios"></tbody>
                        </table>
                    </div>
                </div>
            `;
            carregarTabelaUsuarios();
        }

        async function salvarUsuario() {
            const n = document.getElementById('u-nome').value.trim();
            const m = document.getElementById('u-mat').value.trim();
            const e = document.getElementById('u-email').value.trim().toLowerCase();
            const s = document.getElementById('u-senha').value.trim();
            const ti = document.getElementById('u-ti').value === "true";

            try {

        // 🔒 VALIDAÇÕES PRIMEIRO
        if (!n || !m || !e || !s) {
            alert("Preencha todos os campos obrigatórios!");
            return;
        }

        if (!e.includes("@")) {
            alert("Email inválido.");
            return;
        }

        if (s.length < 6) {
            alert("Senha deve ter no mínimo 6 caracteres.");
            return;
        }

        // 🔐 Agora sim gera hash
        const senhaHash = await gerarHash(s);

        const { error } = await supabaseClient
            .from('usuarios')
            .insert([{
                nome: n,
                matricula: m,
                email: e,
                senha: senhaHash,
                is_ti: ti,
                ativo: true
            }]);

        if (error) throw error;

        alert("Usuário criado com sucesso!");
        renderUsuarios();

    } catch (err) {
        console.error("Erro ao salvar usuário:", err);
        alert("Erro ao salvar usuário: " + err.message);
    }
}

    async function carregarTabelaUsuarios() {
    const mostrarInativos = document.getElementById('chk-mostrar-inativos').checked;
    const tbody = document.getElementById('lista-usuarios');
    
    let query = supabaseClient.from('usuarios').select('*');
    if (!mostrarInativos) query = query.eq('ativo', true);
    
    const { data: lista, error } = await query.order('nome');
    if (error) return;

    tbody.innerHTML = lista.map(u => `
        <tr style="opacity: ${u.ativo ? '1' : '0.6'}">
            <td>${u.matricula || '-'}</td>
            <td>${u.nome}</td>
            <td>${u.email}</td>
            <td>${u.is_ti ? 'TI' : 'Colaborador'}</td>
            <td>
    ${u.ativo ? 
        // Se está ativo, mostra botão de DESATIVAR
        `<button onclick="alternarStatusUsuario('${u.id}', true)" 
                style="background: #fee2e2; color: #991b1b; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
            Desativar
        </button>` 
        : 
        // Se está inativo, mostra botão de REATIVAR
        `<button onclick="alternarStatusUsuario('${u.id}', false)" 
                style="background: #dcfce7; color: #166534; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
            Reativar
        </button>`
    }
</td>
        </tr>
    `).join('');
}

    async function renderPerfil() {
    const container = document.getElementById('view-container');
    
    container.innerHTML = `
        <h1>Meu Perfil</h1>
        
        <div class="card" style="max-width: 600px;">
            <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 25px;">
                <div style="width: 70px; height: 70px; background: var(--primary); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: bold;">
                    ${currentUser.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h2 style="margin:0">${currentUser.nome}</h2>
                    <p style="margin:0; color: #64748b;">${currentUser.is_ti ? 'Equipe de TI / Administrador' : 'Colaborador'}</p>
                </div>
            </div>

            <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
                <div>
                    <label style="font-size: 12px; color: #64748b;">Matrícula</label>
                    <input type="text" value="${currentUser.matricula}" disabled style="background: #f1f5f9;">
                </div>
                <div>
                    <label style="font-size: 12px; color: #64748b;">E-mail Corporativo</label>
                    <input type="text" value="${currentUser.email}" disabled style="background: #f1f5f9;">
                </div>
            </div>

            <hr style="margin: 30px 0; border: 0; border-top: 1px solid #e2e8f0;">

            <h3>Alterar Senha</h3>
            <p style="font-size: 13px; color: #64748b; margin-bottom: 15px;">Deseja atualizar sua senha de acesso? Preencha os campos abaixo.</p>
            
            <div style="display: flex; flex-direction: column; gap: 15px; max-width: 350px;">
                <input type="password" id="p-senha-nova" placeholder="Nova Senha (mín. 6 dígitos)">
                <input type="password" id="p-senha-confirma" placeholder="Confirme a Nova Senha">
                <button onclick="atualizarSenhaPerfil()" style="width: fit-content; padding: 10px 30px;">Atualizar Senha</button>
            </div>
        </div>
    `;
}

      async function atualizarSenhaPerfil() {
    const nova = document.getElementById('p-senha-nova').value.trim();
    const confirma = document.getElementById('p-senha-confirma').value.trim();

    if (nova.length < 6) return alert("Mínimo 6 caracteres.");
    if (nova !== confirma) return alert("Senhas não coincidem.");

    try {
        const novaHash = await gerarHash(nova);
        
        // 🔍 TESTE 1: Ver o que tem dentro do currentUser no console
        console.log("DEBUG - Dados do Usuário Logado:", currentUser);

        if (!currentUser || !currentUser.email) {
            alert("Sessão perdida. Por favor, saia e entre novamente no sistema.");
            return;
        }

        const emailBusca = currentUser.email.trim().toLowerCase();

        // 🔍 TESTE 2: Tentar atualizar usando o ID e o EMAIL ao mesmo tempo (um dos dois deve bater)
        const { data, error } = await supabaseClient
            .from('usuarios')
            .update({ senha: novaHash })
            .or(`id.eq.${currentUser.id},email.eq.${emailBusca}`) 
            .select();

        if (error) throw error;

        if (data && data.length > 0) {
            alert("SENHA ATUALIZADA COM SUCESSO!");
            
            // Atualiza localmente
            currentUser.senha = novaHash;
            localStorage.setItem('sigti_user', JSON.stringify(currentUser));

            document.getElementById('p-senha-nova').value = '';
            document.getElementById('p-senha-confirma').value = '';
        } else {
            // 🔍 TESTE 3: Se falhou, vamos listar no console o que o banco tem
            const { data: todos } = await supabaseClient.from('usuarios').select('email, id').limit(5);
            console.log("DEBUG - Primeiros e-mails no banco:", todos);
            
            alert("Ainda não encontrou. Verifique o F12 (Console) para ver os dados técnicos.");
        }

    } catch (err) {
        console.error("Erro técnico detalhado:", err);
        alert("Erro: " + err.message);
    }
}


   /* ============================================================
   TELA: MEUS TERMOS (SUPABASE)
   ============================================================ */
async function renderTermos() {
    const container = document.getElementById('view-container');

    // Busca no Supabase
    let query = supabaseClient.from('termos').select('*');
    if (!currentUser.is_ti) {
        query = query.eq('usuario_id', currentUser.id);
    }

    const { data: lista, error } = await query.order('created_at', { ascending: false });

    if (error) return console.error("Erro Supabase:", error);

    container.innerHTML = `
        <div class="header-page"><h1>Meus Termos e Documentos</h1></div>
        <div class="card">
            <table class="table-custom">
                <thead>
                    <tr><th>Nº Termo</th><th>Tipo</th><th>Data</th><th>Ações</th></tr>
                </thead>
                <tbody>
                    ${lista && lista.length > 0 ? lista.map(t => `
                        <tr>
                            <td><b>#${t.solicitacao_id}</b></td>
                            <td>${t.tipo} ${t.equipamento_cod ? `(${t.equipamento_cod})` : ''}</td>
                            <td>${t.data_geracao}</td>
                            <td><button class="btn-outline" onclick="visualizarTermo('${t.id}')">📄 Visualizar / Imprimir</button></td>
                        </tr>
                    `).join('') : '<tr><td colspan="4">Nenhum documento encontrado.</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

async function renderHistorico() {
    const container = document.getElementById('view-container');

    // Busca no Supabase todas as movimentações
    const { data: dados, error } = await supabaseClient
        .from('termos')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return console.error(error);

    container.innerHTML = `
        <div class="header-page"><h1>Auditoria de Empréstimos</h1></div>
        <div class="card">
            <div class="table-container">
                <table>
                    <thead><tr><th>Usuário</th><th>Patrimônio</th><th>Status</th><th>Ação</th></tr></thead>
                    <tbody>
                        ${dados && dados.length > 0 ? dados.map(t => `
                            <tr>
                                <td>${t.usuario_nome}</td>
                                <td>${t.equipamento_cod || 'N/A'}</td>
                                <td>
                                    <span class="badge ${t.devolvido ? 'status-aprovado' : 'status-pendente'}">
                                        ${t.devolvido ? 'Devolvido' : 'Em Posse'}
                                    </span>
                                </td>
                                <td>
                                    ${(!t.devolvido && t.equipamento_cod && t.equipamento_cod !== 'N/A - SERVIÇO') ? 
                                        `<button onclick="confirmarDevolucao('${t.id}', '${t.equipamento_cod}')" style="background:#f59e0b; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Dar Baixa</button>` 
                                        : '---'}
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="4">Sem registros.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function visualizarTermo(id) {
    // Busca o termo específico no Supabase
    const { data: t, error } = await supabaseClient
        .from('termos')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !t) return alert("Erro ao carregar detalhes do termo.");

    let tituloTermo = "TERMO DE RESPONSABILIDADE";
    let corpoTexto = "";

    // LÓGICA DE TEXTO POR TIPO
            if (t.tipo === 'Notebook') {
                const acessorios = Array.isArray(t.acessorios) ? t.acessorios : [];
                const checkbox = (item) => acessorios.includes(item) ? `☑ ${item}` : `☐ ${item}`;
                 const nenhum = acessorios.length === 0 ? '☑ Nenhum' : '☐ Nenhum';

                corpoTexto = `
            <p style="margin:5px 0;">
            Eu, <b>${t.usuario_nome}</b>, matrícula nº <b>${t.matricula || '---'}</b>, 
            declaro que recebi em caráter de empréstimo um notebook pertencente à instituição, 
            registrado sob o nº de patrimônio <b>${t.equipamento_cod}</b>.
            </p>

            <p style="margin:5px 0;">
            Declaro estar ciente de que o equipamento permanecerá sob minha responsabilidade durante todo o período de utilização, comprometendo-me a:
            </p>

            <ul style="list-style:none; padding-left:0; margin:5px 0;">
            <li>• Utilizá-lo exclusivamente para fins institucionais, pedagógicos ou de extensão;</li>
            <li>• Não é permitida a instalação de softwares não lincenciados.</li>
            <li>• Zelar pela conservação e integridade do equipamento;</li>
            <li>• Comunicar imediatamente ao setor responsável qualquer dano, falha ou ocorrência anormal;</li>
            <li>• Devolver o equipamento imediatamente após o término da atividade para a qual foi solicitado.</li>
            </ul>

            <p style="margin:5px 0;"><b>Acessórios entregues juntamente com o equipamento:</b></p>

            <p style="margin:5px 0;">
                ${t.acessorios?.includes('Carregador') ? '☑' : '☐'} Carregador &nbsp;&nbsp;
                ${t.acessorios?.includes('Mouse') ? '☑' : '☐'} Mouse &nbsp;&nbsp;
                ${t.acessorios?.includes('Teclado') ? '☑' : '☐'} Teclado &nbsp;&nbsp;
                ${t.acessorios?.includes('Fone') ? '☑' : '☐'} Fone &nbsp;&nbsp;
                ${t.acessorios?.includes('Nenhum') ? '☑' : '☐'} Nenhum
                </p>

            
            <p style="margin:15px 0 5px 0;">______________________________________________</p>
            <p style="margin:0;"><b>Assinatura do solicitante</b></p>
                    <p style="margin:5px 0;">Santa Helena de Goiás, ${
            t.data_geracao 
            ? t.data_geracao.split('T')[0].split('-').reverse().join('/') 
            : new Date().toLocaleDateString('pt-BR')
        }</p>
            <p style="margin:15px 0 5px 0;"><b>Preenchimento obrigatório no ato da devolução (setor responsável)</b></p>

            <p style="margin:5px 0;">
            Após conferência técnica, declaro ter recebido o notebook de patrimônio nº 
            <b>${t.equipamento_cod}</b>, conforme descrito neste termo:
            </p>

                <p style="margin:5px 0;">
            ( ) Em conformidade&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            ( ) Com observações
            </p>

            <p style="margin:10px 0 3px 0;"><b>Observações:</b></p>
            <p style="margin:2px 0;">______________________________________________________________</p>
            

            <p style="margin:15px 0 5px 0;"><b>Responsável pela conferência: ____________________________________</b></p>
            

            
            `;

        } else if (t.tipo === 'Projetor') {

                    corpoTexto = `
                <p style="margin:5px 0;">
                Eu, <b>${t.usuario_nome}</b>, matrícula nº <b>${t.matricula || '---'}</b>, 
                declaro que recebi em caráter de empréstimo um projetor multimídia pertencente à instituição, 
                registrado sob o nº de patrimônio <b>${t.equipamento_cod}</b>.
                </p>

                <p style="margin:5px 0;">
                Declaro estar ciente de que o equipamento permanecerá sob minha responsabilidade durante todo o período de utilização, comprometendo-me a:
                </p>

                <ul style="list-style:none; padding-left:0; margin:5px 0;">
                <li>• Utilizá-lo exclusivamente para fins institucionais, pedagógicos ou de extensão;</li>
                <li>• Zelar pela conservação e integridade do equipamento;</li>
                <li>• Comunicar imediatamente ao setor responsável qualquer dano, falha ou ocorrência anormal;</li>
                <li>• Devolver o equipamento imediatamente após o término da atividade para a qual foi solicitado.</li>
                </ul>

                <p style="margin:5px 0;"><b>Acessórios entregues juntamente com o equipamento:</b></p>

                <p style="margin:5px 0;">
                    ${t.acessorios?.includes('Cabo HDMI') ? '☑' : '☐'} Cabo HDMI &nbsp;&nbsp;
                    ${t.acessorios?.includes('Cabo VGA') ? '☑' : '☐'} Cabo VGA &nbsp;&nbsp;
                    ${t.acessorios?.includes('Extensão') ? '☑' : '☐'} Extensão Elétrica
                    </p>               
                
                <p style="margin:15px 0 5px 0;">______________________________________________</p>
                <p style="margin:0;"><b>Assinatura do solicitante</b></p>
                <p style="margin:5px 0;">Santa Helena de Goiás, ${
                t.data_geracao 
                ? t.data_geracao.split('T')[0].split('-').reverse().join('/') 
                : new Date().toLocaleDateString('pt-BR')
            }</p>

                <p style="margin:15px 0 5px 0;"><b>Preenchimento obrigatório no ato da devolução (setor responsável)</b></p>

                <p style="margin:5px 0;">
                Após conferência técnica, declaro ter recebido o projetor multimídia de patrimônio nº 
                <b>${t.equipamento_cod}</b>, conforme descrito neste termo:
                </p>

                <p style="margin:3px 0;">  ( ) Em conformidade   
                ( ) Com observações</p>

                <p style="margin:10px 0 3px 0;"><b>Observações:</b></p>
                <p style="margin:2px 0;">______________________________________________________________</p>
                

                <p style="margin:15px 0 5px 0;"><b>Responsável pela conferência:</b>
                ____________________________________</p>

                               
                `;
        
    } else if (t.tipo.toLowerCase().includes('manuten')) { 

            tituloTermo = "ORDEM DE SERVIÇO TÉCNICO (OS)";

                    corpoTexto = `
                <p style="text-align:center; margin:5px 0;"><b>ORDEM DE SERVIÇO – ASSISTÊNCIA TEC.</b></p>

                <p style="margin:10px 0;">
                <b>Solicitante:</b> ${t.usuario_nome || '---'}, matrícula nº <b>${t.matricula || '---'}</b>
                </p>
              
                <p style="margin:5px 0;">Santa Helena de Goiás, ${
            t.data_geracao 
            ? t.data_geracao.split('T')[0].split('-').reverse().join('/') 
            : new Date().toLocaleDateString('pt-BR')
        }</p>
                <p style="margin:8px 0 3px 0;"><b>Descrição do serviço:</b></p>
                <p style="margin:5px 0;">${t.descricao || ''}</p>

                <p style="margin:15px 0 5px 0;"><b>Registro Técnico do Atendimento:</b></p>

                <p style="margin:2px 0;">______________________________________________________________</p>
                <p style="margin:2px 0;">______________________________________________________________</p>
                <p style="margin:2px 0;">______________________________________________________________</p>
                <p style="margin:2px 0;">______________________________________________________________</p>

                <p style="margin:10px 0 5px 0;"><b>Status do Atendimento:</b></p>

                <p style="margin:2px 0;">
                ( ) Concluído<br>
                ( ) Encaminhado para manutenção externa<br>
                ( ) Aguardando peças<br>
                ( ) Não constatado defeito
                </p>

                <p style="margin:20px 0 5px 0;">______________________________________________</p>
                <p style="margin:0;"><b>Responsável Técnico</b></p>
                     <p style="margin:5px 0;">Santa Helena de Goiás, ${
            t.data_geracao 
            ? t.data_geracao.split('T')[0].split('-').reverse().join('/') 
            : new Date().toLocaleDateString('pt-BR')
        }</p>           
                `;
                
} else { 
    // SEÇÃO DE ACESSÓRIOS / OUTROS (O "Coringa")
    
    tituloTermo = "REGISTRO DE SERVIÇO / ACESSÓRIOS";

    // Pega os dados com 'Proteção de Valor Vazio' (Se não achar no banco, usa o texto padrão)
    const solicitante = t.usuario_nome || t.solicitante || "Responsável pelo Setor";
    const acaoRealizada = t.descricao || t.observacao || t.justificativa || "Manutenção/Troca de periférico conforme solicitado.";
    
    // Data formatada direto para o texto
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const dataDocumento = t.data_geracao ? t.data_geracao.split(/[-T ]/).reverse().slice(-3).join('/') : dataAtual;

    corpoTexto = `
        <div style="text-align:center; margin-bottom: 20px;">
            <p><b>ORDEM DE SERVIÇO – ACESSÓRIOS E PERIFÉRICOS</b></p>
        </div>

        <p style="margin:10px 0;">
        <b>Solicitante:</b> ${t.usuario_nome || '---'}, matrícula nº <b>${t.matricula || '---'}</b>
        </p>
        <p style="margin: 10px 0;"><b>Descrição do Serviço:<br></b> ${acaoRealizada}</p>

        <p style="margin: 25px 0; line-height: 1.6;">
            Informamos a realização de manutenção, configuração ou troca de acessórios/periféricos técnicos para assegurar a continuidade das atividades no setor.
        </p>

        <p style="margin: 40px 0;">Santa Helena de Goiás, ${dataDocumento}</p>

        <br><br>
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 50px;">
            <div style="border-top: 1px solid #000; width: 300px; text-align: center; padding-top: 8px;">
                
                Assinatura do Solicitante
            </div>
        </div>
    `;
}


    const modal = document.getElementById('modal-termo');
    const printArea = document.getElementById('print-area');

    // Monta o modal
    // Ajuste estas medidas se o texto ficar muito em cima ou muito embaixo
    const margemSuperior = "4.5cm"; // Espaço para o cabeçalho da imagem
    const margemInferior = "2.5cm"; // Espaço para o rodapé da imagem

    printArea.innerHTML = `
        <div class="no-print" style="margin-bottom: 25px; display: flex; justify-content: space-between; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <button class="secondary" onclick="fecharModal()">⬅️ Voltar ao Sistema</button>
            <button id="btn-imprimir" style="background: #059669; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer;">
                🖨️ Imprimir Documento Agora
            </button>
        </div>

        <div id="printable-content" style="
            width: 21cm; 
            min-height: 29.7cm; 
            margin: 0 auto; 
            background-image: url('timbrado.jpeg'); 
            background-size: contain; 
            background-repeat: no-repeat; 
            background-position: center;
            padding: ${margemSuperior} 2cm ${margemInferior} 2cm; 
            box-sizing: border-box;
            font-family: 'Arial', sans-serif;
            position: relative;
        ">
            <div style="text-align: right; margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 14pt;">${tituloTermo}</h3>
                <p style="margin: 0; font-size: 12pt; color: red;"><b>Nº OS: ${t.solicitacao_id}</b></p>
            </div>

            <div style="font-size: 11pt; line-height: 1.6; text-align: justify;">
                ${corpoTexto}
            </div>
        </div>
    `;

    // Mostra modal
    modal.style.display = 'flex';

    // Configura impressão
    document.getElementById('btn-imprimir').onclick = function() {
    // 1. Pegamos o conteúdo do HTML
    let conteudoOriginal = document.getElementById('printable-content').innerHTML;

    // 2. FUNÇÃO INTERNA PARA FORMATAR (Garante que funcione aqui dentro)
    const converterData = (str) => {
        if (!str) return '';
        // Se a data vier com hífen (2026-03-07), nós invertemos
        if (str.includes('-')) {
            const p = str.split(/[-T ]/);
            return `${p[2]}/${p[1]}/${p[0]}`;
        }
        return str; // Se já estiver certa, mantém
    };

    // 3. CAPTURA A DATA DA OS (Tentando pegar do objeto 't' que você usa)
    const dataOS = converterData(t.data_geracao || t.created_at || new Date().toISOString());

    const novaJanela = window.open('', '_blank', 'width=900,height=700');
    const urlImagem = window.location.origin + '/timbrado.jpeg';

    novaJanela.document.write(`
        <html>
        <head>
            <title>Impressão SIGTI</title>
            <style>
                @media print {
                    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    @page { size: A4; margin: 0; }
                }
                body { margin: 0; padding: 0; font-family: 'Times New Roman', serif; }
                .container-impressao { position: relative; width: 21cm; height: 29.7cm; }
                .fundo-timbrado { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; }
                .texto-sobreposto { position: relative; padding: 4.5cm 2cm 2cm 2cm; z-index: 1; }
                p { font-size: 12pt; line-height: 1.5; }
            </style>
        </head>
        <body>
            <div class="container-impressao">
                <img src="${urlImagem}" class="fundo-timbrado">
                <div class="texto-sobreposto">
                    ${conteudoOriginal}
                    <p style="text-align:center; margin-top:50px;">
                        Santa Helena de Goiás, ${dataOS}
                    </p>
                </div>
            </div>
            <script>
        // Esta função espera todas as imagens carregarem
        window.onload = function() {
            // Damos um fôlego de 500ms para garantir que o renderizador do navegador processe a imagem
            setTimeout(function() {
                window.print();
                // Opcional: window.close(); // Fecha a aba após imprimir
            }, 500);
        };
    </script>
        </body>
        </html>
    `);
    novaJanela.document.close();
};
    
    // Pequena pausa para a imagem carregar antes de imprimir
    setTimeout(() => {
                
    }, 500);
    };
    
function imprimirTermo() {
    const conteudo = document.getElementById('printable-content').innerHTML;
    const minhaJanela = window.open('', '', 'width=900,height=700');
    minhaJanela.document.write('<html><head><title>Termo</title></head><body>');
    minhaJanela.document.write(conteudo);
    minhaJanela.document.write('</body></html>');
    minhaJanela.document.close();
    minhaJanela.focus();
    minhaJanela.print();
    minhaJanela.close();

}

function fecharModal() {
    document.getElementById('modal-termo').style.display = 'none';
}

        /* ============================================================
           TELA: HISTÓRICO E DEVOLUÇÕES
           ============================================================ */


    async function confirmarDevolucao(idTermo, patrimonio) {
    if (!confirm(`Confirmar a devolução do patrimônio ${patrimonio}?`)) return;

    try {
        // 1. Atualiza o termo (IMPORTANTE: usamos o AWAIT aqui)
        
        const { error: errorTermo } = await supabaseClient
            .from('termos')
            .update({ devolvido: true })
            .eq('id', idTermo);

        if (errorTermo) throw errorTermo;

        // 2. Volta o item para disponível (AWAIT aqui também)
        const { error: errorEstoque } = await supabaseClient
            .from('estoque')
            .update({ status: 'disponivel' })
            .eq('patrimonio', patrimonio);

        if (errorEstoque) throw errorEstoque;

        alert("Devolução registrada com sucesso!");

        // 3. Agora sim, recarrega a tela. 
        // Como o 'await' segurou o código, os dados já estarão novos no banco.
       
        await renderHistorico(); 

    } catch (err) {
        console.error("Erro na devolução:", err);
        alert("Erro ao processar: " + err.message);
    }
}

        /* ============================================================
           UTILITÁRIOS
           ============================================================ */
        function toggleTheme() {
            document.body.classList.toggle('dark-mode');
            localStorage.setItem('sigti-theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
        }

        // Carregar tema salvo
       
        if(localStorage.getItem('sigti-theme') === 'dark') document.body.classList.add('dark-mode');



    async function excluirUsuario(id) {
        // 1. Confirmação
        if (!confirm("Deseja realmente remover este acesso?")) return;

        try {
            console.log("Tentando excluir ID:", id); // Veja isso no F12

            // 2. Executa a atualização no Supabase
            const { error } = await supabaseClient
                .from('usuarios')
                .update({ ativo: false }) // Certifique-se que a coluna chama 'ativo'
                .eq('id', id);

            if (error) {
                console.error("Erro do Supabase:", error);
                alert("Erro no banco: " + error.message);
                return;
            }

            // 3. Sucesso: Feedback e recarregar
            alert("Usuário desativado com sucesso!");
            
            // Use a função que reconstrói a lista para ele sumir da tela
            if (typeof carregarTabelaUsuarios === "function") {
                carregarTabelaUsuarios();
            } else {
                renderUsuarios(); 
            }

        } catch (err) {
            console.error("Erro catastrófico:", err);
            alert("Erro inesperado: " + err.message);
        }
    }

    async function alternarStatusUsuario(id, estaAtivo) {
    const novaSituacao = !estaAtivo; // Inverte: se era true, vai pra false
    const mensagem = novaSituacao ? "reativar" : "desativar";

    if (!confirm(`Deseja realmente ${mensagem} este usuário?`)) return;

    try {
        const { error } = await supabaseClient
            .from('usuarios')
            .update({ ativo: novaSituacao })
            .eq('id', id);

        if (error) throw error;

        alert(`Usuário ${novaSituacao ? 'reativado' : 'desativado'}!`);
        carregarTabelaUsuarios(); // Atualiza a lista na tela
    } catch (err) {
        alert("Erro ao mudar status: " + err.message);
    }
}

    async function alterarSenha(id) {
        const nova = prompt("Nova senha:");
        if (!nova) return;
    
        const hash = await gerarHash(nova);
        const { error } = await supabaseClient
        .from('usuarios')
        .update({ senha: hash })
        .eq('id', id);

    if (error) alert("Erro: " + error.message);
    else alert("Senha alterada!");
}

function logout() {
    currentUser = null;

    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';

    document.getElementById('log-email').value = '';
    document.getElementById('log-senha').value = '';

    document.getElementById('admin-menu').style.display = 'none';
}

window.addEventListener('DOMContentLoaded', () => {
    const salvo = localStorage.getItem('sigti_user');
    if (salvo) {
        currentUser = JSON.parse(salvo);
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('sidebar').style.display = 'flex';
        document.getElementById('app').style.display = 'block';
        document.getElementById('user-name').innerText = currentUser.nome;
        document.getElementById('user-role').innerText = currentUser.is_ti ? 'Administrador TI' : 'Colaborador';
        if(currentUser.is_ti) document.getElementById('admin-menu').style.display = 'block';
        if (typeof navegar === "function") navegar('solicitacoes', document.querySelector('.nav-item'));
    }
});

function logout() {
    localStorage.removeItem('sigti_user'); 
    window.location.reload();
}