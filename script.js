/* ============================================================
   Calculator — script.js  (expression-based, real-time)
   ============================================================ */

// ── DOM refs ──────────────────────────────────────────────────
const expressionEl  = document.getElementById('expression');
const operationEl   = document.getElementById('operation');
const historyPanel  = document.getElementById('historyPanel');
const historyList   = document.getElementById('historyList');
const historyToggle = document.getElementById('historyToggle');
const clearHistBtn  = document.getElementById('clearHistory');

// ── State ─────────────────────────────────────────────────────
let expr      = '';       // the raw expression string, e.g. "6+5/55-10"
let justCalc  = false;    // true right after = was pressed
let history   = [];

// ── Display symbols → JS operators ───────────────────────────
const SYM_TO_JS = { '×': '*', '÷': '/', '−': '-', '+': '+' };
const OPERATORS  = ['+', '−', '×', '÷'];

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────
function isOperator(ch) {
  return OPERATORS.includes(ch);
}

function lastChar() {
  return expr.slice(-1);
}

// Convert display expression to evaluatable JS string
function toJsExpr(e) {
  return e
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-');
}

// Safe evaluator — no eval/Function with user strings
// Implements: tokenise → parse with precedence
function safeEval(jsStr) {
  // tokenise into numbers and operators
  const tokens = jsStr.match(/(\d+\.?\d*|\.\d+|[+\-*/])/g);
  if (!tokens) return NaN;

  // Convert to numbers and operator strings
  const nums = [];
  const ops  = [];

  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === '+' || t === '-' || t === '*' || t === '/') {
      ops.push(t);
    } else {
      nums.push(parseFloat(t));
    }
    i++;
  }

  if (nums.length === 0) return NaN;
  if (nums.length !== ops.length + 1) return NaN;

  // Pass 1: handle * and /
  let ni = [...nums];
  let oi = [...ops];
  let j = 0;
  while (j < oi.length) {
    if (oi[j] === '*' || oi[j] === '/') {
      const val = oi[j] === '*' ? ni[j] * ni[j+1] : ni[j] / ni[j+1];
      ni.splice(j, 2, val);
      oi.splice(j, 1);
    } else {
      j++;
    }
  }

  // Pass 2: handle + and -
  let result = ni[0];
  for (let k = 0; k < oi.length; k++) {
    result = oi[k] === '+' ? result + ni[k+1] : result - ni[k+1];
  }

  return result;
}

// Update big display with auto font-size
function setDisplay(text) {
  const len = text.length;
  expressionEl.style.fontSize =
    len > 20 ? '16px' :
    len > 14 ? '20px' :
    len > 10 ? '26px' :
    len >  7 ? '32px' : '42px';
  expressionEl.textContent = text || '0';
}

function setOperation(text) {
  operationEl.textContent = text;
}

function flashResult() {
  expressionEl.classList.remove('result-anim');
  void expressionEl.offsetWidth;
  expressionEl.classList.add('result-anim');
}

// ─────────────────────────────────────────────────────────────
//  Input handlers
// ─────────────────────────────────────────────────────────────
function inputNumber(digit) {
  if (justCalc) {
    // Fresh start — don't continue from result
    expr     = digit === '0' ? '0' : digit;
    justCalc = false;
  } else {
    // Don't allow leading double-zero
    if (expr === '0' && digit !== '.') {
      expr = digit;
    } else {
      expr += digit;
    }
  }
  setDisplay(expr);
  setOperation('');
}

function inputDecimal() {
  if (justCalc) { expr = '0.'; justCalc = false; setDisplay(expr); return; }

  // Find the last number segment and check if it already has a dot
  const parts = expr.split(/[+\-×÷]/);
  const lastPart = parts[parts.length - 1];
  if (lastPart.includes('.')) return;  // already has decimal

  if (expr === '' || isOperator(lastChar())) expr += '0';
  expr += '.';
  setDisplay(expr);
  setOperation('');
}

function inputOperator(op) {
  if (justCalc) {
    justCalc = false;
    // expr already holds the last result, continue from it
  }

  if (expr === '') { expr = '0'; }

  // Replace last operator if user taps another one immediately
  if (isOperator(lastChar())) {
    expr = expr.slice(0, -1);
  }
  // Don't allow operator right after a decimal point
  if (lastChar() === '.') expr = expr.slice(0, -1);

  expr += op;
  setDisplay(expr);
  setOperation('');
  highlightOperator(op);
}

function calculate() {
  if (!expr || expr === '0') return;

  // Strip trailing operator or dot
  let clean = expr;
  while (clean.length && (isOperator(clean.slice(-1)) || clean.slice(-1) === '.')) {
    clean = clean.slice(0, -1);
  }
  if (!clean) return;

  const jsStr = toJsExpr(clean);
  const result = safeEval(jsStr);

  if (!isFinite(result) || isNaN(result)) {
    setDisplay('Error');
    setOperation('');
    expr = '';
    justCalc = true;
    clearOperatorHighlight();
    return;
  }

  const displayResult = parseFloat(result.toPrecision(12));

  addHistory(clean, displayResult);

  // Top line: full expression =  |  big display: result
  setOperation(clean + ' =');
  setDisplay(String(displayResult));
  flashResult();

  expr     = String(displayResult);  // allow chaining from result
  justCalc = true;
  clearOperatorHighlight();
}

function deleteLast() {
  if (justCalc) { clearAll(); return; }
  if (!expr || expr === '0') return;
  expr = expr.length > 1 ? expr.slice(0, -1) : '0';
  // if we deleted an operator, clear highlight
  if (!isOperator(lastChar())) clearOperatorHighlight();
  setDisplay(expr);
  setOperation('');
}

function clearAll() {
  expr     = '';
  justCalc = false;
  setDisplay('0');
  setOperation('');
  clearOperatorHighlight();
}

function toggleSign() {
  if (!expr || expr === '0' || expr === 'Error') return;
  // Negate the last number in the expression
  const match = expr.match(/^(.*[+\-×÷])?(-?)(\d+\.?\d*)$/);
  if (!match) return;
  const prefix = match[1] || '';
  const neg    = match[2];
  const num    = match[3];
  expr = prefix + (neg === '-' ? '' : '-') + num;
  setDisplay(expr);
}

function percent() {
  // Convert last number to its percentage value
  const match = expr.match(/^(.*[+\-×÷])?(-?\d+\.?\d*)$/);
  if (!match) return;
  const prefix = match[1] || '';
  const num    = parseFloat(match[2]) / 100;
  expr = prefix + String(num);
  setDisplay(expr);
}

// ─────────────────────────────────────────────────────────────
//  Operator highlight
// ─────────────────────────────────────────────────────────────
function highlightOperator(op) {
  clearOperatorHighlight();
  document.querySelectorAll('.btn-op').forEach(btn => {
    if (btn.dataset.value === op) btn.classList.add('active');
  });
}

function clearOperatorHighlight() {
  document.querySelectorAll('.btn-op').forEach(b => b.classList.remove('active'));
}

// ─────────────────────────────────────────────────────────────
//  History
// ─────────────────────────────────────────────────────────────
function addHistory(expression, result) {
  history.unshift({ expression, result });
  if (history.length > 30) history.pop();
  if (historyPanel.classList.contains('open')) renderHistory();
}

function renderHistory() {
  historyList.innerHTML = '';
  if (history.length === 0) {
    const empty = document.createElement('li');
    empty.style.cssText = 'color:rgba(255,255,255,0.3);font-size:12px;padding:14px 16px;text-align:center;';
    empty.textContent = 'No history yet.';
    historyList.appendChild(empty);
    return;
  }
  history.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `<div class="hist-expr">${item.expression} =</div>
                    <div class="hist-result">${item.result}</div>`;
    li.addEventListener('click', () => {
      expr     = String(item.result);
      justCalc = true;
      setDisplay(expr);
      setOperation(item.expression + ' =');
    });
    historyList.appendChild(li);
  });
}

clearHistBtn.addEventListener('click', () => {
  history = [];
  renderHistory();
});

historyToggle.addEventListener('click', () => {
  const isOpen = historyPanel.classList.toggle('open');
  historyToggle.classList.toggle('active', isOpen);
  if (isOpen) renderHistory();
});

// ─────────────────────────────────────────────────────────────
//  Button clicks + ripple
// ─────────────────────────────────────────────────────────────
document.querySelector('.buttons').addEventListener('click', e => {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  createRipple(btn, e);
  const { action, value } = btn.dataset;
  switch (action) {
    case 'number':     inputNumber(value);  break;
    case 'operator':   inputOperator(value); break;
    case 'decimal':    inputDecimal();      break;
    case 'equals':     calculate();         break;
    case 'clear':      clearAll();          break;
    case 'delete':     deleteLast();        break;
    case 'toggleSign': toggleSign();        break;
    case 'percent':    percent();           break;
  }
});

function createRipple(btn, e) {
  const rect   = btn.getBoundingClientRect();
  const size   = Math.max(rect.width, rect.height);
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size/2}px;top:${e.clientY - rect.top - size/2}px`;
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

// ─────────────────────────────────────────────────────────────
//  Keyboard support
// ─────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const k = e.key;
  if      (k >= '0' && k <= '9') { inputNumber(k);      flashKey(`[data-value="${k}"]`); }
  else if (k === '.')             { inputDecimal();       flashKey('[data-action="decimal"]'); }
  else if (k === '+')             { inputOperator('+');   flashKey('[data-value="+"]'); }
  else if (k === '-')             { inputOperator('−');   flashKey('[data-value="−"]'); }
  else if (k === '*')             { inputOperator('×');   flashKey('[data-value="×"]'); }
  else if (k === '/') { e.preventDefault(); inputOperator('÷'); flashKey('[data-value="÷"]'); }
  else if (k === 'Enter' || k === '=') { calculate();    flashKey('[data-action="equals"]'); }
  else if (k === 'Backspace')          { deleteLast();   flashKey('[data-action="delete"]'); }
  else if (k === 'Escape')             { clearAll();     flashKey('[data-action="clear"]'); }
  else if (k === '%')                  { percent();      flashKey('[data-action="percent"]'); }
});

function flashKey(selector) {
  const btn = document.querySelector(selector);
  if (!btn) return;
  btn.style.transform = 'scale(0.9)';
  setTimeout(() => btn.style.transform = '', 100);
}

// ─────────────────────────────────────────────────────────────
//  Floating particles
// ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('particles');
const ctx    = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

function spawnParticles() {
  particles = Array.from({ length: 55 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 1.8 + 0.4,
    vx: (Math.random() - 0.5) * 0.35,
    vy: -(Math.random() * 0.4 + 0.1),
    alpha: Math.random() * 0.5 + 0.1,
  }));
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    if (p.y < -4) { p.y = canvas.height + 4; p.x = Math.random() * canvas.width; }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,200,255,${p.alpha})`;
    ctx.fill();
  });
  requestAnimationFrame(animateParticles);
}

window.addEventListener('resize', () => { resizeCanvas(); spawnParticles(); });
resizeCanvas();
spawnParticles();
animateParticles();

// ── Init ──────────────────────────────────────────────────────
setDisplay('0');
setOperation('');
renderHistory();
