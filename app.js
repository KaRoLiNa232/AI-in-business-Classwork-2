/**
 * Retention Policy Designer (Business Logic Simulator)
 * Optimized by AI Data Strategist
 */

const DEFAULT_INSTRUCTION = `ROLE:
Retention Manager AI

CONTEXT:
Customer Data: segment, churn_score, monthly_charges, tenure, contract

INSTRUCTION:
Define your logic using IF/ELSE rules. The system executes them in order.

[RULES]
// 1. Очистка данных
IF churn_score == null THEN RETURN "NO_OFFER"

// 2. Экономия: Игнорируем низкий риск
IF churn_score < 0.7 THEN RETURN "NO_OFFER"

// 3. ХИРУРГИЧЕСКОЕ УДЕРЖАНИЕ: VIP на коротком поводке (Самый высокий риск)
IF segment == "VIP" AND contract == "Month-to-month" THEN RETURN "BIG"

// 4. ЭФФЕКТ ЛОЯЛЬНОСТИ: Если контракт на 2 года, клиент "заперт". Даем минимум.
IF contract == "Two year" THEN RETURN "SMALL"

// 5. СРЕДНИЙ КЛАСС: Оптимальное удержание для Standard
IF segment == "STANDARD" THEN RETURN "MEDIUM"

// 6. СТРАХОВКА: Обеспечиваем >90% охвата для всех остальных в зоне риска
IF churn_score >= 0.7 THEN RETURN "SMALL"

// 7. Фолбек
RETURN "NO_OFFER"

[MERMAID]
flowchart TD
  Start --> Risk{Risk >= 0.7?}
  Risk -- No --> Z([NO_OFFER])
  Risk -- Yes --> VIP_M2M{VIP & M2M?}
  VIP_M2M -- Yes --> B([BIG])
  VIP_M2M -- No --> LongTerm{2-Year Contract?}
  LongTerm -- Yes --> S([SMALL])
  LongTerm -- No --> Std{Standard?}
  Std -- Yes --> M([MEDIUM])
  Std -- No --> S2([SMALL])
`;

const el = (id) => document.getElementById(id);

function parseRules(instructionText) {
    const lines = instructionText.split("\n");
    const start = lines.findIndex(x => x.trim() === "[RULES]");
    if (start === -1) return [];

    const rules = [];
    for (let i = start + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith("//")) continue;
        if (line.startsWith("[")) break;
        
        const ifMatch = line.match(/^IF\s+(.+?)\s+THEN\s+RETURN\s+"?([A-Z_]+)"?$/i);
        const returnMatch = line.match(/^RETURN\s+"?([A-Z_]+)"?$/i);

        if (ifMatch) {
            rules.push({ type: "conditional", condition: ifMatch[1], result: ifMatch[2].toUpperCase() });
        } else if (returnMatch) {
            rules.push({ type: "fallback", result: returnMatch[1].toUpperCase() });
        }
    }
    return rules;
}

function executeRules(row, rules) {
    for (const rule of rules) {
        if (rule.type === "fallback") return rule.result;
        if (rule.type === "conditional") {
            let cond = rule.condition
                .replace(/churn_score/g, row.churn_score)
                .replace(/monthly_charges/g, row.monthly_charges)
                .replace(/tenure/g, row.tenure)
                .replace(/segment/g, `"${row.segment}"`) 
                .replace(/contract/g, `"${row.contract}"`); 

            try {
                if (eval(cond)) return rule.result;
            } catch (e) {
                console.warn("Rule eval error:", cond, e);
            }
        }
    }
    return "NO_OFFER";
}

function extractMermaid(instructionText) {
    const lines = instructionText.split("\n");
    const start = lines.findIndex((x) => x.trim() === "[MERMAID]");
    if (start === -1) return "flowchart TD\n  A[No MERMAID section found]";
    const out = [];
    for (let i = start + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith("[") && line.trim() !== "[MERMAID]") break;
        out.push(line);
    }
    return out.join("\n").trim();
}

function calculateMockChurnScore(row) {
    let score = 0.3;
    if (row.contract === "Month-to-month") score += 0.4;
    const tenure = Number(row.tenure);
    if (tenure > 48) score -= 0.2;
    if (row.contract === "Two year") score -= 0.3;
    score += (Math.random() - 0.5) * 0.1;
    return Math.max(0.01, Math.min(0.99, score));
}

function determineSegment(row) {
    const charges = Number(row.monthly_charges);
    if (charges >= 90) return "VIP";      
    if (charges >= 50) return "STANDARD"; 
    return "OTHER";                       
}

function offerCost(offer) {
    const o = String(offer).toUpperCase();
    if (o === "BIG") return 50;
    if (o === "MEDIUM") return 25;
    if (o === "SMALL") return 10;
    return 0;
}

function parseCSV(text) {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map(h => {
        const clean = h.trim().toLowerCase();
        if (clean === "monthlycharges") return "monthly_charges";
        if (clean === "customerid") return "customer_id";
        return clean;
    });
    
    const rows = [];
    for (let i = 1; i < Math.min(lines.length, 300); i++) {
        const cols = lines[i].split(","); 
        if (cols.length < headers.length) continue;
        const row = {};
        headers.forEach((h, idx) => { row[h] = cols[idx] ? cols[idx].trim() : ""; });
        rows.push(row);
    }
    return rows;
}

// ИСПРАВЛЕННАЯ ФУНКЦИЯ ЗАГРУЗКИ
async function loadData() {
    try {
        const res = await fetch("./data/telco_sample.csv");
        if (!res.ok) throw new Error();
        const text = await res.text();
        return parseCSV(text);
    } catch (e) {
        console.warn("CSV not found. Switching to Mock Data Mode.");
        // Возвращаем тестовые данные, если файл не загрузился
        return [
            { customer_id: "VIP-001", monthly_charges: 110, tenure: 2, contract: "Month-to-month" },
            { customer_id: "VIP-002", monthly_charges: 105, tenure: 60, contract: "Two year" },
            { customer_id: "STD-001", monthly_charges: 65, tenure: 12, contract: "One year" },
            { customer_id: "OTH-001", monthly_charges: 30, tenure: 5, contract: "Month-to-month" },
            { customer_id: "VIP-003", monthly_charges: 95, tenure: 1, contract: "Month-to-month" }
        ];
    }
}

async function renderMermaid(mermaidCode) {
    const mermaid = window.__mermaid__;
    if (!mermaid) return;
    const container = el("diagram");
    container.innerHTML = `<pre class="mermaid">${mermaidCode}</pre>`;
    await mermaid.run({ querySelector: ".mermaid" });
}

function renderTable(rows) {
    const table = el("outTable");
    const headers = ["customer_id", "segment", "monthly_charges", "tenure", "contract", "churn_score", "offer", "cost"];
    table.innerHTML = "<thead><tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr></thead>";
    const tbody = document.createElement("tbody");
    rows.slice(0, 15).forEach((r) => {
        const tr = document.createElement("tr");
        headers.forEach((h) => {
            const td = document.createElement("td");
            td.textContent = r[h];
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
}

async function main() {
    el("instruction").value = DEFAULT_INSTRUCTION;

    el("runBtn").addEventListener("click", async () => {
        el("status").textContent = "Simulating...";
        try {
            const rules = parseRules(el("instruction").value); 
            const raw = await loadData();
            
            const enriched = raw.map(r => {
                const segment = determineSegment(r);
                const churnScore = calculateMockChurnScore(r);
                const offer = executeRules({ 
                    ...r, 
                    churn_score: churnScore, 
                    segment: segment,
                    monthly_charges: Number(r.monthly_charges),
                    tenure: Number(r.tenure)
                }, rules);
                
                return {
                    ...r,
                    segment,
                    churn_score: churnScore.toFixed(2),
                    offer,
                    cost: offerCost(offer)
                };
            });

            const totalCost = enriched.reduce((a, r) => a + r.cost, 0);
            const highRisk = enriched.filter((r) => Number(r.churn_score) >= 0.7);
            const coverage = highRisk.length ? (highRisk.filter(r => r.offer !== "NO_OFFER").length / highRisk.length) : 0;

            // Scoring
            const safetyScore = Math.min(50, (coverage / 0.9) * 50);
            let efficiencyScore = totalCost <= 3500 ? (30 + (20 * (1 - (totalCost / 3500)))) : 0;
            const penalty = totalCost > 3500 ? (totalCost - 3500) * 0.1 : 0;
            const finalScore = Math.max(0, Math.round(safetyScore + efficiencyScore - penalty));

            el("kpiRows").textContent = enriched.length;
            el("kpiBudget").textContent = `$${totalCost}`;
            el("kpiCoverage").textContent = `${Math.round(coverage * 100)}%`;
            el("kpiScore").textContent = finalScore;
            el("kpiAvgCost").textContent = `$${(totalCost / enriched.length).toFixed(2)}`;

            renderTable(enriched);
            await renderMermaid(extractMermaid(el("instruction").value));
            el("status").textContent = "Success!";
        } catch (err) {
            el("status").textContent = "Error!";
            console.error(err);
        }
    });
}

main();
