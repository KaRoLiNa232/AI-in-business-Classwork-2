/**
 * Retention Policy Designer (Business Logic Simulator)
 * Универсальная версия: работает с любым расположением CSV
 */

const DEFAULT_INSTRUCTION = `ROLE:
Retention Manager AI

CONTEXT:
Customer Data: segment, churn_score, monthly_charges, tenure, contract

INSTRUCTION:
Define your logic using IF/ELSE rules. The system executes them in order.

[RULES]
// 1. Фильтр данных
IF churn_score == null THEN RETURN "NO_OFFER"

// 2. Экономия: Игнорируем клиентов с низким риском (Score < 0.7)
IF churn_score < 0.7 THEN RETURN "NO_OFFER"

// 3. VIP удержание: BIG только для тех, кто на помесячной оплате (M2M)
IF segment == "VIP" AND contract == "Month-to-month" THEN RETURN "BIG"

// 4. Экономия на VIP: если контракт на 2 года, риск ухода ниже -> SMALL
IF segment == "VIP" AND contract == "Two year" THEN RETURN "SMALL"

// 5. Оптимизация Standard: даем средний оффер
IF segment == "STANDARD" THEN RETURN "MEDIUM"

// 6. Страховка охвата: все остальные High-Risk получают поддержку
IF churn_score >= 0.7 THEN RETURN "SMALL"

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

// --- Двигатель правил ---
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

// --- Умная загрузка данных ---
async function loadData() {
    const paths = ["./telco_sample.csv", "./data/telco_sample.csv"];
    
    for (const path of paths) {
        try {
            const res = await fetch(path);
            if (res.ok) {
                const text = await res.text();
                console.log(`Файл успешно загружен из: ${path}`);
                return parseCSV(text);
            }
        } catch (e) {
            continue;
        }
    }
    throw new Error("Не удалось найти CSV ни в корне, ни в папке /data/");
}

function parseCSV(text) {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map(h => {
        const clean = h.trim().toLowerCase();
        if (clean === "monthlycharges") return "monthly_charges";
        if (clean === "customerid") return "customer_id";
        return clean;
    });
    
    return lines.slice(1, 301).map(line => {
        const cols = line.split(",");
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = cols[idx] ? cols[idx].trim() : "";
        });
        return row;
    });
}

// --- Расчеты и KPI ---
function calculateMockChurnScore(row) {
    let score = 0.35;
    if (row.contract === "Month-to-month") score += 0.35;
    if (row.contract === "Two year") score -= 0.3;
    if (Number(row.tenure) > 48) score -= 0.15;
    return Math.max(0.01, Math.min(0.99, score + (Math.random() - 0.5) * 0.1));
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

// --- Интерфейс ---
async function renderMermaid(code) {
    const mermaid = window.__mermaid__;
    if (!mermaid) return;
    el("diagram").innerHTML = `<pre class="mermaid">${code}</pre>`;
    await mermaid.run({ querySelector: ".mermaid" });
}

function renderTable(rows) {
    const headers = ["customer_id", "segment", "contract", "churn_score", "offer", "cost"];
    const thead = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>`;
    const tbody = `<tbody>${rows.slice(0, 15).map(r => `<tr>${headers.map(h => `<td>${r[h]}</td>`).join("")}</tr>`).join("")}</tbody>`;
    el("outTable").innerHTML = thead + tbody;
}

async function main() {
    el("instruction").value = DEFAULT_INSTRUCTION;

    el("runBtn").addEventListener("click", async () => {
        el("status").textContent = "Simulation in progress...";
        try {
            const rules = parseRules(el("instruction").value);
            const raw = await loadData();
            
            const enriched = raw.map(r => {
                const segment = determineSegment(r);
                const churnScore = calculateMockChurnScore(r);
                const offer = executeRules({...r, segment, churn_score: churnScore}, rules);
                return {
                    ...r,
                    segment,
                    churn_score: churnScore.toFixed(2),
                    offer,
                    cost: offerCost(offer)
                };
            });

            const totalCost = enriched.reduce((a, r) => a + r.cost, 0);
            const highRisk = enriched.filter(r => Number(r.churn_score) >= 0.7);
            const coverage = highRisk.length ? (highRisk.filter(r => r.offer !== "NO_OFFER").length / highRisk.length) : 0;

            // KPI Scoring
            const safetyScore = Math.min(50, (coverage / 0.9) * 50);
            const efficiencyScore = totalCost <= 3500 ? (30 + (20 * (1 - totalCost/3500))) : 0;
            const finalScore = Math.max(0, Math.round(safetyScore + efficiencyScore));

            el("kpiScore").textContent = finalScore;
            el("kpiBudget").textContent = `$${totalCost}`;
            el("kpiCoverage").textContent = `${Math.round(coverage * 100)}%`;
            el("kpiRows").textContent = enriched.length;
            
            renderTable(enriched);
            const mermaidCode = el("instruction").value.split("[MERMAID]")[1];
            if (mermaidCode) await renderMermaid(mermaidCode.trim());

            el("status").textContent = "Done!";
        } catch (err) {
            el("status").textContent = "Error: " + err.message;
            console.error(err);
        }
    });
}

main();
