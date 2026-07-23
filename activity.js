// ===== ACTIVITY VISUALIZATION =====

// Activity data - будет заполнено из CSV
let activityData = {};

// Правильный парсинг CSV с учетом кавычек, включая переносы строк внутри кавычек
// (нельзя резать текст по '\n' заранее - многострочные description поломают выравнивание колонок)
function parseCSV(text) {
  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(current.trim());
      current = '';
    } else if (char === '\r') {
      // skip, handled by \n
    } else if (char === '\n') {
      row.push(current.trim());
      rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }

  // Последняя строка без завершающего \n
  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    rows.push(row);
  }

  return rows.filter(r => r.some(cell => cell !== ''));
}

// Парсим show_date: "August 2025" → { month: 8, year: 2025 }
function parseShowDate(showDate) {
  const months = {
    'january': 1, 'february': 2, 'march': 3, 'april': 4,
    'may': 5, 'june': 6, 'july': 7, 'august': 8,
    'september': 9, 'october': 10, 'november': 11, 'december': 12
  };
  
  const parts = showDate.toLowerCase().trim().split(/\s+/);
  if (parts.length !== 2) return null;
  
  const monthName = parts[0];
  const year = parseInt(parts[1], 10);
  
  const month = months[monthName];
  if (!month || isNaN(year)) return null;
  
  return { month, year };
}

// 1) Загрузка данных из CSV
async function loadActivityFromCSV() {
  try {
    const resp = await fetch('gallery_metadata.csv');
    if (!resp.ok) throw new Error(`Failed to load CSV: ${resp.status}`);
    const text = await resp.text();

    const rows = parseCSV(text);
    const headers = rows[0].map(h => h.toLowerCase().trim());

    const showDateIndex = headers.indexOf('show_date');
    const visibleIndex = headers.indexOf('visible');

    if (showDateIndex === -1) {
      console.error('[Activity] show_date column not found. Headers:', headers);
      return;
    }

    console.log(`[Activity] Found show_date at index ${showDateIndex}`);

    const data = {};
    let parsed = 0;
    let skipped = 0;

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];

      // Проверяем visible = yes
      const visible = cols[visibleIndex]?.toLowerCase().trim();
      if (visible !== 'yes') {
        skipped++;
        continue;
      }
      
      const showDate = cols[showDateIndex]?.trim();
      
      if (!showDate) {
        skipped++;
        continue;
      }
      
      const parsed_date = parseShowDate(showDate);
      
      if (!parsed_date) {
        console.warn(`[Activity] Could not parse show_date: "${showDate}"`);
        skipped++;
        continue;
      }
      
      const { month, year } = parsed_date;
      const key = `${year}-${String(month).padStart(2, '0')}`;
      data[key] = (data[key] || 0) + 1;
      parsed++;
    }
    
    activityData = data;
    console.log(`[Activity] Successfully parsed ${parsed} dates, skipped ${skipped}`);
    console.log('[Activity] Months:', Object.keys(data).sort());
    console.log('[Activity] Top months:', 
      Object.entries(data)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, v]) => `${k}: ${v}`)
    );
    
  } catch (error) {
    console.error('[Activity] Error loading CSV:', error);
  }
}

// Generate comprehensive timeline from first to last work
function generateTimeline() {
  const sortedDates = Object.keys(activityData).sort();
  if (sortedDates.length === 0) return [];
  
  const firstDate = sortedDates[0].split('-');
  const lastDate = sortedDates[sortedDates.length - 1].split('-');
  
  const startYear = parseInt(firstDate[0]);
  const startMonth = parseInt(firstDate[1]) - 1;
  const endYear = parseInt(lastDate[0]);
  const endMonth = parseInt(lastDate[1]) - 1;
  
  const timeline = [];
  
  // Group by years for better visualization
  for (let year = startYear; year <= endYear; year++) {
    const yearData = {
      year: year,
      months: []
    };
    
    // ИСПРАВЛЕНО: Всегда показываем ВСЕ 12 месяцев для каждого года
    for (let month = 0; month <= 11; month++) {
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      yearData.months.push({
        month: month,
        monthKey: monthKey,
        count: activityData[monthKey] || 0
      });
    }
    
    timeline.push(yearData);
  }
  
  return timeline;
}

// Determine activity level with better thresholds
function getActivityLevel(count) {
  if (count === 0) return 'empty';
  if (count <= 1) return 'level-1';
  if (count <= 3) return 'level-2';
  if (count <= 7) return 'level-3';
  if (count <= 12) return 'level-4';
  if (count <= 18) return 'level-5';
  return 'level-6';
}

// Get month name abbreviation
function getMonthName(monthIndex) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[monthIndex];
}

// Generate compact timeline visualization
function generateActivityChart() {
  const chartContainer = document.getElementById('activity-chart');
  if (!chartContainer) {
    console.error('[Activity] Chart container not found');
    return;
  }
  
  const timeline = generateTimeline();
  
  if (timeline.length === 0) {
    chartContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">No activity data available</div>';
    return;
  }
  
  let html = '<div class="activity-timeline">';
  
  // Create year-based visualization - REVERSED ORDER (newest first)
  timeline.reverse().forEach(yearData => {
    // Skip years with no activity at all
    const hasActivity = yearData.months.some(m => m.count > 0);
    if (!hasActivity && yearData.year < 2024) return;
    
    html += `
      <div class="activity-year">
        <div class="year-label">${yearData.year}</div>
        <div class="year-months">
    `;
    
    yearData.months.forEach(monthData => {
      const monthName = getMonthName(monthData.month);
      const level = getActivityLevel(monthData.count);
      const displayCount = monthData.count > 0 ? monthData.count : '';
      
      html += `
        <div class="month-box ${level}" 
             data-date="${monthData.monthKey}" 
             data-count="${monthData.count}"
             title="${monthName} ${yearData.year}: ${monthData.count} work${monthData.count !== 1 ? 's' : ''}">
          <span class="month-abbr">${monthName.substring(0, 1)}</span>
          <span class="month-count">${displayCount}</span>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  chartContainer.innerHTML = html;
  
  console.log(`[Activity] Timeline visualization generated with ${timeline.length} years`);
}

// Update statistics
function updateStats() {
  const counts = Object.values(activityData);
  if (counts.length === 0) {
    console.warn('[Activity] No data for stats');
    return;
  }
  
  // Count total works
  const totalWorks = counts.reduce((sum, count) => sum + count, 0);
  
  // Find most productive month
  let maxMonth = '';
  let maxCount = 0;
  for (const [month, count] of Object.entries(activityData)) {
    if (count > maxCount) {
      maxCount = count;
      maxMonth = month;
    }
  }
  
  const [year, month] = maxMonth.split('-');
  const monthName = getMonthName(parseInt(month) - 1);
  
  // Count works for current year
  const currentYear = new Date().getFullYear();
  const currentYearCount = Object.entries(activityData)
    .filter(([date]) => date.startsWith(String(currentYear)))
    .reduce((sum, [, count]) => sum + count, 0);
  
  // Update elements
  const totalElement = document.getElementById('total-works');
  const productiveElement = document.getElementById('most-productive-month');
  const yearElement = document.getElementById('current-year-count');
  
  if (totalElement) totalElement.textContent = totalWorks;
  if (productiveElement) productiveElement.textContent = `${monthName} ${year} (${maxCount})`;
  if (yearElement) yearElement.textContent = currentYearCount;
  
  console.log(`[Activity] Stats updated: ${totalWorks} total, peak ${monthName} ${year} (${maxCount}), this year ${currentYearCount}`);
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Activity] Initializing...');
  await loadActivityFromCSV();
  
  if (Object.keys(activityData).length === 0) {
    console.error('[Activity] No data loaded!');
    return;
  }
  
  generateActivityChart();
  updateStats();
  console.log('[Activity] Visualization initialized successfully');
});

// Enhanced tooltip interaction
document.addEventListener('mouseover', (e) => {
  if (e.target.classList.contains('month-box')) {
    const tooltip = document.getElementById('activity-tooltip');
    if (tooltip) {
      const count = e.target.dataset.count;
      const date = e.target.dataset.date;
      const [year, month] = date.split('-');
      const monthName = getMonthName(parseInt(month) - 1);
      
      tooltip.textContent = `${monthName} ${year}: ${count} work${count !== '1' ? 's' : ''}`;
      tooltip.style.display = 'block';
      tooltip.style.left = e.pageX + 10 + 'px';
      tooltip.style.top = e.pageY - 30 + 'px';
    }
  }
});

document.addEventListener('mouseout', (e) => {
  if (e.target.classList.contains('month-box')) {
    const tooltip = document.getElementById('activity-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }
});
