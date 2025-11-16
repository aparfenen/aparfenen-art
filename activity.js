// ===== ACTIVITY VISUALIZATION FROM CSV =====

let activityData = {};

// 1) Загрузка CSV файла
async function loadActivityRows() {
  try {
    const resp = await fetch('gallery_metadata.csv');
    if (!resp.ok) throw new Error(`Failed to load CSV: ${resp.status}`);
    const text = await resp.text();
    
    // Проверка что Papa.parse доступен
    if (typeof Papa === 'undefined') {
      throw new Error('PapaParse library not loaded');
    }
    
    const parsed = Papa.parse(text, { 
      header: true,
      skipEmptyLines: true,
      transformHeader: header => header.trim().toLowerCase()
    });

    // Фильтруем пустые строки
    return parsed.data.filter(row =>
      row && Object.values(row).some(v => v && String(v).trim() !== '')
    );
  } catch (error) {
    console.error('[Activity] Error loading CSV:', error);
    return [];
  }
}

// 2) Парсинг date_created
// Поддерживаемые форматы:
//   MM/DD/YYYY
//   MM/YYYY
//   MM/YY (короткий год: MM/25 → MM/2025)
function parseRowToYearMonth(row) {
  const raw = String(
    row.date_created ||
    row["date_created"] ||
    row["date created"] ||
    ""
  ).trim();

  if (!raw) return null;

  const parts = raw.split('/').map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  let month = parseInt(parts[0], 10);
  let year;

  if (parts.length === 3) {
    // MM/DD/YYYY
    year = parseInt(parts[2], 10);
  } else if (parts.length === 2) {
    // MM/YYYY or MM/YY
    const y = parseInt(parts[1], 10);
    if (isNaN(y)) return null;
    year = parts[1].length <= 2 ? 2000 + y : y;
  } else {
    return null;
  }

  if (isNaN(month) || month < 1 || month > 12) return null;
  if (isNaN(year) || year < 1900 || year > 2100) return null;

  const key = `${year}-${String(month).padStart(2, '0')}`;
  return { year, month, key };
}

// 3) Построение объекта { 'YYYY-MM': count }
function buildActivityData(rows) {
  const data = {};
  rows.forEach(row => {
    const parsed = parseRowToYearMonth(row);
    if (!parsed) return;
    const { key } = parsed;
    data[key] = (data[key] || 0) + 1;
  });
  return data;
}

// 4) Генерация полной временной шкалы от первой до последней работы
function generateTimeline() {
  const keys = Object.keys(activityData);
  if (keys.length === 0) return [];

  const sortedDates = keys.sort();
  const firstDate = sortedDates[0].split('-');
  const lastDate = sortedDates[sortedDates.length - 1].split('-');
  
  const startYear = parseInt(firstDate[0]);
  const startMonth = parseInt(firstDate[1]) - 1;
  const endYear = parseInt(lastDate[0]);
  const endMonth = parseInt(lastDate[1]) - 1;
  
  const timeline = [];
  
  for (let year = startYear; year <= endYear; year++) {
    const yearData = { year, months: [] };
    
    const monthStart = year === startYear ? startMonth : 0;
    const monthEnd = year === endYear ? endMonth : 11;
    
    for (let month = monthStart; month <= monthEnd; month++) {
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      yearData.months.push({
        month,
        monthKey,
        count: activityData[monthKey] || 0
      });
    }
    timeline.push(yearData);
  }
  return timeline;
}

// 5) Определение уровня активности
function getActivityLevel(count) {
  if (count === 0) return 'empty';
  if (count <= 1) return 'level-1';
  if (count <= 3) return 'level-2';
  if (count <= 7) return 'level-3';
  if (count <= 12) return 'level-4';
  if (count <= 18) return 'level-5';
  return 'level-6';
}

// 6) Получение названия месяца
function getMonthName(m) {
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m];
}

// 7) Рендер графика
function generateActivityChart() {
  const chartContainer = document.getElementById('activity-chart');
  if (!chartContainer) {
    console.error('[Activity] Chart container not found');
    return;
  }
  
  const timeline = generateTimeline();
  let html = '<div class="activity-timeline">';

  timeline.forEach(yearData => {
    const hasActivity = yearData.months.some(m => m.count > 0);
    // Показываем все годы с активностью + текущий год
    const currentYear = new Date().getFullYear();
    if (!hasActivity && yearData.year < currentYear - 1) return;

    html += `
      <div class="activity-year">
        <div class="year-label">${yearData.year}</div>
        <div class="year-months">
    `;

    yearData.months.forEach(m => {
      const level = getActivityLevel(m.count);
      const monthName = getMonthName(m.month);
      const displayCount = m.count > 0 ? m.count : '';
      
      html += `
        <div class="month-box ${level}"
             data-date="${m.monthKey}"
             data-count="${m.count}">
          <span class="month-abbr">${monthName[0]}</span>
          <span class="month-count">${displayCount}</span>
        </div>
      `;
    });

    html += `</div></div>`;
  });

  html += '</div>';
  chartContainer.innerHTML = html;
  
  console.log(`[Activity] Timeline visualization generated`);
}

// 8) Обновление статистики
function updateStats() {
  const counts = Object.values(activityData);
  if (!counts.length) {
    console.warn('[Activity] No activity data available');
    return;
  }

  const totalWorks = counts.reduce((a,b) => a+b, 0);

  let maxMonth = '', maxCount = 0;
  for (const [month, count] of Object.entries(activityData)) {
    if (count > maxCount) { 
      maxCount = count; 
      maxMonth = month; 
    }
  }

  const [maxY, maxM] = maxMonth.split('-');
  const monthName = getMonthName(parseInt(maxM) - 1);

  const currentYear = new Date().getFullYear();
  const currentYearCount = Object.entries(activityData)
    .filter(([date]) => date.startsWith(String(currentYear)))
    .reduce((sum, [,count]) => sum + count, 0);

  const totalElement = document.getElementById('total-works');
  const productiveElement = document.getElementById('most-productive-month');
  const yearElement = document.getElementById('current-year-count');

  if (totalElement) totalElement.textContent = totalWorks;
  if (productiveElement) productiveElement.textContent = `${monthName} ${maxY} (${maxCount})`;
  if (yearElement) yearElement.textContent = currentYearCount;
  
  console.log(`[Activity] Stats updated: ${totalWorks} total works, peak ${monthName} ${maxY}`);
}

// 9) Инициализация
async function initActivityVisualization() {
  console.log('[Activity] Initializing...');
  
  try {
    const rows = await loadActivityRows();
    console.log(`[Activity] Loaded ${rows.length} rows from CSV`);
    
    activityData = buildActivityData(rows);
    console.log(`[Activity] Parsed ${Object.keys(activityData).length} unique months`);
    
    generateActivityChart();
    updateStats();
    
    console.log('[Activity] Visualization complete');
  } catch (e) {
    console.error('[Activity] Initialization error:', e);
    
    // Fallback: показываем сообщение об ошибке
    const chartContainer = document.getElementById('activity-chart');
    if (chartContainer) {
      chartContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <p>Unable to load activity data.</p>
          <p style="font-size: 0.9em;">Please ensure gallery_metadata.csv is accessible.</p>
        </div>
      `;
    }
  }
}

// 10) Запуск при загрузке DOM
document.addEventListener('DOMContentLoaded', initActivityVisualization);

// 11) Tooltip обработчики
document.addEventListener('mouseover', e => {
  if (!e.target.classList.contains('month-box')) return;
  const t = document.getElementById('activity-tooltip');
  if (!t) return;

  const count = e.target.dataset.count;
  const [y,m] = e.target.dataset.date.split('-');
  const monthName = getMonthName(parseInt(m)-1);

  t.textContent = `${monthName} ${y}: ${count} work${count !== '1' ? 's':''}`;
  t.style.display = 'block';
  t.style.left = e.pageX + 10 + 'px';
  t.style.top = e.pageY - 30 + 'px';
});

document.addEventListener('mouseout', e => {
  if (e.target.classList.contains('month-box')) {
    const t = document.getElementById('activity-tooltip');
    if (t) t.style.display = 'none';
  }
});

console.log('[Activity] Script loaded');
