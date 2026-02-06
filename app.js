/**
 * Retention Policy Designer (Business Logic Simulator)
 * Поправленный путь к файлу + Победная стратегия
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

// 2. Экономия: Игнорируем тех, кто не уходит (Score < 0.7)
IF churn_score < 0.7 THEN RETURN "NO_OFFER"

// 3. СТРАТЕГИЯ: VIP на коротком контракте — даем максимум (BIG)
IF segment == "VIP" AND contract == "Month-to-month" THEN RETURN "BIG"

// 4. ЭКОНОМИЯ: VIP на 2 года — они "заперты", даем минимум (SMALL)
IF segment == "VIP" AND contract == "Two year" THEN RETURN "SMALL"

// 5. ОБЫЧНЫЕ КЛИЕНТЫ: Оптимальное удержание (MEDIUM)
IF segment == "STANDARD" THEN RETURN "MEDIUM"

// 6. ОХВАТ: Все остальные с высоким риском получают поддержку (SMALL)
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

/**
 * Rule Parser Engine
 */
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

/**
 * Dynamic Rule Executor
 */
function executeRules(row, rules) {
    for (const rule of rules) {
        if (rule.type === "fallback") {
            return rule.result;
        }

        if (rule.type === "conditional") {
            let cond = rule.condition
                .replace(/churn_score/g, row.churn_score)
                .replace(/monthly_charges/g, row.monthly_charges)
                .replace(/tenure/g, row.tenure)
                .replace(/segment/g, `"${row.segment}"`) 
                .replace(/contract/g, `"${row.contract}"`); 

            try {
                if (eval(cond)) {
                    return rule.result;
                }
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

/**
 * 1. Churn Probability Mockup
 */
function calculateMockChurnScore(row) {
    let score = 0.3; 

    if (row.contract === "Month-to-month") score += 0.4;
    if (String(row.internet_service || "").includes("Fiber")) score += 0.1;
    if (String(row.payment_method || "").includes("Electronic")) score += 0.1;

    const tenure = Number(row.tenure);
    if (tenure > 12) score -= 0.1;
    if (tenure > 48) score -= 0.2;
    if (row.contract === "Two year") score -= 0.3;

    score += (Math.random() - 0.5) * 0.1;

    return Math.max(0.01, Math.min(0.99, score));
}

/**
 * 2. Segment Generation Logic
 */
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

/**
 * 3. CSV Parser
 */
function parseCSV(text) {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map(h => {
        const clean = h.trim().toLowerCase();
        if (clean === "monthlycharges") return "monthly_charges";
        if (clean === "customerid") return "customer_id";
        if (clean === "internetservice") return "internet_service";
        if (clean === "paymentmethod") return "payment_method";
        return clean;
    });
    
    const sampleSize = 300; 
    const rows = [];

    for (let i = 1; i < Math.min(lines.length, sampleSize); i++) {
        const cols = lines[i].split(","); 
        if (cols.length < headers.length) continue;

        const row = {};
        headers.forEach((h, idx) => {
            row[h] = cols[idx] ? cols[idx].trim() : "";
        });
        rows.push(row);
    }
    return rows;
}

/**
 * Исправленная загрузка данных: файл в корне
 */
async function loadData() {
    // Убираем "./data/", файл telco_sample.csv лежит в корне вместе с index.html
    const res = await fetch("./telco_sample.csv"); 
    if (!res.ok) throw new Error("Failed to load CSV");
    const text = await res.text();
    return parseCSV(text);
}

async function renderMermaid(mermaidCode) {
    const mermaid = window.__mermaid__;
    if (!mermaid) return;
    const container = el("diagram");
    container.innerHTML = `<pre class="mermaid">${escapeHtml(mermaidCode)}</pre>`;
    await mermaid.run({ querySelector: ".mermaid" });
}

function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderTable(rows) {
    const table = el("outTable");
    const headers = ["customer_id", "segment", "monthly_charges", "tenure", "contract", "churn_score", "offer", "cost"];

    table.innerHTML = "";
    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    headers.forEach((h) => {
        const th = document.createElement("th");
        th.textContent = h;
        trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);

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

function fmtMoney(x) {
    return `$${Number(x).toLocaleString()}`;
}

async function main() {
    el("instruction").value = DEFAULT_INSTRUCTION;

    el("runBtn").addEventListener("click", async () => {
        el("status").textContent = "Parsing logic & Simulating...";
        
        try {
            const rules = parseRules(el("instruction").value); 
            const raw = await loadData();
            
            const enriched = raw.map(r => {
                const churnScore = calculateMockChurnScore({
                    contract: r.contract, 
                    internet_service: r.internet_service || "", 
                    payment_method: r.payment_method || "",
                    tenure: r.tenure,
                    monthly_charges: r.monthly_charges,
                    segment: r.segment 
                });
                
                const segment = determineSegment({
                    monthly_charges: r.monthly_charges
                });
                
                const offer = executeRules({ 
                    ...r, 
                    churn_score: churnScore, 
                    segment: segment,
                    monthly_charges: Number(r.monthly_charges),
                    tenure: Number(r.tenure),
                    contract: r.contract
                }, rules);
                
                const cost = offerCost(offer);

                return {
                    customer_id: r.customer_id,
                    segment: segment, 
                    contract: r.contract,
                    monthly_charges: r.monthly_charges,
                    tenure: r.tenure,
                    churn_score: churnScore.toFixed(2), 
                    offer: offer,
                    cost: cost
                };
            });

            const totalCost = enriched.reduce((a, r) => a + Number(r.cost), 0);
            const highRisk = enriched.filter((r) => Number(r.churn_score) >= 0.7);
            const highRiskCovered = highRisk.filter((r) => r.offer !== "NO_OFFER").length;
            const coverage = highRisk.length ? (highRiskCovered / highRisk.length) : 0;

            const BUDGET_LIMIT = 3500;
            const safetyScore = Math.min(50, (coverage / 0.9) * 50);
            
            let efficiencyScore = 0;
            if (totalCost <= BUDGET_LIMIT) {
                efficiencyScore = 30 + (20 * (1 - (totalCost / BUDGET_LIMIT)));
            }

            let penalty = totalCost > BUDGET_LIMIT ? (totalCost - BUDGET_LIMIT) * 0.1 : 0;
            const finalScore = Math.max(0, Math.round(safetyScore + efficiencyScore - penalty));

            el("kpiRows").textContent = String(enriched.length);
            el("kpiBudget").textContent = fmtMoney(totalCost);
            el("kpiCoverage").textContent = `${Math.round(coverage * 100)}%`;
            el("kpiScore").textContent = finalScore;
            
            const scoreEl = el("kpiScore");
            if (finalScore >= 85) scoreEl.style.color = "#10b981";
            else if (finalScore >= 50) scoreEl.style.color = "#f59e0b";
            else scoreEl.style.color = "#ef4444";
            
            el("kpiAvgCost").textContent = fmtMoney(enriched.length ? totalCost / enriched.length : 0);
            renderTable(enriched);
            await renderMermaid(extractMermaid(el("instruction").value));
            el("status").textContent = "Simulation Complete.";

        } catch (err) {
            console.error(err);
            el("status").textContent = "Error: " + err.message;
        }
    });
}

main();
