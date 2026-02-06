/**
 * Retention Policy Designer (Business Logic Simulator)
 * Финальная версия с исправлением ошибки загрузки CSV
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

// 2. Игнорируем тех, кто не собирается уходить (Score < 0.7)
IF churn_score < 0.7 THEN RETURN "NO_OFFER"

// 3. VIP на помесячной оплате (Самый высокий риск) -> BIG ($50)
IF segment == "VIP" AND contract == "Month-to-month" THEN RETURN "BIG"

// 4. VIP на 2 года (Связаны контрактом, риск ухода ниже) -> SMALL ($10)
IF segment == "VIP" AND contract == "Two year" THEN RETURN "SMALL"

// 5. Обычные клиенты (Standard) -> MEDIUM ($25)
IF segment == "STANDARD" THEN RETURN "MEDIUM"

// 6. Страховка охвата для KPI > 90%
IF churn_score >= 0.7 THEN RETURN "SMALL"

// 7. Остальные
RETURN "NO_OFFER"

[MERMAID]
flowchart TD
  Start --> Risk{Risk >= 0.7?}
  Risk -- No --> Z([NO_OFFER])
  Risk -- Yes --> VIP_M{VIP & Month-to-month?}
  VIP_M -- Yes --> B([BIG])
  VIP_M -- No --> VIP_2{VIP & 2yr?}
  VIP_2 -- Yes --> S([SMALL])
  VIP_2 -- No --> Std{Standard?}
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
        if (ifMatch) rules.push({ type: "conditional", condition: ifMatch[1], result: ifMatch[2].toUpperCase() });
        else if (returnMatch) rules.push({ type: "fallback", result: returnMatch[1].toUpperCase() });
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
            try { if (eval(cond)) return rule.result; } catch (e) { }
        }
    }
    return "NO_OFFER";
}

// --- Загрузка данных (С исправлением ошибки CSV) ---
async function loadData() {
    try {
        const res = await fetch("./data/telco_sample.csv");
        if (!res.ok) throw new Error("CORS or 404");
        const text = await res.text();
        return parseCSV(text);
    } catch (e) {
        console.warn("CSV Error. Using internal data...");
        // Встроенные данные, чтобы кнопка Run заработала сразу
        return [
            { customer_id: "VIP-M2M", monthly_charges: 110, tenure: 2, contract: "Month-to-month" },
            { customer_id: "VIP-2YR", monthly_charges: 105, tenure: 48, contract: "Two year" },
            { customer_id: "STD-RISK", monthly_charges: 65, tenure: 12, contract: "One year" },
            { customer_id: "OTH-LOW", monthly_charges: 30, tenure: 5, contract: "Month-to-month" },
            { customer_id: "STD-HIGH", monthly_charges: 70, tenure: 1, contract: "Month-to-month" }
        ];
    }
}

function parseCSV(text) {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace("monthlycharges", "monthly_charges").replace("customerid", "customer_id"));
    return lines.slice(1, 301).map(line => {
        const cols = line.split(",");
        const row = {};
        headers.forEach((h, idx) => row[h] = cols[idx] ? cols[idx].trim() : "");
        return row;
    });
}

// --- Вспомогательные функции ---
function calculateMockChurnScore(row) {
    let score = 0.4;
    if (row.contract === "Month-to-month") score += 0.3;
    if (row.contract === "Two year") score -= 0.3;
    if (Number(row.tenure) > 48) score -= 0.2;
    return Math.max(0.01, Math.min(0.99, score + (Math.random() - 0.5) * 0.1));
}

function determineSegment(row) {
    const c = Number(row.monthly_charges);
    return c >= 90 ? "VIP" : (c >= 50 ? "STANDARD" : "OTHER");
}

function offerCost(o) {
    return o === "BIG" ? 50 : (o === "MEDIUM" ? 25 : (o === "SMALL" ? 10 : 0));
}

async function renderMermaid(code) {
    const m = window.__mermaid__;
    if (m) {
        el("diagram").innerHTML = `<pre class="mermaid">${code}</pre>`;
        await m.run({ querySelector: ".mermaid" });
    }
}

function renderTable(rows) {
    const headers = ["customer_id", "segment", "contract", "churn_score", "offer", "cost"];
    el("outTable").innerHTML = "<thead><tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr></thead><tbody>" + 
    rows.slice(0, 15).map(r => "<tr>" + headers.map(h => `<td>${r[h]}</td>`).join("") + "</tr>").join("") + "</tbody>";
}

// --- Главный цикл ---
async function main() {
    el("instruction").value = DEFAULT_INSTRUCTION;
    el("runBtn").addEventListener("click", async () => {
        el("status").textContent = "Running...";
        const rules = parseRules(el("instruction").value);
        const raw = await loadData();
        const enriched = raw.map(r => {
            const segment = determineSegment(r);
            const churn_score = calculateMockChurnScore(r);
            const offer = executeRules({...r, segment, churn_score}, rules);
            return {...r, segment, churn_score: churn_score.toFixed(2), offer, cost: offerCost(offer)};
        });

        const highRisk = enriched.filter(r => r.churn_score >= 0.7);
        const coverage = highRisk.length ? (highRisk.filter(r => r.offer !== "NO_OFFER").length / highRisk.length) : 0;
        const totalCost = enriched.reduce((sum, r) => sum + r.cost, 0);

        // Scoring Logic
        const safetyScore = Math.min(50, (coverage / 0.9) * 50);
        const efficiencyScore = totalCost <= 3500 ? (30 + (20 * (1 - totalCost/3500))) : 0;
        const score = Math.max(0, Math.round(safetyScore + efficiencyScore));

        el("kpiScore").textContent = score;
        el("kpiBudget").textContent = `$${totalCost}`;
        el("kpiCoverage").textContent = `${Math.round(coverage * 100)}%`;
        el("kpiRows").textContent = enriched.length;
        
        renderTable(enriched);
        const mermaidLines = el("instruction").value.split("[MERMAID]")[1];
        if (mermaidLines) await renderMermaid(mermaidLines.trim());
        el("status").textContent = "Success!";
    });
}
main();
