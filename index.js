const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());

const traduzirStatus = { 'hp': 'Vida', 'attack': 'Ataque', 'defense': 'Defesa', 'special-attack': 'Ataque Especial', 'special-defense': 'Defesa Especial', 'speed': 'Velocidade' };
const traduzirHabitat = { 'cave': 'Caverna', 'forest': 'Floresta', 'grassland': 'Pradaria', 'mountain': 'Montanha', 'rare': 'Raro', 'rough-terrain': 'Terreno Acidentado', 'sea': 'Mar', 'urban': 'Urbano', 'waters-edge': 'Beira da Água', 'desconhecido': 'Desconhecido' };
const traduzirTipo = { 'normal': 'Normal', 'fire': 'Fogo', 'water': 'Água', 'electric': 'Elétrico', 'grass': 'Grama', 'ice': 'Gelo', 'fighting': 'Lutador', 'poison': 'Venenoso', 'ground': 'Terrestre', 'flying': 'Voador', 'psychic': 'Psíquico', 'bug': 'Inseto', 'rock': 'Pedra', 'ghost': 'Fantasma', 'dragon': 'Dragão', 'dark': 'Sombrio', 'steel': 'Aço', 'fairy': 'Fada' };

async function buscarInimigoAleatorio(tiposDano) {
    if (tiposDano.length === 0) return null; 
    try {
        const urlTipo = tiposDano[0].url;
        const respostaTipo = await axios.get(urlTipo);
        const listaPokemons = respostaTipo.data.pokemon;

        const limite = Math.min(20, listaPokemons.length);
        const indexSorteado = Math.floor(Math.random() * limite);
        const nomeInimigo = listaPokemons[indexSorteado].pokemon.name;

        const urlInimigo = `https://pokeapi.co/api/v2/pokemon/${nomeInimigo}`;
        const respostaInimigo = await axios.get(urlInimigo);

        return {
            nome: respostaInimigo.data.name,
            imagem: respostaInimigo.data.sprites.front_default || respostaInimigo.data.sprites.other['official-artwork'].front_default
        };
    } catch (error) { return null; }
}

async function calcularMediaTipo(urlTipo) {
    try {
        const resposta = await axios.get(urlTipo);
        const lista = resposta.data.pokemon;
        const amostra = lista.sort(() => 0.5 - Math.random()).slice(0, 5);
        let somas = { hp: 0, attack: 0, defense: 0, 'special-attack': 0, 'special-defense': 0, speed: 0 };

        await Promise.all(amostra.map(async (p) => {
            const res = await axios.get(p.pokemon.url);
            res.data.stats.forEach(s => {
                if(somas[s.stat.name] !== undefined) somas[s.stat.name] += s.base_stat;
            });
        }));

        return {
            'hp': Math.round(somas.hp / 5), 'attack': Math.round(somas.attack / 5),
            'defense': Math.round(somas.defense / 5), 'special-attack': Math.round(somas['special-attack'] / 5),
            'special-defense': Math.round(somas['special-defense'] / 5), 'speed': Math.round(somas.speed / 5)
        };
    } catch (e) { return null; }
}

app.get('/api/pokemon/:nome', async (req, res) => {
    const nomePokemon = req.params.nome.toLowerCase(); 

    try {
        const urlPoke = `https://pokeapi.co/api/v2/pokemon/${nomePokemon}`;
        const respostaPoke = await axios.get(urlPoke);
        const dadosPoke = respostaPoke.data;

        const imagemOficial = dadosPoke.sprites.other['official-artwork'].front_default || dadosPoke.sprites.front_default;
        
        const statusEmPortugues = dadosPoke.stats.map(s => ({
            atributo: traduzirStatus[s.stat.name] || s.stat.name,
            atributoIngles: s.stat.name,
            valor: s.base_stat
        }));

        const urlEspecie = dadosPoke.species.url; 
        const respostaEspecie = await axios.get(urlEspecie);
        const dadosEspecie = respostaEspecie.data;

        const habitatIngles = dadosEspecie.habitat ? dadosEspecie.habitat.name : "desconhecido";
        const habitatPortugues = traduzirHabitat[habitatIngles] || habitatIngles;

        const entradaPokedex = dadosEspecie.flavor_text_entries.find(entry => entry.language.name === 'en');
        const descricaoIngles = entradaPokedex ? entradaPokedex.flavor_text.replace(/[\n\f\r]/g, ' ') : "Descrição não encontrada.";

        const urlTipo = dadosPoke.types[0].type.url;
        const respostaTipo = await axios.get(urlTipo);
        const relacoesDano = respostaTipo.data.damage_relations;

        const nomeTipoPrincipal = traduzirTipo[dadosPoke.types[0].type.name] || dadosPoke.types[0].type.name;
        const forteContra = relacoesDano.double_damage_to.map(t => traduzirTipo[t.name] || t.name).join(', ') || 'Nenhum';
        const fracoContra = relacoesDano.double_damage_from.map(t => traduzirTipo[t.name] || t.name).join(', ') || 'Nenhum';

        const inimigoForte = await buscarInimigoAleatorio(relacoesDano.double_damage_to);
        const inimigoFraco = await buscarInimigoAleatorio(relacoesDano.double_damage_from);
        
        const mediaDoTipo = await calcularMediaTipo(urlTipo);

        // --- NOVA LÓGICA: POKÉMONS SEMELHANTES ---
        // Pega 4 Pokémons aleatórios do mesmo tipo (excluindo o que foi pesquisado)
        const listaTipo = respostaTipo.data.pokemon;
        const semelhantesDisponiveis = listaTipo.filter(p => p.pokemon.name !== dadosPoke.name);
        const sorteados = semelhantesDisponiveis.sort(() => 0.5 - Math.random()).slice(0, 4);
        
        // Monta os dados dos semelhantes aproveitando o ID na URL para gerar a foto
        const semelhantes = sorteados.map(p => {
            const id = p.pokemon.url.split('/').filter(Boolean).pop(); // Extrai o ID da URL
            return {
                nome: p.pokemon.name,
                imagem: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
            };
        });

        const urlTraducao = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(descricaoIngles)}&langpair=en|pt-br`;
        const respostaTraducao = await axios.get(urlTraducao);
        const descricaoTraduzida = respostaTraducao.data.responseData.translatedText;

        const respostaFinal = {
            nome: dadosPoke.name,
            imagem: imagemOficial,
            habitat_regiao: habitatPortugues,
            tipo_principal: nomeTipoPrincipal,
            vantagens: forteContra,
            fraquezas: fracoContra,
            inimigo_vantagem: inimigoForte,
            inimigo_fraqueza: inimigoFraco,
            status: statusEmPortugues,
            media_tipo: mediaDoTipo,
            semelhantes: semelhantes, // Adiciona na resposta
            descricao: descricaoTraduzida
        };

        res.json(respostaFinal);

    } catch (error) {
        res.status(404).json({ erro: "Pokémon não encontrado." });
    }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));