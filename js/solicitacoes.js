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
    try {
        const tipo = document.getElementById('os-tipo').value;
        const desc = document.getElementById('os-desc').value;

        const { data: { user } } = await supabaseClient.auth.getUser();

        if (!user) {
            alert("Usuário não está logado");
            return;
        }

        const { data, error } = await supabaseClient
    .from('solicitacoes')
    .insert([{
    usuario_id: user.id,
    usuario_nome: currentUser.nome,
    matricula: currentUser.matricula,
    tipo: tipo,
    descricao: desc,
    status: 'pendente'
}])
    .select();

console.log("DATA:", data);
console.log("ERROR INSERT:", error);

// 👇 log do email também
const { data: emailData, error: emailError } = await supabaseClient.functions.invoke('enviar-email-os', {
    body: {
        usuario_nome: currentUser.nome,
        descricao: desc
    }
});

console.log("EMAIL DATA:", emailData);
console.log("EMAIL ERROR:", emailError);

        alert("Solicitação enviada com sucesso!");

        fecharModal();
        renderSolicitacoes();

    } catch (err) {
        console.error(err);
        alert("Erro ao enviar solicitação.");
    }
}

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
            if (os.status === 'pendente') {
                await supabaseClient
                    .from('solicitacoes')
                    .update({ status: 'em_andamento' })
                    .eq('id', id);

                alert("OS colocada em andamento.");
                // CORREÇÃO AQUI: Forçar a tabela a atualizar antes de navegar
                if (typeof carregarTabelaOS === 'function') await carregarTabelaOS();
                navegar('solicitacoes');
                return;
            }

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
            t.solicitacao_id && t.solicitacao_id.toString().startsWith(anoAtual.toString())
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
                    matricula: currentUser.matricula,
                equipamento_cod: patrimonio,
                tipo: tipo,
                descricao: descricaoOriginalDaOS,
                data_geracao: new Date().toLocaleDateString('pt-BR')
            }]);

        if (errSalvar) throw new Error("Erro ao gerar termo no banco");

        // 🔄 5️⃣ Atualizar status da OS
        // ATENÇÃO: Verifique se no seu carregarTabelaOS você usa 'concluida' ou 'concluido'
        const novoStatus = tipo === 'Manutenção' ? 'concluida' : 'aprovado';

        const { error: errFinal } = await supabaseClient
            .from('solicitacoes')
            .update({ status: novoStatus })
            .eq('id', id);

        if (errFinal) throw new Error("Erro ao finalizar solicitação");

        alert(`Ordem de Serviço #${idCustom} gerada com sucesso!`);
        
        // CORREÇÃO FINAL: Garante que a tela mude
        if (typeof carregarTabelaOS === 'function') await carregarTabelaOS();
        navegar('solicitacoes');

    } catch (erro) {
        console.error("Erro no processamento:", erro);
        alert("Erro técnico: " + erro.message);
    }
}

    /* --- FUNÇÕES DE APOIO --- */

    // Busca a descrição atual para não apagar o que o usuário escreveu
    async function buscarDescricaoAtual(id) {
        const { data } = await supabaseClient
            .from('solicitacoes')
            .select('descricao')
            .eq('id', id)
            .single();
        return data ? data.descricao : "";
    }

    // Função ÚNICA para devolver a OS
    
    async function devolverOS(id) {
        const motivo = prompt("Informe o motivo da devolução:");
        if (!motivo) return;

        try {
            const descAtual = await buscarDescricaoAtual(id);
            const { error } = await supabaseClient
                .from('solicitacoes')
                .update({ 
                    status: 'devolvida', 
                    descricao: `[MOTIVO DA DEVOLUÇÃO: ${motivo.toUpperCase()}] - ${descAtual}` 
                })
                .eq('id', id);

            if (error) throw error;
            alert("OS devolvida!");
            carregarTabelaOS();
        } catch (err) {
            alert("Erro técnico ao devolver. Verifique o console.");
        }
    }

    /* --- TABELA (LIMPA E SEM DUPLICAÇÃO) --- */
    async function carregarTabelaOS() {
    const { data: lista, error } = await supabaseClient
        .from('solicitacoes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro ao carregar solicitações:", error);
        return;
    }

    const tbody = document.getElementById('lista-os');
    if (!tbody) return;

    // Filtra itens nulos ou undefined
    const listaValida = lista.filter(os => os != null);

    tbody.innerHTML = listaValida.map(os => {
        let botoesAcao = '---';

        // REGRA 1: Se a OS é MINHA e foi devolvida, eu preciso EDITAR
        if (currentUser && os.usuario_id === currentUser.id && os.status === 'devolvida') {
            botoesAcao = `<button onclick="abrirModalEdicao('${os.id}', '${os.descricao}')" style="background:#6366f1; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Corrigir OS</button>`;
        } 
        
        // REGRA 2: Se eu sou TI, eu vejo os botões de gestão (Aceitar/Devolver)
        else if (currentUser && currentUser.is_ti) {
            if (os.status === 'pendente') {
                botoesAcao = `
                    <button onclick="processarOS('${os.id}', '${os.usuario_id}', '${os.tipo}', '${os.usuario_nome}')" style="background:#22c55e; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer;">Aceitar</button>
                    <button onclick="devolverOS('${os.id}')" style="background:#f59e0b; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; margin-left:5px;">Devolver</button>
                `;
            } else if (os.status === 'em_andamento') {
                botoesAcao = `<button onclick="processarOS('${os.id}', '${os.usuario_id}', '${os.tipo}', '${os.usuario_nome}')" style="background:#3b82f6; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Concluir</button>`;
            }
        }

        return `
            <tr>
                <td>#${os.id?.toString().slice(-4) || '----'}</td>
                <td>${os.created_at ? new Date(os.created_at).toLocaleDateString() : '----'}</td>
                <td>${os.usuario_nome || '----'}</td>
                <td>${os.tipo || '----'}</td>
                <td><span class="badge status-${os.status || 'desconhecido'}">${os.status ? os.status.toUpperCase() : '---'}</span></td>
                <td>${botoesAcao}</td>
            </tr>
        `;
    }).join('');
}
async function abrirModalEdicao(id, descricaoAntiga) {
    const novaDesc = prompt("Corrija sua descrição:", descricaoAntiga);
    if (!novaDesc || novaDesc === descricaoAntiga) return;

    try {
        const { error } = await supabaseClient
            .from('solicitacoes')
            .update({ 
                descricao: novaDesc,
                status: 'pendente' // Volta para a TI poder aceitar de novo
            })
            .eq('id', id);

        if (error) throw error;
        alert("OS corrigida com sucesso!");
        carregarTabelaOS();
    } catch (err) {
        alert("Erro ao editar OS.");
    }
}
